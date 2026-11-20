"""Native macOS desktop window via pywebview and embedded Uvicorn server."""

from __future__ import annotations

import html
import importlib
import json
import logging
import socket
import sys
import threading
import time
from pathlib import Path
from typing import Any

from . import diagnostics, native_menu
from .paths import get_app_icon_path, get_dist_dir, get_user_data_dir

logger = logging.getLogger(__name__)


def write_data_url_to_path(data_url: str, path: str) -> None:
    """Decodes a base64 data URL and writes its bytes to ``path``."""
    import base64

    _, encoded = data_url.split(",", 1)
    Path(path).write_bytes(base64.b64decode(encoded))


def write_data_url_unique(data_url: str, path: str) -> str:
    """Writes the data URL to the first free " (n)" name next to ``path`` and returns it.

    The file is created exclusively, so a name another process took a moment ago is
    skipped instead of overwritten.
    """
    import base64

    _, encoded = data_url.split(",", 1)
    data = base64.b64decode(encoded)
    p = Path(path)
    n = 2
    while True:
        candidate = p.with_name(f"{p.stem} ({n}){p.suffix}")
        try:
            with open(candidate, "xb") as f:
                f.write(data)
        except FileExistsError:
            n += 1
            continue
        return str(candidate)


class DesktopApi:
    """Methods exposed to the frontend as ``window.pywebview.api.*``."""

    def __init__(self) -> None:
        #: Paths the Save panel returned that already exist, waiting for the page's
        #: Replace / Keep both answer. ``save_image_to`` writes nowhere else.
        self._pending: set[str] = set()

    def save_image(self, data_url: str, filename: str) -> dict[str, str]:
        """Asks where to save an exported thumbnail via a native Save dialog, then writes it.

        pywebview ships with downloads disabled, so the browser-style ``<a download>``
        export silently does nothing inside the desktop window. Never raises: an error
        raised here reached the page as nothing at all, so every outcome is a result,
        ``{"status": "saved" | "cancelled" | "exists" | "error", "path"?, "message"?}``.
        ``exists`` means the chosen file is already there; the page asks, then calls
        ``save_image_to``.
        """
        try:
            import webview

            window = webview.windows[0] if webview.windows else None
            if window is None:
                return {"status": "error", "message": "The app window is not ready."}

            result = window.create_file_dialog(
                webview.FileDialog.SAVE,
                directory=str(Path.home() / "Downloads"),
                save_filename=filename,
            )
            if not result:
                return {"status": "cancelled"}
            path = str(result if isinstance(result, str) else result[0])
            if Path(path).exists():
                self._pending.add(path)
                return {"status": "exists", "path": path}
            return self._write(data_url, path)
        except Exception as e:  # noqa: BLE001 - the page must hear about any failure, never silence
            logger.exception("save_image failed")
            return {"status": "error", "message": f"Could not save the export: {e}"}

    def save_image_to(self, data_url: str, path: str, mode: str) -> dict[str, str]:
        """Finishes an export whose file existed. ``mode``: ``replace`` or ``keep_both``
        (writes ``name (2).jpg`` beside it). Only a path ``save_image`` returned as
        ``exists`` is accepted."""
        if path not in self._pending:
            return {"status": "error", "message": "That export is no longer waiting."}
        self._pending.discard(path)
        if mode == "keep_both":
            try:
                return {
                    "status": "saved",
                    "path": write_data_url_unique(data_url, path),
                }
            except Exception as e:  # noqa: BLE001 - shown to the user, as in _write
                logger.exception("writing the export failed: %s", path)
                return {"status": "error", "message": f"Could not write {path}: {e}"}
        if mode != "replace":
            return {"status": "error", "message": f"Unknown choice: {mode}"}
        return self._write(data_url, path)

    @staticmethod
    def _write(data_url: str, path: str) -> dict[str, str]:
        try:
            write_data_url_to_path(data_url, path)
        except Exception as e:  # noqa: BLE001 - permission, disk full, bad data: all must be shown
            logger.exception("writing the export failed: %s", path)
            return {"status": "error", "message": f"Could not write {path}: {e}"}
        return {"status": "saved", "path": path}

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

    def set_native_menu(self, spec: Any) -> bool:
        """Draws the page's menu as native macOS menus. True once drawn.

        A chosen item runs back on the page through ``__youthumberNativeRun``,
        which runs the same command the toolbar buttons and shortcuts use.
        Off macOS this returns False and the page keeps its own controls."""
        return native_menu.install(spec, self._run_menu_command)

    def _run_menu_command(self, payload: dict) -> None:
        ident = payload.get("id")
        if not isinstance(ident, str):
            return
        script = f"window.__youthumberNativeRun && window.__youthumberNativeRun({json.dumps(ident)})"
        # Menu actions arrive on AppKit's main thread, and pywebview's Cocoa
        # evaluate_js schedules onto that thread and waits: calling it here would
        # freeze the window. Hand the call to a worker instead.
        threading.Thread(target=self._evaluate_js, args=(script,), daemon=True).start()

    @staticmethod
    def _evaluate_js(script: str) -> None:
        import webview

        window = webview.windows[0] if webview.windows else None
        if window is not None:
            window.evaluate_js(script)


