"""FastAPI application serving YouThumber web UI and Core ML segmentation APIs."""

import json
import logging
import os
import sys
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .matting import BACKEND, MATTER, MODEL, warm_up
from .paths import get_dist_dir
from .segmentation import (
    HAS_VISION,
    decode_base64_image,
    image_to_data_url,
    segment_image,
    segment_with_matting,
)
from .textures import HAS_CORE_IMAGE, TEXTURE_PRESETS, render_texture
from .videoscan import (
    DEFAULT_FRAMES_PER_PERSON,
    DEFAULT_NUM_PEOPLE,
    DEFAULT_SPEAKER_SCAN_INTERVAL_SECONDS,
    HAS_AVFOUNDATION,
    grab_frame_at_time,
    scan_video_for_speakers,
)

logger = logging.getLogger(__name__)

SCAN_JOB_TTL_SECONDS = 600  # how long an unfetched finished scan is kept
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v"}


def has_traversal_segments(raw_path: str) -> bool:
    """Return True when the raw path string contains directory traversal segments.

    Checked on the raw string, before any path object is built from it.
    """
    return ".." in raw_path.replace("\\", "/").split("/")


def resolve_video_path(raw_path: str) -> Path:
    """Resolve a selected video and reject paths that are not supported video files.

    Traversal segments are rejected in the raw string before the path is resolved,
    so a video scan or frame grab can never reach a file through a ".." detour.
    """
    if not raw_path or has_traversal_segments(raw_path):
        raise HTTPException(status_code=400, detail="Video file not found")
    try:
        path = Path(raw_path).resolve(strict=True)
    except (OSError, RuntimeError) as err:
        raise HTTPException(status_code=400, detail="Video file not found") from err
    if not path.is_file() or path.suffix.lower() not in VIDEO_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported video file")
    return path


def resolve_dist_file(root: Path, request_path: str) -> Path | None:
    """Return a requested static file only when it resolves inside the build root.

    Traversal segments and absolute paths are rejected in the raw request string
    before any path is built from it; the resolved target must still stay inside
    the build root and be a regular file.
    """
    if (
        not request_path
        or request_path.startswith("/")
        or has_traversal_segments(request_path)
    ):
        return None
    try:
        root = root.resolve(strict=True)
        target = (root / request_path).resolve(strict=True)
        target.relative_to(root)
    except (OSError, RuntimeError, ValueError):
        return None
    if not target.is_file():
        return None
    return target


class RemovalRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded source image or data URL")
    model: str = Field("apple-vision-ane", description="Segmentation model identifier")
    feather: float | None = None
    threshold: float | None = None


class GrabFrameRequest(BaseModel):
    path: str = Field(..., description="Absolute path to a local video file")
    timestampSeconds: float = Field(..., ge=0)


class TextureRequest(BaseModel):
    preset: str
    colors: list[str] = Field(..., min_length=2, max_length=2)
    seed: int = 1
    width: int = Field(1920, gt=0, le=1920)
    height: int = Field(1080, gt=0, le=1080)


class VideoSpeakerScanRequest(BaseModel):
    path: str = Field(..., description="Absolute path to a local video file")
    intervalSeconds: float = Field(DEFAULT_SPEAKER_SCAN_INTERVAL_SECONDS, gt=0)
    numPeople: int = Field(DEFAULT_NUM_PEOPLE, gt=0, le=6)
    framesPerPerson: int = Field(DEFAULT_FRAMES_PER_PERSON, gt=0, le=30)


class ShowPresetRequest(BaseModel):
    preset: dict[str, Any]


def show_presets_path() -> Path:
    """Return a writable, per-user location for presets in the CLI/desktop app."""
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        return base / "YouThumber" / "show-presets.json"
    if sys.platform == "darwin":
        return (
            Path.home()
            / "Library"
            / "Application Support"
            / "YouThumber"
            / "show-presets.json"
        )
    base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "youthumber" / "show-presets.json"


