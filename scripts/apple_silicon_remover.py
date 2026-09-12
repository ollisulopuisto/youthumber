#!/usr/bin/env python3
"""Local Apple Silicon / Core ML background removal HTTP service.

Provides local-first offline inference leveraging Apple Silicon Metal/ANE
via Apple's Vision framework (macOS) or fallback mock.
Zero cloud APIs, zero per-image cost.
"""

import base64
import io
import json
import logging
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from PIL import Image

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

HOST = "127.0.0.1"
PORT = 5055

# Check if Apple Vision framework is available on macOS
HAS_VISION = False
if sys.platform == "darwin":
    try:
        import Quartz  # noqa: F401
        import Vision  # noqa: F401
        from Foundation import NSData  # noqa: F401

        HAS_VISION = True
        logger.info(
            "Apple Vision framework loaded successfully (Apple Neural Engine / Metal enabled)"
        )
    except ImportError as e:
        logger.warning(
            "Apple Vision framework not available: %s. Using fallback mode.", e
        )
else:
    logger.info("Non-macOS platform detected (%s). Using fallback mode.", sys.platform)


def decode_base64_image(image_str: str) -> bytes:
    """Decodes raw base64 or data URL formatted image string to bytes."""
    if "," in image_str and image_str.startswith("data:"):
        _, encoded = image_str.split(",", 1)
    else:
        encoded = image_str
    return base64.b64decode(encoded)


def image_to_data_url(image: Image.Image, format: str = "PNG") -> str:
    """Encodes a PIL Image into a base64 data URL."""
    buf = io.BytesIO()
    image.save(buf, format=format)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    mime = "image/png" if format.upper() == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


def segment_with_vision(image_bytes: bytes) -> tuple[Image.Image, Image.Image]:
    """Segments a person using macOS Vision framework (VNGeneratePersonSegmentationRequest).

    Returns (cutout_image, mask_image).
    """
    import Quartz
    import Vision
    from Foundation import NSData

    orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    width, height = orig.size

    # Convert image bytes to CGImage
    nsdata = NSData.dataWithBytes_length_(image_bytes, len(image_bytes))
    img_source = Quartz.CGImageSourceCreateWithData(nsdata, None)
    if not img_source:
        raise ValueError("Could not parse image data via Quartz")

    cg_image = Quartz.CGImageSourceCreateImageAtIndex(img_source, 0, None)
    if not cg_image:
        raise ValueError("Could not create CGImage from source data")

    # Configure Vision person segmentation request
    request = (
        Vision.VNGeneratePersonSegmentationRequest.alloc().initWithCompletionHandler_(
            None
        )
    )
    request.setQualityLevel_(
        Vision.VNGeneratePersonSegmentationRequestQualityLevelAccurate
    )

    # Perform segmentation request
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(
        cg_image, None
    )
    success, err = handler.performRequests_error_([request], None)
    if not success or not request.results():
        raise RuntimeError(f"Vision segmentation request failed: {err}")

    # Extract segmentation mask pixel buffer
    observation = request.results()[0]
    pixel_buffer = observation.pixelBuffer()

    # Convert CVPixelBuffer -> CIImage -> CGImage
    ci_img = Quartz.CIImage.imageWithCVPixelBuffer_(pixel_buffer)
    ci_context = Quartz.CIContext.context()
    cg_mask = ci_context.createCGImage_fromRect_(ci_img, ci_img.extent())

    # Export CGImage mask to PNG bytes
    data = Quartz.CFDataCreateMutable(None, 0)
    dest = Quartz.CGImageDestinationCreateWithData(data, "public.png", 1, None)
    Quartz.CGImageDestinationAddImage(dest, cg_mask, None)
    Quartz.CGImageDestinationFinalize(dest)

    # Open mask in PIL, resize to match original image dimensions
    mask_pil = Image.open(io.BytesIO(bytes(data))).convert("L")
    mask_resized = mask_pil.resize((width, height), Image.Resampling.BILINEAR)

    # Composite cutout
    cutout = orig.convert("RGBA")
    cutout.putalpha(mask_resized)

    return cutout, mask_resized


def segment_fallback(image_bytes: bytes) -> tuple[Image.Image, Image.Image]:
    """Fallback segmenter when Vision framework is unavailable.

    Generates a soft oval foreground mask and transparent cutout.
    """
    orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    width, height = orig.size

    # Create oval mask in center
    mask = Image.new("L", (width, height), 0)
    from PIL import ImageDraw

    draw = ImageDraw.Draw(mask)
    draw.ellipse(
        [int(width * 0.15), int(height * 0.05), int(width * 0.85), int(height * 0.95)],
        fill=255,
    )

    cutout = orig.convert("RGBA")
    cutout.putalpha(mask)
    return cutout, mask


class CoreMLRemovalHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            payload = {
                "status": "ready",
                "backend": "apple-silicon-vision" if HAS_VISION else "fallback",
                "device": "Apple Neural Engine / Metal"
                if HAS_VISION
                else "CPU Fallback",
                "supportedModels": [
                    "apple-vision-ane",
                    "coreml-local",
                ],
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self) -> None:
        if self.path == "/remove":
            start_time = time.time()
            content_length = int(self.headers.get("Content-Length", 0))
            raw_data = self.rfile.read(content_length)

            try:
                data: dict[str, Any] = json.loads(raw_data.decode("utf-8"))
                source_image_str = data.get("image")
                model_requested = data.get("model", "apple-vision-ane")

                if not source_image_str:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Missing 'image' in JSON payload")
                    return

                image_bytes = decode_base64_image(source_image_str)

                if HAS_VISION:
                    cutout, mask = segment_with_vision(image_bytes)
                    model_id = "apple-vision-ane"
                else:
                    cutout, mask = segment_fallback(image_bytes)
                    model_id = f"{model_requested}-fallback"

                cutout_url = image_to_data_url(cutout, format="PNG")
                mask_url = image_to_data_url(mask, format="PNG")

                elapsed_ms = int((time.time() - start_time) * 1000)
                response_payload = {
                    "image": cutout_url,
                    "mask": mask_url,
                    "metadata": {
                        "backendId": "coreml-local",
                        "modelId": model_id,
                        "executionTimeMs": max(1, elapsed_ms),
                    },
                }

                body = json.dumps(response_payload).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
            except Exception as err:
                logger.exception("Segmentation failed")
                self.send_response(500)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(f"Segmentation error: {err}".encode())
        else:
            self.send_response(404)
            self.end_headers()


def run(port: int = PORT) -> None:
    server_address = (HOST, port)
    httpd = HTTPServer(server_address, CoreMLRemovalHandler)
    logger.info(
        "Apple Silicon background removal server running on http://%s:%d (Vision enabled: %s)",
        HOST,
        port,
        HAS_VISION,
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down server.")
        httpd.server_close()


if __name__ == "__main__":
    run()
