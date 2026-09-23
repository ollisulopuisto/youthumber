"""BiRefNet matting: Pixelcut-grade cutout edges, run locally.

Vision's person mask ate fingertips and left a rim of the wall around them; BiRefNet's
edges matched Pixelcut on the same frames (2026-09-23). BiRefNet also keeps everything
in the foreground (mic stand, chair), so Vision still decides *what* is the person and
BiRefNet only decides *where its edge is*.

Two ways to run it, measured on a full-HD frame (2026-09-23):
- PyTorch on the Mac's GPU (Metal/MPS): 0.9 s. PyTorch is installed on macOS only.
- ONNX Runtime on the CPU: 10-14 s. Everywhere else. (CoreML couldn't compile the
  model's deformable convolutions at all.)

Model files are downloaded once, each checked against a pinned SHA-256 and only then
used; any mismatch deletes the file and removal falls back to Vision (fail closed).
The PyTorch model ships its own Python code, which is why it too is pinned by hash.
"""

from __future__ import annotations

import hashlib
import importlib.util
import logging
import os
import sys
import threading
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)

INPUT_SIZE = (1024, 1024)
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)

# How far past Vision's person mask BiRefNet's edge still counts as the person. Vision
# stopped up to ~30 px short of fingertips on 2000 px frames (2026-09-23); 2% of the
# width covers that, while a mic stand or chair further out is dropped.
PERSON_REACH_FRACTION = 0.02
PERSON_THRESHOLD = 64
REACH_WORK_WIDTH = 500


@dataclass(frozen=True)
class ModelFile:
    name: str
    url: str
    sha256: str
    size: int


TORCH_REVISION = "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4"
_HF = f"https://huggingface.co/ZhengPeng7/BiRefNet/resolve/{TORCH_REVISION}"
TORCH_FILES = [
    ModelFile(
        "config.json",
        f"{_HF}/config.json",
        "c97ea21569daf66b205491a4635147dd3bc42c7c168b89d7d75b53f67ef548ae",
        405,
    ),
    ModelFile(
        "BiRefNet_config.py",
        f"{_HF}/BiRefNet_config.py",
        "e7b8c2a74f6cea6a59553d517f71d47f2c1d90e670a13416af17c25fe2f3dc52",
        298,
    ),
    ModelFile(
        "birefnet.py",
        f"{_HF}/birefnet.py",
        "208771ae626f653d64128fbf2d6ac9f8e645c5cc5e286258a73ec3322bbfe5ef",
        91896,
    ),
    ModelFile(
        "model.safetensors",
        f"{_HF}/model.safetensors",
        "9ab37426bf4de0567af6b5d21b16151357149139362e6e8992021b8ce356a154",
        444473596,
    ),
]
ONNX_FILES = [
    ModelFile(
        "birefnet-general.onnx",
        "https://github.com/danielgatis/rembg/releases/download/v0.0.0/"
        "BiRefNet-general-epoch_244.onnx",
        "58f621f00f5d756097615970a88a791584600dcf7c45b18a0a6267535a1ebd3c",
        972666916,
    ),
]


def models_dir() -> Path:
    override = os.environ.get("YOUTHUMBER_MODEL_DIR")
    if override:
        return Path(override)
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "YouThumber" / "models"
    return Path.home() / ".cache" / "youthumber" / "models"


def choose_backend(has_torch: bool) -> str:
    return "torch" if has_torch else "onnx"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


class ModelDownload:
    """Downloads a model's files once, verifying each checksum before any is used."""

    def __init__(self, files: list[ModelFile], directory: Path) -> None:
        self.files, self.directory = files, directory
        self.size_mb = round(sum(f.size for f in files) / 1_000_000)
        self._lock = threading.Lock()
        self._status: str | None = None  # None = not checked yet
        self._progress = 0.0
        self._error: str | None = None
        self._on_ready: list = []

    def on_ready(self, callback) -> None:
        self._on_ready.append(callback)

    def _verified(self, file: ModelFile) -> bool:
        path = self.directory / file.name
        return path.is_file() and _sha256(path) == file.sha256

    def _check_existing(self) -> None:
        # Keyed on content, not on the files merely existing: a half-written or
        # corrupted file must not count as the model.
        if all(self._verified(f) for f in self.files):
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
            threading.Thread(target=self.run, daemon=True).start()

    def _fetch(self, file: ModelFile, done_before: int, total: int) -> None:
        path = self.directory / file.name
        part = path.with_suffix(path.suffix + ".part")
        try:
            digest = hashlib.sha256()
            with urllib.request.urlopen(file.url) as response, part.open("wb") as out:
                done = done_before
                for chunk in iter(lambda: response.read(1 << 20), b""):
                    out.write(chunk)
                    digest.update(chunk)
                    done += len(chunk)
                    with self._lock:
                        self._progress = min(done / total, 0.99)
            if digest.hexdigest() != file.sha256:
                raise ValueError(
                    f"{file.name} failed its checksum; it was deleted and not used"
                )
            part.replace(path)
        finally:
            part.unlink(missing_ok=True)

    def run(self) -> None:
        with self._lock:
            self._status, self._progress, self._error = "downloading", 0.0, None
        total = max(1, sum(f.size for f in self.files))
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            done = 0
            for file in self.files:
                if not self._verified(file):
                    self._fetch(file, done, total)
                done += file.size
            with self._lock:
                self._status, self._progress = "ready", 1.0
            logger.info("Matting model ready in %s", self.directory)
        except Exception as err:
            logger.exception("Matting model download failed")
            with self._lock:
                self._status, self._error = "error", str(err)
            return
        for callback in self._on_ready:
            callback()