def read_show_presets(path: Path) -> list[dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except FileNotFoundError:
        return []
    except (OSError, json.JSONDecodeError):
        logger.exception("Could not read saved show presets from %s", path)
        return []


def write_show_presets(path: Path, presets: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(presets, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


class HashedAssetFiles(StaticFiles):
    """Serves Vite's build output under /assets for caching forever: every file name
    there carries a hash of its content, so a changed file gets a new name.

    Not gzipped: over loopback the 300 kB main bundle arrives in well under a
    millisecond, while compressing it took 12 ms (2026-10-21).
    """

    async def get_response(self, path: str, scope) -> Any:
        response = await super().get_response(path, scope)
        if response.status_code in (200, 304):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def create_app(dist_dir: Path | None = None) -> FastAPI:
    """Creates and configures the FastAPI application."""
    if dist_dir is None:
        dist_dir = get_dist_dir()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # Load a downloaded model in the background at startup (~14 s for PyTorch), so
        # the first cutout doesn't pay for it. Not run by plain TestClient(app).
        # Checking for the model hashes all 440 MB of it (0.8 s warm, longer after a
        # reboot), and the server takes no requests until this returns, so that check
        # is in the background too.
        def load_if_downloaded() -> None:
            if MODEL.state()["status"] == "ready":
                warm_up(MATTER)

        threading.Thread(target=load_if_downloaded, daemon=True).start()
        yield

    app = FastAPI(
        lifespan=lifespan,
        title="YouThumber",
        description="Local-first YouTube thumbnail editor API & Web Studio",
        version="26.10.25.126",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/show-presets")
    def get_show_presets() -> dict[str, Any]:
        return {"presets": read_show_presets(show_presets_path())}

    @app.post("/show-presets")
    def put_show_preset(req: ShowPresetRequest) -> dict[str, Any]:
        preset = req.preset
        if not preset.get("id") or not preset.get("name"):
            raise HTTPException(
                status_code=400, detail="Preset id and name are required"
            )
        path = show_presets_path()
        presets = [p for p in read_show_presets(path) if p.get("id") != preset["id"]]
        presets.insert(0, preset)
        try:
            write_show_presets(path, presets)
        except OSError as err:
            logger.exception("Could not save show preset")
            raise HTTPException(
                status_code=500, detail="Could not save show preset"
            ) from err
        return {"presets": presets}

    @app.delete("/show-presets/{preset_id}")
    def remove_show_preset(preset_id: str) -> dict[str, Any]:
        path = show_presets_path()
        presets = [p for p in read_show_presets(path) if p.get("id") != preset_id]
        try:
            write_show_presets(path, presets)
        except OSError as err:
            logger.exception("Could not delete show preset")
            raise HTTPException(
                status_code=500, detail="Could not delete show preset"
            ) from err
        return {"presets": presets}

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
            "hasVideoScan": HAS_AVFOUNDATION,
        }

    # Plain `def`: BiRefNet takes ~10 s on the CPU, which would otherwise block the
    # event loop (and the 1.5 s health checks the page uses to find the engine).
    @app.post("/remove")
    def remove_background(req: RemovalRequest) -> JSONResponse:
        start_time = time.time()
        if not req.image:
            raise HTTPException(status_code=400, detail="Missing 'image' in payload")

        try:
            image_bytes = decode_base64_image(req.image)
            objects, matted = None, False
            if HAS_VISION and MODEL.state()["status"] == "ready":
                try:
                    cutout, mask, objects = segment_with_matting(image_bytes, MATTER)
                    model_id, matted = "birefnet-general+apple-vision", True
                except Exception:
                    # A broken model install (the first packaged build couldn't load
                    # it) shouldn't cost the cutout: Vision's still works.
                    logger.exception("BiRefNet failed; using Vision's cutout")
            if not matted:
                cutout, mask, model_id = segment_image(image_bytes, model=req.model)

            elapsed_ms = int((time.time() - start_time) * 1000)
            return JSONResponse(
                {
                    "image": image_to_data_url(cutout, format="PNG"),
                    "mask": image_to_data_url(mask, format="PNG"),
                    "objectsMask": (
                        image_to_data_url(objects, format="PNG") if objects else None
                    ),
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

    @app.get("/matting-model")
    def matting_model() -> dict[str, Any]:
        return {**MODEL.state(), "sizeMb": MODEL.size_mb, "backend": BACKEND}

    @app.post("/matting-model/download", status_code=202)
    def download_matting_model() -> dict[str, Any]:
        MODEL.start()
        return MODEL.state()

    @app.get("/textures")
    def list_textures() -> dict[str, Any]:
        return {"textures": TEXTURE_PRESETS, "available": HAS_CORE_IMAGE}

    @app.post("/texture")
    def texture(req: TextureRequest) -> JSONResponse:
        try:
            image = render_texture(
                req.preset, req.colors, req.seed, req.width, req.height
            )
        except ValueError as err:
            raise HTTPException(status_code=400, detail=str(err)) from err
        except RuntimeError as err:
            raise HTTPException(status_code=501, detail=str(err)) from err
        except Exception as err:
            # An unhandled error skips the CORS headers, so the page only saw
            # "Failed to fetch"; report it as a normal error response instead.
            logger.exception("Texture render failed")
            raise HTTPException(
                status_code=500, detail=f"Texture failed: {err}"
            ) from err
        return JSONResponse({"image": image_to_data_url(image, format="JPEG")})

    # A scan takes minutes, but the desktop window's WebKit drops any request after
    # 60 s ("Load failed") while the scan carries on unseen. So POST starts a job in a
    # thread and returns at once; the page polls GET for progress and the result.
    scan_jobs: dict[str, dict[str, Any]] = {}
    scan_finished_at: dict[str, float] = {}

    def prune_scan_jobs() -> None:
        # A finished scan nobody fetched (the page reloaded or closed mid-scan) would
        # otherwise keep its ~70 thumbnails for the life of the process.
        cutoff = time.time() - SCAN_JOB_TTL_SECONDS
        for job_id, finished in list(scan_finished_at.items()):
            if finished < cutoff:
                scan_jobs.pop(job_id, None)
                del scan_finished_at[job_id]

    def run_scan_job(
        job_id: str, job: dict[str, Any], req: VideoSpeakerScanRequest
    ) -> None:
        def report(fraction: float) -> None:
            job["progress"] = round(min(max(fraction, 0.0), 1.0), 3)

        try:
            job["people"] = scan_video_for_speakers(
                req.path,
                req.intervalSeconds,
                req.numPeople,
                req.framesPerPerson,
                progress=report,
            )
            job["progress"] = 1.0
            job["status"] = "done"
        except Exception as err:
            logger.exception("Multi-speaker video scan failed")
            job["error"] = f"Video scan failed: {err}"
            job["status"] = "error"
        finally:
            if job_id in scan_jobs:
                scan_finished_at[job_id] = time.time()

    @app.post("/scan-video-speakers", status_code=202)
    def scan_video_speakers(req: VideoSpeakerScanRequest) -> dict[str, str]:
        video_path = resolve_video_path(req.path)
        if not HAS_AVFOUNDATION:
            raise HTTPException(
                status_code=501,
                detail="Video scanning requires macOS AVFoundation/Vision",
            )

        prune_scan_jobs()
        job_id = uuid.uuid4().hex
        job: dict[str, Any] = {"status": "running", "progress": 0.0}
        scan_jobs[job_id] = job
        threading.Thread(
            target=run_scan_job,
            args=(job_id, job, req.model_copy(update={"path": str(video_path)})),
            daemon=True,
        ).start()
        return {"jobId": job_id}

    @app.get("/scan-video-speakers/{job_id}")
    def scan_job_status(job_id: str) -> dict[str, Any]:
        prune_scan_jobs()
        job = scan_jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Unknown scan job")
        if job["status"] != "running":
            # Delivered once; a finished scan holds ~70 thumbnails in memory.
            del scan_jobs[job_id]
            scan_finished_at.pop(job_id, None)
        return dict(job)

    @app.post("/grab-frame")
    async def grab_frame(req: GrabFrameRequest) -> JSONResponse:
        video_path = resolve_video_path(req.path)
        if not HAS_AVFOUNDATION:
            raise HTTPException(
                status_code=501, detail="Frame grabbing requires macOS AVFoundation"
            )

        try:
            data_url = grab_frame_at_time(str(video_path), req.timestampSeconds)
            return JSONResponse({"image": data_url})
        except Exception as err:
            logger.exception("Frame grab failed")
            raise HTTPException(
                status_code=500, detail=f"Frame grab failed: {err}"
            ) from err

    # Serve static assets and SPA
    if dist_dir and dist_dir.is_dir():
        assets_dir = dist_dir / "assets"
        if assets_dir.is_dir():
            app.mount(
                "/assets", HashedAssetFiles(directory=str(assets_dir)), name="assets"
            )

        @app.api_route("/", methods=["GET", "HEAD"])
        async def serve_index() -> FileResponse:
            index_html = dist_dir / "index.html"
            if index_html.is_file():
                # Revalidated every time, so a rebuilt app's new asset names are seen.
                return FileResponse(index_html, headers={"Cache-Control": "no-cache"})
            raise HTTPException(status_code=404, detail="index.html not found in dist")

        @app.api_route("/{path:path}", methods=["GET", "HEAD"])
        async def serve_spa(path: str) -> FileResponse:
            target = resolve_dist_file(dist_dir, path)
            if target is not None:
                return FileResponse(target)
            index_html = dist_dir / "index.html"
            if index_html.is_file():
                return FileResponse(index_html, headers={"Cache-Control": "no-cache"})
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
