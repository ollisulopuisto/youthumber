"""Creates ~/Applications/YouThumber.app: a dev launcher for this checkout.

`uv run youthumber` is a plain `python` process, so macOS shows "python" in the menu bar
and a generic icon in the Dock and ⌘-Tab. This builds a real app bundle with the
YouThumber name, icon and bundle id whose executable runs `uv run youthumber` in this
repo, so it can be started from Finder, Spotlight or the Dock.

Run: ``uv run python scripts/make_launcher.py`` (again after moving the repo).
Output from the app goes to ~/Library/Logs/YouThumber.log.
"""

from __future__ import annotations

import plistlib
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Callable
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUNDLE_ID = "io.github.ollisulopuisto.youthumber"
LSREGISTER = (
    "/System/Library/Frameworks/CoreServices.framework/Frameworks/"
    "LaunchServices.framework/Support/lsregister"
)


def _version() -> str:
    for line in (ROOT / "pyproject.toml").read_text().splitlines():
        if line.startswith("version"):
            return line.split('"')[1]
    return "0"


def c_string(text: str) -> str:
    """A C string literal for ``text``."""
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def launcher_source(repo: Path, uv: Path) -> str:
    """C source of the bundle's executable.

    A shell script as the executable was refused by LaunchServices (error -10669 on
    macOS 15, 2026-09-23); a compiled one opens. Finder starts apps with a bare PATH, so
    uv and the repo are absolute, and ``exec`` keeps the process macOS knows as
    YouThumber.app (its Dock icon, name and ⌘-Tab entry).
    """
    return f"""#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <unistd.h>

int main(void) {{
    const char *home = getenv("HOME");
    char path[4096];
    if (home) {{
        snprintf(path, sizeof path, "%s/Library/Logs", home);
        mkdir(path, 0755);
        snprintf(path, sizeof path, "%s/Library/Logs/YouThumber.log", home);
        int log = open(path, O_WRONLY | O_CREAT | O_APPEND, 0644);
        if (log >= 0) {{
            dup2(log, 1);
            dup2(log, 2);
        }}
    }}
    if (chdir({c_string(str(repo))}) != 0) {{
        perror("YouThumber: cannot open the repo");
        return 1;
    }}
    execl({c_string(str(uv))}, "uv", "run", "youthumber", (char *)NULL);
    perror("YouThumber: cannot run uv");
    return 1;
}}
"""


def compile_with_clang(source: str, output: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        c_file = Path(tmp) / "launcher.c"
        c_file.write_text(source)
        subprocess.run(["clang", "-O2", "-o", str(output), str(c_file)], check=True)


def build_launcher(
    app: Path,
    repo: Path,
    uv: Path,
    compile_fn: Callable[[str, Path], None] = compile_with_clang,
) -> Path:
    contents = app / "Contents"
    (contents / "MacOS").mkdir(parents=True, exist_ok=True)
    (contents / "Resources").mkdir(parents=True, exist_ok=True)

    info = {
        "CFBundleName": "YouThumber",
        "CFBundleDisplayName": "YouThumber",
        "CFBundleIdentifier": BUNDLE_ID,
        "CFBundleExecutable": "YouThumber",
        "CFBundleIconFile": "YouThumber",
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": _version(),
        "LSMinimumSystemVersion": "12.0",
        "NSHighResolutionCapable": True,
    }
    (contents / "Info.plist").write_bytes(plistlib.dumps(info))
    shutil.copyfile(
        ROOT / "assets" / "YouThumber.icns", contents / "Resources" / "YouThumber.icns"
    )
    compile_fn(launcher_source(repo, uv), contents / "MacOS" / "YouThumber")
    return app


def main() -> None:
    if sys.platform != "darwin":
        sys.exit("The launcher is a macOS app bundle; nothing to do here.")
    uv = shutil.which("uv")
    if not uv:
        sys.exit("uv not found on PATH")
    target = Path.home() / "Applications" / "YouThumber.app"
    if target.exists():
        shutil.rmtree(target)
    app = build_launcher(target, repo=ROOT, uv=Path(uv).resolve())
    # Tell LaunchServices about the (new) bundle so Finder and the Dock pick up the icon.
    subprocess.run([LSREGISTER, "-f", str(app)], check=False)
    print(f"Created {app}")
    print("Open it from Finder or Spotlight; drag it to the Dock to keep it there.")


if __name__ == "__main__":
    main()
