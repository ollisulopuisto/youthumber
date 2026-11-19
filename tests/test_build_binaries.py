"""The packaged app needs pywebview's injected JS files (api.js, finish.js, ...).

PyInstaller only bundles them when asked to collect the *import* package
``webview``. The distribution name ``pywebview`` is not importable, so
``--collect-all pywebview`` collects nothing (only a build-log warning), and the
frozen app raises FileNotFoundError in get_js_dir when it tries to inject the
bridge: window.pywebview never appears, so the native menus never install and
every bridge feature (video picker, native save) is dead in the packaged build.
"""

import importlib.util
from pathlib import Path


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "build_binaries",
        Path(__file__).resolve().parents[1] / "scripts" / "build_binaries.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _collect_all_args(cmd: list) -> list:
    return [cmd[i + 1] for i, flag in enumerate(cmd) if flag == "--collect-all"]


def test_webview_import_package_is_collected() -> None:
    module = _load_module()
    collected = _collect_all_args(module.pyinstaller_command())
    assert "webview" in collected
    assert "pywebview" not in collected
