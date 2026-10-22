"""The desktop window opens before the engine has finished loading."""

import http.client
import subprocess
import sys
from pathlib import Path

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
