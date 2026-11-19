"""The desktop window opens before the engine has finished loading."""

import http.client
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from youthumber.gui import DesktopServer, bind_free_socket
from youthumber.server import create_app


def test_importing_the_engine_leaves_the_macos_frameworks_for_later() -> None:
    # After a reboot these imports took ~9 s and kept the window from opening.
    script = (
        "import sys, youthumber.server\n"
        "print([m for m in ('Quartz', 'Vision', 'AVFoundation', 'CoreMedia')"
        " if m in sys.modules])\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", script], capture_output=True, text=True, check=True
    )
    assert result.stdout.strip() == "[]"


class _MissingModel:
    def state(self) -> dict:
        return {"status": "missing", "progress": 0.0, "error": None}


def test_a_request_made_before_the_server_is_up_is_answered(
    tmp_path: Path, monkeypatch
) -> None:
    # The server's startup would otherwise check (and load) a real downloaded model.
    monkeypatch.setattr("youthumber.server.MODEL", _MissingModel())
    (tmp_path / "index.html").write_text("<html>hello</html>")
    sock = bind_free_socket("127.0.0.1", 18731)
    port = sock.getsockname()[1]

    # The window asks for the page as soon as it opens, before the engine is loaded.
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
    conn.connect()
    server = DesktopServer(tmp_path, sock)
    server.start()
    try:
        conn.request("GET", "/")
        response = conn.getresponse()
        assert response.status == 200
        assert response.read() == b"<html>hello</html>"
        assert server.wait_until_ready(timeout=30)
    finally:
        conn.close()
        server.stop()
        server.thread.join(timeout=5)


def test_bind_free_socket_skips_a_port_in_use() -> None:
    first = bind_free_socket("127.0.0.1", 18831)
    try:
        second = bind_free_socket("127.0.0.1", first.getsockname()[1])
        assert second.getsockname()[1] > first.getsockname()[1]
        second.close()
    finally:
        first.close()


def _script_src(client: TestClient) -> str:
    csp = client.get("/").headers["content-security-policy"]
    return next(
        d.strip() for d in csp.split(";") if d.strip().startswith("script-src")
    )


def test_the_desktop_csp_allows_pywebviews_eval_based_bridge(tmp_path: Path) -> None:
    """pywebview's window.evaluate_js wraps the script in eval() by design (to
    return the last value), and its whole DOM element API is built on that. A
    script-src without 'unsafe-eval' kills the packaged app's bridge with a CSP
    EvalError (19.3 field report, 2026-11-19). Only eval is relaxed; script
    loading stays same-origin."""
    script_src = _script_src(TestClient(create_app(dist_dir=tmp_path, desktop=True)))
    assert "'unsafe-eval'" in script_src
    assert "'self'" in script_src


def test_the_browser_csp_keeps_eval_refused(tmp_path: Path) -> None:
    """The headless server has no pywebview bridge, so its CSP refuses eval:
    'unsafe-eval' is relaxed only for the desktop window, not for every page
    the server serves (review on #128, 2026-11-20)."""
    script_src = _script_src(TestClient(create_app(dist_dir=tmp_path)))
    assert "'unsafe-eval'" not in script_src
    assert "'self'" in script_src


def test_main_calls_multiprocessing_freeze_support(monkeypatch) -> None:
    """multiprocessing spawn re-executes the frozen macOS binary with
    `-c from multiprocessing.resource_tracker import main;...` arguments;
    without freeze_support() argparse rejects them and the child dies
    (19.3 field report, 2026-11-19)."""
    import multiprocessing

    import youthumber.__main__ as entry

    calls = []
    monkeypatch.setattr(
        multiprocessing, "freeze_support", lambda: calls.append(True)
    )
    with pytest.raises(SystemExit) as exc_info:
        entry.main(["--help"])
    assert exc_info.value.code == 0
    assert calls == [True]


def test_the_desktop_server_marks_its_app_desktop(monkeypatch) -> None:
    """The GUI's own server is the one the pywebview window loads, so it is
    the one that needs the eval-relaxed CSP."""
    import uvicorn

    from youthumber import gui

    seen = {}
    monkeypatch.setattr(
        "youthumber.server.create_app",
        lambda **kwargs: seen.update(kwargs) or object(),
    )

    class _Config:
        def __init__(self, **_kwargs) -> None:
            pass

    class _Server:
        should_exit = False

        def __init__(self, _config) -> None:
            pass

        def run(self, sockets=None) -> None:
            pass

    monkeypatch.setattr(uvicorn, "Config", _Config)
    monkeypatch.setattr(uvicorn, "Server", _Server)
    server = gui.DesktopServer.__new__(gui.DesktopServer)
    server.dist_dir = Path("/nonexistent")
    server._run()
    assert seen.get("desktop") is True


def test_hashed_assets_are_cached_and_the_page_is_revalidated(tmp_path: Path) -> None:
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log(1)")
    (tmp_path / "index.html").write_text("<html></html>")
    client = TestClient(create_app(dist_dir=tmp_path))

    asset = client.get("/assets/index-abc123.js")
    assert asset.status_code == 200
    assert "immutable" in asset.headers["cache-control"]
    assert client.get("/").headers["cache-control"] == "no-cache"
    assert client.get("/some/spa/route").headers["cache-control"] == "no-cache"
