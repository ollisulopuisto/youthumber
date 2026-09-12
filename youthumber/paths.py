"""Resource and file path resolution for YouThumber."""

import sys
from pathlib import Path


def get_project_root() -> Path:
    """Returns the project root directory."""
    if getattr(sys, "frozen", False):
        base = getattr(sys, "_MEIPASS", None)
        if base:
            return Path(base)
        return Path(sys.executable).resolve().parent
    # __file__ is in youthumber/paths.py -> parent is youthumber/ -> parent is project root
    return Path(__file__).resolve().parents[1]


def get_dist_dir() -> Path:
    """Returns the path to the built web frontend assets directory."""
    # 1. Check in PyInstaller bundle (sys._MEIPASS) or alongside executable
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            cand = Path(meipass) / "dist"
            if cand.is_dir():
                return cand
        cand = Path(sys.executable).resolve().parent / "dist"
        if cand.is_dir():
            return cand

    # 2. Check next to package in frozen / installed mode
    pkg_dist = Path(__file__).resolve().parent / "dist"
    if pkg_dist.is_dir():
        return pkg_dist

    # 3. Check in project root (development / repository workspace)
    root_dist = get_project_root() / "dist"
    return root_dist


def get_app_icon_path() -> Path | None:
    """Resolves the desktop window / dock icon path."""
    root = get_project_root()
    candidates = (
        root / "public" / "favicon.ico",
        root / "public" / "favicon.png",
        root / "dist" / "favicon.ico",
        root / "dist" / "favicon.png",
    )
    for path in candidates:
        if path.is_file():
            return path
    return None