def _normalise(pixels: np.ndarray) -> np.ndarray:
    pixels = (pixels - np.array(MEAN, np.float32)) / np.array(STD, np.float32)
    return pixels.transpose(2, 0, 1)[np.newaxis].astype(np.float32)


def prepare_input(image: Image.Image) -> np.ndarray:
    """RGB image → the ONNX export's (1, 3, 1024, 1024) input (scaled by its own max,
    as rembg feeds it)."""
    resized = image.convert("RGB").resize(INPUT_SIZE, Image.Resampling.LANCZOS)
    pixels = np.asarray(resized, dtype=np.float32)
    return _normalise(pixels / max(float(pixels.max()), 1e-6))


def prepare_torch_input(image: Image.Image) -> np.ndarray:
    """RGB image → the PyTorch model's input, scaled 0-1 as in BiRefNet's own inference."""
    resized = image.convert("RGB").resize(INPUT_SIZE, Image.Resampling.BILINEAR)
    return _normalise(np.asarray(resized, dtype=np.float32) / 255.0)


def _to_mask(prediction: np.ndarray, size: tuple[int, int]) -> Image.Image:
    mask = Image.fromarray((np.clip(prediction, 0, 1) * 255).astype(np.uint8), "L")
    return mask.resize(size, Image.Resampling.LANCZOS)


class OnnxMatter:
    """BiRefNet through ONNX Runtime on the CPU; the session loads on first use."""

    def __init__(self, directory: Path) -> None:
        self.path = directory / ONNX_FILES[0].name
        self._session = None
        self._lock = threading.Lock()

    def load(self) -> None:
        with self._lock:
            if self._session is None:
                import onnxruntime as ort

                self._session = ort.InferenceSession(
                    str(self.path), providers=["CPUExecutionProvider"]
                )

    def matte(self, image: Image.Image) -> Image.Image:
        self.load()
        with self._lock:
            name = self._session.get_inputs()[0].name
            logits = self._session.run(None, {name: prepare_input(image)})[0][0, 0]
        prediction = 1 / (1 + np.exp(-logits))
        low, high = float(prediction.min()), float(prediction.max())
        return _to_mask((prediction - low) / max(high - low, 1e-6), image.size)


class TorchMatter:
    """BiRefNet through PyTorch on the Mac's GPU (MPS), CPU if Metal is unavailable.

    Loading takes ~14 s, so it is done once in the background (see ``warm_up``)."""

    def __init__(self, directory: Path) -> None:
        self.directory = directory
        self._model = None
        self._device = "cpu"
        self._lock = threading.Lock()

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            import torch
            from transformers import AutoModelForImageSegmentation

            self._device = "mps" if torch.backends.mps.is_available() else "cpu"
            model = AutoModelForImageSegmentation.from_pretrained(
                str(self.directory), trust_remote_code=True, local_files_only=True
            )
            self._model = model.to(self._device, torch.float32).eval()
            logger.info("BiRefNet loaded on %s", self._device)

    def matte(self, image: Image.Image) -> Image.Image:
        import torch

        self.load()
        with self._lock, torch.no_grad():
            tensor = torch.from_numpy(prepare_torch_input(image)).to(self._device)
            prediction = self._model(tensor)[-1].sigmoid()[0, 0].float().cpu().numpy()
        return _to_mask(prediction, image.size)


def warm_up(matter) -> None:
    """Loads the model in the background so the first cutout doesn't pay for it."""

    def load() -> None:
        try:
            matter.load()
        except Exception:
            logger.exception("Could not load the matting model")

    threading.Thread(target=load, daemon=True).start()


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


BACKEND = choose_backend(has_torch=importlib.util.find_spec("torch") is not None)
if BACKEND == "torch":
    MODEL = ModelDownload(TORCH_FILES, models_dir() / f"birefnet-{TORCH_REVISION[:8]}")
    MATTER: OnnxMatter | TorchMatter = TorchMatter(MODEL.directory)
else:
    MODEL = ModelDownload(ONNX_FILES, models_dir())
    MATTER = OnnxMatter(MODEL.directory)
MODEL.on_ready(lambda: warm_up(MATTER))