VIDEO_DROP_SUFFIXES = (".mp4", ".mov", ".m4v")


def dropped_video_paths(event: dict) -> list[str]:
    """Real paths of the video files in a native drop event.

    pywebview's native layer resolves each dropped file to its true path and
    hands it to the handler as ``pywebviewFullPath``; a file without one (a
    drop the native layer did not resolve, or a browser-side File) is skipped
    rather than scanned under a made-up location. Videos are opened in place:
    never copied, never uploaded.
    """
    files = (event.get("dataTransfer") or {}).get("files") or []
    paths = []
    for entry in files:
        # The scan opens the resolved path, so the path - not the drop-event
        # name, which can disagree with it - decides what counts as a video.
        path = entry.get("pywebviewFullPath")
        if path and str(path).lower().endswith(VIDEO_DROP_SUFFIXES):
            paths.append(str(path))
    return paths


def forward_dropped_videos(event: dict, evaluate_js) -> None:
    """Opens the scan modal on each dropped video, on its original path."""
    for path in dropped_video_paths(event):
        evaluate_js(
            "window.__youthumberVideoDropped && "
            f"window.__youthumberVideoDropped({json.dumps(path)})"
        )


def register_video_drop(window) -> None:
    """Lets a video dropped anywhere on the window open the scan modal, in place.

    Registered through pywebview's DOM API because only those handlers receive
    the real path (the native layer captures it from the pasteboard); a plain
    page-side drop listener sees a File with no path. The dragover default must
    be prevented for a drop to fire at all.
    """
    from webview.dom import DOMEventHandler

    def on_drop(event: dict) -> None:
        # The handler already runs on its own thread, so evaluate_js can wait
        # for AppKit's main thread here.
        forward_dropped_videos(event, window.evaluate_js)

    window.dom.body.on(
        "dragover", DOMEventHandler(lambda event: None, prevent_default=True)
    )
    window.dom.body.on("drop", DOMEventHandler(on_drop, prevent_default=True))


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
                app=create_app(dist_dir=self.dist_dir, desktop=True),
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
    diag_path = diagnostics.setup_diagnostics(diagnostics.app_version())
    if diag_path is not None:
        logger.info("Diagnostics log: %s", diag_path)

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

    # Packaged builds have no console; the probe records whether the pywebview
    # bridge ever reaches the page (see diagnostics module).
    diagnostics.install_bridge_probe(window)

    def log_menu_state_once() -> None:
        # Menus are installed by the frontend through the bridge, so their
        # titles are bridge health evidence; wait for the install first.
        threading.Event().wait(8.0)
        diagnostics.log_native_menu_state()

    threading.Thread(target=log_menu_state_once, daemon=True).start()

    def watch_startup() -> None:
        # The first start after a reboot imports for several seconds; give it time.
        if not server.wait_until_ready(timeout=60.0):
            server.stop()
            server.sock.close()  # refuses the waiting page request instead of hanging
            error = server.error or "Timed out while starting."
            window.load_html(STARTUP_FAILED_HTML.format(error=html.escape(str(error))))
            return
        window.events.loaded.wait(timeout=30.0)
        register_video_drop(window)
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
        # pywebview defaults to a private session, which wipes the page's storage (saved
        # projects) on every launch; keep it in a fixed folder instead.
        webview.start(
            func=watch_startup,
            debug=debug,
            private_mode=False,
            storage_path=str(get_user_data_dir() / "webview"),
        )
    finally:
        server.stop()
        server.thread.join(timeout=2.0)
