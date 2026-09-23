"""Build script for YouThumber standalone desktop binaries.

Packages the React/Vite web studio and FastAPI backend into standalone
executables / application bundles using PyInstaller.
"""

from __future__ import annotations

import argparse
import platform
import plistlib
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"
RELEASE_DIR = ROOT_DIR / "release"
BUNDLE_ID = "io.github.ollisulopuisto.youthumber"
MODEL_PACKAGES = [
    "torchvision",
    "timm",
    "kornia",
    "einops",
    "transformers",
    "safetensors",
]
# Drawn by scripts/make_icon.py. PyInstaller converts the PNG for Windows/Linux.
APP_ICON = (
    ROOT_DIR / "assets" / "YouThumber.icns"
    if sys.platform == "darwin"
    else ROOT_DIR / "public" / "favicon.png"
)


def build_frontend() -> None:
    """Ensures frontend assets in dist/ are built and up to date."""
    print("==> Building frontend web studio via Vite...")
    npm_cmd = shutil.which("npm")
    if not npm_cmd:
        raise RuntimeError("npm is required to build the frontend assets.")
    subprocess.run([npm_cmd, "run", "build"], cwd=ROOT_DIR, check=True)
    if not (DIST_DIR / "index.html").is_file():
        raise RuntimeError(f"Build failed: {DIST_DIR / 'index.html'} not found.")
    print("✓ Frontend build complete.")


def project_version() -> str:
    with (ROOT_DIR / "pyproject.toml").open("rb") as f:
        return tomllib.load(f)["project"]["version"]


def stamp_version(app: Path) -> None:
    """Puts the CalVer version in Info.plist (PyInstaller leaves 0.0.0) and re-signs,
    since editing the plist invalidates PyInstaller's ad-hoc signature."""
    plist_path = app / "Contents" / "Info.plist"
    info = plistlib.loads(plist_path.read_bytes())
    info["CFBundleShortVersionString"] = project_version()
    info["CFBundleVersion"] = project_version()
    plist_path.write_bytes(plistlib.dumps(info))
    subprocess.run(["codesign", "--force", "--deep", "-s", "-", str(app)], check=True)


def run_pyinstaller() -> None:
    """Executes PyInstaller to create the standalone desktop bundle."""
    print("==> Packaging desktop application with PyInstaller...")

    data_separator = ";" if sys.platform == "win32" else ":"
    data_arg = f"{DIST_DIR}{data_separator}dist"

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name",
        "YouThumber",
        "--noconfirm",
        "--clean",
        "--icon",
        str(APP_ICON),
        "--distpath",
        str(RELEASE_DIR),
        "--add-data",
        data_arg,
        "--collect-all",
        "pywebview",
        "--collect-all",
        "uvicorn",
        "--collect-all",
        "fastapi",
        "--collect-all",
        "starlette",
        "--collect-all",
        "PIL",
        "--hidden-import",
        "uvicorn.logging",
        "--hidden-import",
        "uvicorn.loops",
        "--hidden-import",
        "uvicorn.loops.auto",
        "--hidden-import",
        "uvicorn.protocols",
        "--hidden-import",
        "uvicorn.protocols.http",
        "--hidden-import",
        "uvicorn.protocols.http.auto",
        "--hidden-import",
        "uvicorn.lifespan",
        "--hidden-import",
        "uvicorn.lifespan.on",
        "--hidden-import",
        "webview",
    ]

    if sys.platform == "darwin":
        cmd.extend(
            [
                "--windowed",
                "--osx-bundle-identifier",
                BUNDLE_ID,
                "--hidden-import",
                "webview.platforms.cocoa",
                "--hidden-import",
                "Vision",
                "--hidden-import",
                "Quartz",
                "--hidden-import",
                "Foundation",
                "--hidden-import",
                "AVFoundation",
                "--hidden-import",
                "CoreMedia",
            ]
        )
        # BiRefNet's model code is loaded at runtime (see youthumber/matting.py), so
        # PyInstaller can't see what it imports; bundle those packages whole. Without
        # this the app ran but every cutout failed: "torchvision::nms does not exist",
        # "No module named 'kornia'" (2026-09-23). `--self-test` checks for them.
        for package in MODEL_PACKAGES:
            cmd.extend(["--collect-all", package])
    elif sys.platform == "win32":
        cmd.extend(
            [
                "--windowed",
                "--hidden-import",
                "webview.platforms.winforms",
            ]
        )
    else:  # Linux
        cmd.extend(
            [
                "--onedir",
                "--hidden-import",
                "webview.platforms.gtk",
                "--hidden-import",
                "webview.platforms.qt",
            ]
        )

    cmd.append(str(ROOT_DIR / "launcher.py"))

    subprocess.run(cmd, cwd=ROOT_DIR, check=True)

    if sys.platform == "darwin":
        stamp_version(RELEASE_DIR / "YouThumber.app")
    print("✓ PyInstaller build complete.")


def create_archive() -> Path:
    """Creates a compressed archive of the packaged application."""
    print("==> Creating release archive...")
    arch = platform.machine().lower()
    os_name = sys.platform

    if os_name == "darwin":
        app_path = RELEASE_DIR / "YouThumber.app"
        zip_base = RELEASE_DIR / f"YouThumber-macOS-{arch}"
        if not app_path.exists():
            raise FileNotFoundError(f"Expected {app_path} to exist.")
        # Zip macOS .app bundle preserving symlinks and permissions
        zip_path = Path(f"{zip_base}.zip")
        if zip_path.exists():
            zip_path.unlink()
        subprocess.run(
            [
                "ditto",
                "-c",
                "-k",
                "--sequesterRsrc",
                "--keepParent",
                str(app_path),
                str(zip_path),
            ],
            check=True,
        )
        print(f"✓ Created macOS archive: {zip_path}")
        return zip_path
    elif os_name == "win32":
        folder_path = RELEASE_DIR / "YouThumber"
        zip_base = RELEASE_DIR / f"YouThumber-Windows-{arch}"
        archive = shutil.make_archive(str(zip_base), "zip", root_dir=folder_path)
        print(f"✓ Created Windows archive: {archive}")
        return Path(archive)
    else:
        folder_path = RELEASE_DIR / "YouThumber"
        tar_base = RELEASE_DIR / f"YouThumber-Linux-{arch}"
        archive = shutil.make_archive(str(tar_base), "gztar", root_dir=folder_path)
        print(f"✓ Created Linux archive: {archive}")
        return Path(archive)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build YouThumber standalone binaries."
    )
    parser.add_argument(
        "--skip-frontend",
        action="store_true",
        help="Skip rebuilding frontend assets with npm",
    )
    parser.add_argument(
        "--skip-archive",
        action="store_true",
        help="Skip compressing into release zip/tar archive",
    )
    args = parser.parse_args()

    if not args.skip_frontend:
        build_frontend()

    run_pyinstaller()

    if not args.skip_archive:
        create_archive()

    print("\n🎉 All binary packaging steps completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
