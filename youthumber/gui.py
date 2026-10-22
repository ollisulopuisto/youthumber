"""Native macOS desktop window via pywebview and embedded Uvicorn server."""

from __future__ import annotations

import html
import importlib
import logging
import socket
import sys
import threading
import time
from pathlib import Path
from typing import Any

from .paths import get_app_icon_path, get_dist_dir

logger = logging.getLogger(__name__)


def write_data_url_to_path(data_url: str, path: str) -> None:
    """Decodes a base64 data URL and writes its bytes to ``path``."""
    import base64

    _, encoded = data_url.split(",", 1)
    Path(path).write_bytes(base64.b64decode(encoded))


class DesktopApi:
    """Methods exposed to the frontend as ``window.pywebview.api.*``."""

    def save_image(self, data_url: str, filename: str) -> str | None:
        """Asks where to save an exported thumbnail via a native Save dialog, then writes it.

        pywebview ships with downloads disabled, so the browser-style ``<a download>``
        export silently does nothing inside the desktop window. Returns the saved path,
        or None if the user cancelled.
        """
        import webview

        window = webview.windows[0] if webview.windows else None
        if window is None:
            return None

        result = window.create_file_dialog(
            webview.FileDialog.SAVE,
            directory=str(Path.home() / "Downloads"),
            save_filename=filename,
        )
        if not result:
            return None
        path = result if isinstance(result, str) else result[0]
        write_data_url_to_path(data_url, path)
        return path

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


def bind_free_socket(host: str = "127.0.0.1", start_port: int = 8731) -> socket.socket:
    """Binds and listens on the first free TCP port from ``start_port``.

    Listening before the engine is loaded lets the window open on its URL at once: the
    page's first request waits in the socket's backlog until the server takes it.
    """
    port = start_port
    while port < 65535:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind((host, port))
        except OSError:
            sock.close()
            port += 1
            continue
        sock.listen(2048)
        return sock
    raise RuntimeError("No free TCP port found")


class DesktopServer:
    """Embedded Uvicorn server running in a daemon background thread.

    The engine is imported in that thread too: on a cold start its imports (FastAPI,
    numpy, PyObjC) take seconds, and the window doesn't need to wait for them.
    """

    def __init__(self, dist_dir: Path, sock: socket.socket):
        self.dist_dir = dist_dir
        self.sock = sock
        self.host, self.port = sock.getsockname()[:2]
        self.server: Any = None
        self.error: BaseException | None = None
        self._should_exit = False
        self.thread = threading.Thread(target=self._run, daemon=True)

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def _run(self) -> None:
        try:
            import uvicorn

            from .server import create_app

            config = uvicorn.Config(
                app=create_app(dist_dir=self.dist_dir),
                log_level="warning",
                access_log=False,
            )
            self.server = uvicorn.Server(config)
            self.server.should_exit = self._should_exit
            self.server.run(sockets=[self.sock])
        except BaseException as err:  # reported by wait_until_ready
            logger.exception("Engine failed to start")
            self.error = err

    def start(self) -> None:
        self.thread.start()

    def wait_until_ready(self, timeout: float = 5.0) -> bool:
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.server is not None and self.server.started:
                return True
            if self.error is not None or not self.thread.is_alive():
                return False
            time.sleep(0.02)
        return False

    def stop(self) -> None:
        self._should_exit = True
        if self.server is not None:
            self.server.should_exit = True


def preload_frameworks() -> None:
    """Imports the macOS frameworks the engine uses, so the first cutout, texture or
    video scan doesn't pay for it. The engine only checks for them at startup (importing
    them took ~9 s after a reboot), so this runs once the page is up."""
    for name in ("Quartz", "Vision", "AVFoundation", "CoreMedia"):
        try:
            importlib.import_module(name)
        except ImportError:
            pass


STARTUP_FAILED_HTML = """
<html>
    <body style="background:#030712;color:#f3f4f6;font-family:sans-serif;padding:40px;text-align:center;">
        <h2>YouThumber's engine didn't start</h2>
        <p>{error}</p>
    </body>
</html>
"""


def launch_gui(
    dist_dir: Path | None = None,
    target_url: str | None = None,
    host: str = "127.0.0.1",
    port: int = 8731,
    debug: bool = False,
) -> None:
    """Launches the embedded FastAPI server and opens a native desktop window.

    The window opens straight away, while the engine loads in the background; its page
    request is answered as soon as the engine is up.
    """
    if dist_dir is None:
        dist_dir = get_dist_dir()

    server = DesktopServer(dist_dir, bind_free_socket(host, port))
    server.start()

    import webview

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

    def watch_startup() -> None:
        # The first start after a reboot imports for several seconds; give it time.
        if not server.wait_until_ready(timeout=60.0):
            server.stop()
            server.sock.close()  # refuses the waiting page request instead of hanging
            error = server.error or "Timed out while starting."
            window.load_html(STARTUP_FAILED_HTML.format(error=html.escape(str(error))))
            return
        window.events.loaded.wait(timeout=30.0)
        preload_frameworks()

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
        webview.start(func=watch_startup, debug=debug)
    finally:
        server.stop()
        server.thread.join(timeout=2.0)
