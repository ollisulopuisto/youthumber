"""BiRefNet matting: Pixelcut-grade cutout edges, run locally with ONNX Runtime.

Vision's person mask ate fingertips and left a rim of the wall around them; BiRefNet's
edges matched Pixelcut on the same frames (2026-09-23). BiRefNet also keeps everything
in the foreground (mic stand, chair), so Vision still decides *what* is the person and
BiRefNet only decides *where its edge is*.

The model (973 MB) is downloaded once, checked against a pinned SHA-256, and only then
used; any mismatch deletes it and falls back to Vision (fail closed).
"""

from __future__ import annotations

import hashlib
import logging
import os
import sys
import threading
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)

MODEL_URL = (
    "https://github.com/danielgatis/rembg/releases/download/v0.0.0/"
    "BiRefNet-general-epoch_244.onnx"
)
MODEL_SHA256 = "58f621f00f5d756097615970a88a791584600dcf7c45b18a0a6267535a1ebd3c"
MODEL_FILENAME = "birefnet-general.onnx"
INPUT_SIZE = (1024, 1024)
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)

# How far past Vision's person mask BiRefNet's edge still counts as the person. Vision
# stopped up to ~30 px short of fingertips on 2000 px frames (2026-09-23); 2% of the
# width covers that, while a mic stand or chair further out is dropped.
PERSON_REACH_FRACTION = 0.02
PERSON_THRESHOLD = 64
REACH_WORK_WIDTH = 500


def model_path() -> Path:
    override = os.environ.get("YOUTHUMBER_MODEL_DIR")
    if override:
        base = Path(override)
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "YouThumber" / "models"
    else:
        base = Path.home() / ".cache" / "youthumber" / "models"
    return base / MODEL_FILENAME


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


class ModelDownload:
    """Downloads the model once, verifying its checksum before it is ever used."""

    def __init__(self, url: str, sha256: str, path: Path) -> None:
        self.url, self.sha256, self.path = url, sha256, path
        self._lock = threading.Lock()
        self._status: str | None = None  # None = not checked yet
        self._progress = 0.0
        self._error: str | None = None
        self._thread: threading.Thread | None = None

    def _check_existing(self) -> None:
        # Keyed on content, not on the file merely existing: a half-written or
        # corrupted file must not count as the model.
        if self.path.is_file() and _sha256(self.path) == self.sha256:
            self._status, self._progress = "ready", 1.0
        else:
            self._status = "missing"

    def state(self) -> dict[str, Any]:
        with self._lock:
            if self._status is None:
                self._check_existing()
            return {
                "status": self._status,
                "progress": self._progress,
                "error": self._error,
            }

    def start(self) -> None:
        """Starts the download in a background thread unless ready or already running."""
        with self._lock:
            if self._status is None:
                self._check_existing()
            if self._status in ("ready", "downloading"):
                return
            self._status, self._progress, self._error = "downloading", 0.0, None
            self._thread = threading.Thread(target=self.run, daemon=True)
            self._thread.start()

    def run(self) -> None:
        with self._lock:
            self._status, self._progress, self._error = "downloading", 0.0, None
        part = self.path.with_suffix(self.path.suffix + ".part")
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256()
            with urllib.request.urlopen(self.url) as response, part.open("wb") as out:
                total = int(response.headers.get("Content-Length") or 0)
                done = 0
                for chunk in iter(lambda: response.read(1 << 20), b""):
                    out.write(chunk)
                    digest.update(chunk)
                    done += len(chunk)
                    if total:
                        with self._lock:
                            self._progress = min(done / total, 0.99)
            if digest.hexdigest() != self.sha256:
                raise ValueError(
                    "Downloaded model failed its checksum; it was deleted and not used"
                )
            part.replace(self.path)
            with self._lock:
                self._status, self._progress = "ready", 1.0
            logger.info("Matting model ready at %s", self.path)
        except Exception as err:
            logger.exception("Matting model download failed")
            part.unlink(missing_ok=True)
            with self._lock:
                self._status, self._error = "error", str(err)


def prepare_input(image: Image.Image) -> np.ndarray:
    """RGB image → BiRefNet's (1, 3, 1024, 1024) input, normalised as in training."""
    resized = image.convert("RGB").resize(INPUT_SIZE, Image.Resampling.LANCZOS)
    pixels = np.asarray(resized, dtype=np.float32)
    pixels = pixels / max(float(pixels.max()), 1e-6)
    pixels = (pixels - np.array(MEAN, np.float32)) / np.array(STD, np.float32)
    return pixels.transpose(2, 0, 1)[np.newaxis].astype(np.float32)


class Matter:
    """Runs BiRefNet on an image; the ONNX session is loaded once, on first use."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._session = None
        self._lock = threading.Lock()

    def matte(self, image: Image.Image) -> Image.Image:
        with self._lock:
            if self._session is None:
                import onnxruntime as ort

                self._session = ort.InferenceSession(
                    str(self.path), providers=["CPUExecutionProvider"]
                )
            session = self._session
            name = session.get_inputs()[0].name
            logits = session.run(None, {name: prepare_input(image)})[0][0, 0]
        prediction = 1 / (1 + np.exp(-logits))
        low, high = float(prediction.min()), float(prediction.max())
        prediction = (prediction - low) / max(high - low, 1e-6)
        mask = Image.fromarray((prediction * 255).astype(np.uint8), mode="L")
        return mask.resize(image.size, Image.Resampling.LANCZOS)


def combine_masks(
    matte: Image.Image,
    person: Image.Image,
    keep_points: list[tuple[float, float]],
) -> tuple[Image.Image, Image.Image]:
    """Returns (person_only, with_objects) masks.

    ``person_only`` is BiRefNet's matte kept only near Vision's person (after its stray
    blobs are dropped and detected hands kept); ``with_objects`` is the whole matte,
    stand and chair included, for the "Keep objects" toggle.
    """
    from .segmentation import keep_largest_region

    matte = matte.convert("L")
    core = keep_largest_region(person.convert("L"), keep_points=keep_points)
    # Grown on a small copy: a max filter the size of the reach took ~15 s at 2000 px.
    scale = min(1.0, REACH_WORK_WIDTH / matte.width)
    small = core.resize(
        (max(1, round(matte.width * scale)), max(1, round(matte.height * scale))),
        Image.Resampling.BILINEAR,
    )
    reach = max(1, round(small.width * PERSON_REACH_FRACTION))
    near = (
        small.point(lambda v: 255 if v > PERSON_THRESHOLD else 0)
        .filter(ImageFilter.MaxFilter(2 * reach + 1))
        .resize(matte.size, Image.Resampling.BILINEAR)
        .filter(ImageFilter.GaussianBlur(1.0))
    )
    kept = np.asarray(matte, np.float32) * np.asarray(near, np.float32) / 255.0
    person_only = Image.fromarray(np.round(kept).astype(np.uint8), mode="L")
    return person_only, matte


MODEL = ModelDownload(MODEL_URL, MODEL_SHA256, model_path())
MATTER = Matter(model_path())
