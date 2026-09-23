"""Native macOS desktop window via pywebview and embedded Uvicorn server."""

from __future__ import annotations

import logging
import socket
import sys
import threading
import time
from pathlib import Path
from typing import Any

import uvicorn

from .paths import get_app_icon_path, get_dist_dir
from .server import create_app

logger = logging.getLogger(__name__)


class DesktopApi:
    """Methods exposed to the frontend as ``window.pywebview.api.*``."""

    def pick_video_file(self) -> str | None:
        """Opens a native file dialog and returns the selected video's absolute path, or None."""
        import webview

        window = webview.windows[0] if webview.windows else None
        if window is None:
            return None

        result = window.create_file_dialog(
            webview.FileDialog.OPEN,
            allow_multiple=False,
            file_types=("Video Files (*.mp4;*.mov;*.m4v)", "All files (*.*)"),
        )
        if not result:
            return None
        return result[0]


def find_free_port(start_port: int = 8731) -> int:
    """Finds an available TCP port starting from start_port."""
    port = start_port
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                port += 1
    raise RuntimeError("No free TCP port found")


class DesktopServer:
    """Embedded Uvicorn server running in a daemon background thread."""

    def __init__(self, app: Any, host: str = "127.0.0.1", port: int = 8731):
        self.host = host
        self.port = port
        self.config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            log_level="warning",
            access_log=False,
        )
        self.server = uvicorn.Server(self.config)
        self.thread = threading.Thread(target=self.server.run, daemon=True)

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def start(self) -> None:
        self.thread.start()

    def wait_until_ready(self, timeout: float = 5.0) -> bool:
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.server.started:
                return True
            time.sleep(0.02)
        return False

    def stop(self) -> None:
        self.server.should_exit = True


def launch_gui(
    dist_dir: Path | None = None,
    target_url: str | None = None,
    host: str = "127.0.0.1",
    port: int = 8731,
    debug: bool = False,
) -> None:
    """Launches the embedded FastAPI server and opens a native desktop window."""
    import webview

    if dist_dir is None:
        dist_dir = get_dist_dir()

    app = create_app(dist_dir=dist_dir)
    free_port = find_free_port(port)
    server = DesktopServer(app, host=host, port=free_port)
    server.start()

    if not server.wait_until_ready(timeout=8.0):
        server.stop()
        raise RuntimeError("FastAPI server initialization timed out")

    url_to_open = target_url if target_url else server.url

    window = webview.create_window(
        title="YouThumber",
        url=url_to_open,
        width=1360,
        height=880,
        min_size=(1024, 700),
        background_color="#030712",
        js_api=DesktopApi(),
    )

    def on_closed() -> None:
        server.stop()

    window.events.closed += on_closed

    icon_path = get_app_icon_path()
    icon_str = str(icon_path) if icon_path else None

    if sys.platform == "darwin" and icon_str:
        try:
            import AppKit

            ns_img = AppKit.NSImage.alloc().initByReferencingFile_(icon_str)
            if ns_img and ns_img.isValid():
                AppKit.NSApplication.sharedApplication().setApplicationIconImage_(
                    ns_img
                )
        except (AttributeError, RuntimeError, OSError) as err:
            logger.debug("Could not set application dock icon: %s", err)

    try:
        webview.start(debug=debug)
    finally:
        server.stop()
        server.thread.join(timeout=2.0)
