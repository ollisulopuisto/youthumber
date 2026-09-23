"""The dev launcher: a real macOS app bundle that runs `uv run youthumber` in the repo,
so the Dock, ⌘-Tab and the menu bar show YouThumber instead of "python"."""

import importlib.util
import plistlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _launcher():
    spec = importlib.util.spec_from_file_location(
        "make_launcher", ROOT / "scripts" / "make_launcher.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["make_launcher"] = module
    spec.loader.exec_module(module)
    return module


def _fake_compile(source: str, output: Path) -> None:
    output.write_text(source)  # stands in for clang in tests


def _build(tmp_path):
    return _launcher().build_launcher(
        tmp_path / "YouThumber.app",
        repo=Path('/repo "dir"'),
        uv=Path("/opt/my bin/uv"),
        compile_fn=_fake_compile,
    )


def test_bundle_has_name_icon_and_identifier(tmp_path) -> None:
    app = _build(tmp_path)

    info = plistlib.loads((app / "Contents" / "Info.plist").read_bytes())
    assert info["CFBundleName"] == "YouThumber"
    assert info["CFBundleExecutable"] == "YouThumber"
    assert info["CFBundleIconFile"] == "YouThumber"
    assert info["CFBundleIdentifier"].endswith("youthumber")
    assert (app / "Contents" / "Resources" / "YouThumber.icns").is_file()
    assert (app / "Contents" / "MacOS" / "YouThumber").is_file()


def test_executable_runs_the_repo_with_absolute_paths() -> None:
    # A script as the bundle executable is refused by LaunchServices (-10669, macOS
    # 15, 2026-09-23), so it's a tiny C program. Finder gives apps a bare PATH, so uv
    # and the repo are baked in; exec keeps the process macOS knows as YouThumber.app.
    source = _launcher().launcher_source(
        repo=Path('/repo "dir"'), uv=Path("/opt/my bin/uv")
    )

    assert 'chdir("/repo \\"dir\\"")' in source
    assert 'execl("/opt/my bin/uv", "uv", "run", "youthumber", (char *)NULL)' in source
    assert "Library/Logs/YouThumber.log" in source


def test_c_string_escapes_quotes_and_backslashes() -> None:
    assert _launcher().c_string('a"b\\c') == '"a\\"b\\\\c"'
