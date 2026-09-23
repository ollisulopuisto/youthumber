"""Apple Silicon Vision & Core ML person segmentation engine."""

import base64
import io
import logging
import sys

from PIL import Image

logger = logging.getLogger(__name__)

# Check if Apple Vision framework is available on macOS
HAS_VISION = False
if sys.platform == "darwin":
    try:
        import Quartz  # noqa: F401
        import Vision  # noqa: F401
        from Foundation import NSData  # noqa: F401

        HAS_VISION = True
        logger.info(
            "Apple Vision framework loaded (Apple Neural Engine / Metal enabled)"
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


# Mask values above this count as part of a region. At 200 a mic touching the host's
# shoulder (alpha 40-145) came off, but it had been covering the shirt, so it left a
# hole in the person (2026-09-23). At 64 things touching the body stay; only pieces
# floating free of it are dropped.
REGION_CONNECT_THRESHOLD = 64
REGION_EDGE_GROW = 2  # work-scale pixels of soft edge kept at full strength around the body (~8px at 1080p)
# Further work-scale pixels over which the rest fades out instead of a hard cut. On a
# 1080p soft-edge ramp the worst jump between neighbouring pixels was 156 with a hard
# cut, 24 with fade 1 and 14 with fade 2; 1 leaves less haze where a removed object
# touched the body (2026-09-23).
REGION_FADE = 1
REGION_WORK_WIDTH = 480  # regions are found on a downscaled copy; 1080p masks otherwise take seconds


def keep_largest_region(mask: Image.Image) -> Image.Image:
    """Keeps only the largest connected region of a soft person mask.

    Vision's person segmentation also keeps objects near the person — a microphone in
    front of the host came out as a floating grey blob (2026-09-23). Anything not
    connected to the main body is dropped; soft edges of the kept region are preserved.
    """
    from collections import deque

    import numpy as np

    full = np.asarray(mask.convert("L"))
    height, width = full.shape
    scale = min(1.0, REGION_WORK_WIDTH / width)
    work_w, work_h = max(1, round(width * scale)), max(1, round(height * scale))
    small = np.asarray(mask.convert("L").resize((work_w, work_h), Image.Resampling.NEAREST))
    solid = small > REGION_CONNECT_THRESHOLD
    if not solid.any():
        return mask.convert("L")

    labels = np.zeros(solid.shape, dtype=np.int32)
    sizes = [0]
    for start in zip(*np.nonzero(solid)):
        if labels[start]:
            continue
        label = len(sizes)
        labels[start] = label
        queue, size = deque([start]), 0
        while queue:
            y, x = queue.popleft()
            size += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < work_h and 0 <= nx < work_w and solid[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = label
                    queue.append((ny, nx))
        sizes.append(size)

    # Grow past the body so its soft (below-threshold) edge survives, plus a ring to fade in.
    grown = labels == int(np.argmax(sizes))
    for _ in range(REGION_EDGE_GROW + REGION_FADE):
        step = grown.copy()
        step[1:] |= grown[:-1]
        step[:-1] |= grown[1:]
        step[:, 1:] |= grown[:, :-1]
        step[:, :-1] |= grown[:, 1:]
        grown = step

    # Scale the kept area back up smoothly and fade it out, rather than cutting with the
    # blocky low-res shape — that left 4px stair steps along soft edges.
    from PIL import ImageFilter

    weight = (
        Image.fromarray(grown.astype(np.uint8) * 255)
        .resize((width, height), Image.Resampling.BILINEAR)
        .filter(ImageFilter.GaussianBlur(radius=(REGION_FADE / 2) / scale))
    )
    faded = full.astype(np.float32) * (np.asarray(weight, dtype=np.float32) / 255.0)
    return Image.fromarray(np.round(faded).astype(np.uint8), mode="L")


def segment_with_vision(image_bytes: bytes) -> tuple[Image.Image, Image.Image]:
    """Segments a person using macOS Vision framework (VNGeneratePersonSegmentationRequest).

    Returns (cutout_image, mask_image).
    """
    import Quartz
    import Vision
    from Foundation import NSData

    orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    width, height = orig.size

    nsdata = NSData.dataWithBytes_length_(image_bytes, len(image_bytes))
    img_source = Quartz.CGImageSourceCreateWithData(nsdata, None)
    if not img_source:
        raise ValueError("Could not parse image data via Quartz")

    cg_image = Quartz.CGImageSourceCreateImageAtIndex(img_source, 0, None)
    if not cg_image:
        raise ValueError("Could not create CGImage from source data")

    request = (
        Vision.VNGeneratePersonSegmentationRequest.alloc().initWithCompletionHandler_(
            None
        )
    )
    request.setQualityLevel_(
        Vision.VNGeneratePersonSegmentationRequestQualityLevelAccurate
    )

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(
        cg_image, None
    )
    success, err = handler.performRequests_error_([request], None)
    if not success or not request.results():
        raise RuntimeError(f"Vision segmentation request failed: {err}")

    observation = request.results()[0]
    pixel_buffer = observation.pixelBuffer()

    ci_img = Quartz.CIImage.imageWithCVPixelBuffer_(pixel_buffer)
    ci_context = Quartz.CIContext.context()
    cg_mask = ci_context.createCGImage_fromRect_(ci_img, ci_img.extent())

    data = Quartz.CFDataCreateMutable(None, 0)
    dest = Quartz.CGImageDestinationCreateWithData(data, "public.png", 1, None)
    Quartz.CGImageDestinationAddImage(dest, cg_mask, None)
    Quartz.CGImageDestinationFinalize(dest)

    mask_pil = Image.open(io.BytesIO(bytes(data))).convert("L")
    mask_resized = keep_largest_region(mask_pil.resize((width, height), Image.Resampling.BILINEAR))

    cutout = orig.convert("RGBA")
    cutout.putalpha(mask_resized)

    return cutout, mask_resized


def segment_fallback(image_bytes: bytes) -> tuple[Image.Image, Image.Image]:
    """Fallback segmenter when Vision framework is unavailable."""
    orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    width, height = orig.size

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


def segment_image(
    image_bytes: bytes, model: str = "apple-vision-ane"
) -> tuple[Image.Image, Image.Image, str]:
    """Runs segmentation on input image bytes and returns (cutout, mask, model_id)."""
    if HAS_VISION:
        cutout, mask = segment_with_vision(image_bytes)
        model_id = "apple-vision-ane"
    else:
        cutout, mask = segment_fallback(image_bytes)
        model_id = f"{model}-fallback"

    return cutout, mask, model_id
