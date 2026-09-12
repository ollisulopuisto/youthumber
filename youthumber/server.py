"""FastAPI application serving YouThumber web UI and Core ML segmentation APIs."""

import logging
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .paths import get_dist_dir
from .segmentation import (
    HAS_VISION,
    decode_base64_image,
    image_to_data_url,
    segment_image,
)

logger = logging.getLogger(__name__)


class RemovalRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded source image or data URL")
    model: str = Field("apple-vision-ane", description="Segmentation model identifier")
    feather: float | None = None
    threshold: float | None = None


def create_app(dist_dir: Path | None = None) -> FastAPI:
    """Creates and configures the FastAPI application."""
    if dist_dir is None:
        dist_dir = get_dist_dir()

    app = FastAPI(
        title="YouThumber",
        description="Local-first YouTube thumbnail editor API & Web Studio",
        version="26.09.12.58",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ready",
            "backend": "apple-silicon-vision" if HAS_VISION else "fallback",
            "device": "Apple Neural Engine / Metal" if HAS_VISION else "CPU Fallback",
            "supportedModels": [
                "apple-vision-ane",
                "coreml-local",
            ],
        }

    @app.post("/remove")
    async def remove_background(req: RemovalRequest) -> JSONResponse:
        start_time = time.time()
        if not req.image:
            raise HTTPException(status_code=400, detail="Missing 'image' in payload")

        try:
            image_bytes = decode_base64_image(req.image)
            cutout, mask, model_id = segment_image(image_bytes, model=req.model)

            cutout_url = image_to_data_url(cutout, format="PNG")
            mask_url = image_to_data_url(mask, format="PNG")
            elapsed_ms = int((time.time() - start_time) * 1000)

            return JSONResponse(
                {
                    "image": cutout_url,
                    "mask": mask_url,
                    "metadata": {
                        "backendId": "coreml-local",
                        "modelId": model_id,
                        "executionTimeMs": max(1, elapsed_ms),
                    },
                }
            )
        except Exception as err:
            logger.exception("Removal request failed")
            raise HTTPException(
                status_code=500, detail=f"Segmentation failed: {err}"
            ) from err

    # Serve static assets and SPA
    if dist_dir and dist_dir.is_dir():
        assets_dir = dist_dir / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        @app.api_route("/", methods=["GET", "HEAD"])
        async def serve_index() -> FileResponse:
            index_html = dist_dir / "index.html"
            if index_html.is_file():
                return FileResponse(index_html)
            raise HTTPException(status_code=404, detail="index.html not found in dist")

        @app.api_route("/{path:path}", methods=["GET", "HEAD"])
        async def serve_spa(path: str) -> FileResponse:
            target = dist_dir / path
            if target.is_file():
                return FileResponse(target)
            index_html = dist_dir / "index.html"
            if index_html.is_file():
                return FileResponse(index_html)
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")
    else:

        @app.api_route("/", methods=["GET", "HEAD"])
        async def serve_unbuilt() -> HTMLResponse:
            return HTMLResponse(
                """
                <html>
                    <body style="background:#090d16;color:#f3f4f6;font-family:sans-serif;padding:40px;text-align:center;">
                        <h2>YouThumber Web UI Not Built Yet</h2>
                        <p>Run <code>npm run build</code> in the project directory to compile the studio UI.</p>
                        <p>Or run with <code>--dev</code> to attach to Vite dev server on <code>http://localhost:5173</code>.</p>
                    </body>
                </html>
                """
            )

    return app
