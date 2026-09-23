"""Checks that this install (source or packaged app) has everything it needs.

Run: ``youthumber --self-test`` (exit code 1 on any problem). CI runs it against the
built app: the first packaged build passed CI but couldn't cut anything out, because
BiRefNet's own code (loaded at runtime) imports kornia and torchvision's compiled ops,
which PyInstaller never saw (2026-09-23). No model download is needed.
"""

from __future__ import annotations

import importlib
import sys

from .matting import BACKEND

# What BiRefNet's model code (birefnet.py, pinned in matting.TORCH_FILES) imports.
TORCH_MODULES = [
    "torch",
    "torchvision.ops",
    "torchvision.models",
    "timm.layers",
    "kornia.filters",
    "einops",
    "transformers",
    "safetensors.torch",
]
ONNX_MODULES = ["onnxruntime"]
MAC_MODULES = ["Vision", "Quartz", "AVFoundation", "CoreMedia", "AppKit", "webview"]


def _import(name: str, problems: list[str]) -> object | None:
    try:
        return importlib.import_module(name)
    except Exception as err:  # noqa: BLE001 - report any failure, don't crash
        problems.append(f"{name}: {err}")
        return None


def run() -> list[str]:
    problems: list[str] = []
    if sys.platform == "darwin":
        for name in MAC_MODULES:
            _import(name, problems)

    if BACKEND == "torch":
        modules = {name: _import(name, problems) for name in TORCH_MODULES}
        ops = modules.get("torchvision.ops")
        torch = modules.get("torch")
        if ops is not None and torch is not None:
            # Compiled ops load separately from the Python package; this is what failed.
            try:
                boxes = torch.tensor([[0.0, 0.0, 1.0, 1.0]])
                ops.nms(boxes, torch.tensor([1.0]), 0.5)
                ops.deform_conv2d(
                    torch.zeros(1, 1, 3, 3),
                    torch.zeros(1, 18, 3, 3),
                    torch.zeros(1, 1, 3, 3),
                    padding=1,
                )
            except Exception as err:  # noqa: BLE001 - report any failure, don't crash
                problems.append(f"torchvision compiled ops: {err}")
        transformers = modules.get("transformers")
        if transformers is not None:
            try:
                transformers.AutoModelForImageSegmentation  # noqa: B018
                transformers.PreTrainedModel  # noqa: B018
            except Exception as err:  # noqa: BLE001 - report any failure, don't crash
                problems.append(f"transformers model classes: {err}")
    else:
        for name in ONNX_MODULES:
            _import(name, problems)
    return problems


def main() -> int:
    problems = run()
    if problems:
        print("Self-test FAILED:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print(f"Self-test OK (matting backend: {BACKEND})")
    return 0
