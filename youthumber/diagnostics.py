"""Diagnostics logging for packaged desktop builds.

The pywebview JS bridge is injected by a Cocoa delegate once the page loads;
when that silently fails in a packaged build (no ``window.pywebview.api`` in
the page, no native menus) there is no console to read. This module writes a
plain-text log the user can send back: startup facts, whether the page's
``loaded`` event fires, a polled probe of ``window.pywebview.api`` and, in
frozen builds, anything written to the process stdout/stderr (which is where
PyObjC delegate exceptions surface).

Enabled when the app is frozen (PyInstaller) or when YOUTHUMBER_DIAGNOSTICS is
set. Overwrites the log on each launch; the file stays small.
"""

from __future__ import annotations

import faulthandler
import logging
import os
import sys
import threading
from pathlib import Path

logger = logging.getLogger("youthumber.diagnostics")

_LOG_NAME = "youthumber.log"
_ENV_VAR = "YOUTHUMBER_DIAGNOSTICS"

_probe_js = (
    "window.pywebview ? (window.pywebview.api ? 'function:' + "
    "Object.keys(window.pywebview.api).join(',') : 'api-missing') : "
    "'pywebview-missing'"
)

_state_lock = threading.Lock()
_log_path: Path | None = None


def _log_base_dir() -> Path:
    """Platform log directory (Library/Logs on macOS, XDG state elsewhere)."""
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Logs" / "YouThumber"
    if sys.platform.startswith("win"):
        root = os.environ.get("LOCALAPPDATA")
        base = Path(root) if root else Path.home() / "AppData" / "Local"
        return base / "YouThumber" / "Logs"
    root = os.environ.get("XDG_STATE_HOME")
    base = Path(root) if root else Path.home() / ".local" / "state"
    return base / "youthumber"


def log_path() -> Path:
    """Where the diagnostics log lives on this platform."""
    return _log_base_dir() / _LOG_NAME


def _reset_for_tests() -> None:
    """Drop module state so tests can re-run setup with different conditions."""
    global _log_path
    with _state_lock:
        _log_path = None
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()
    logger.propagate = True


def setup_diagnostics(version: str) -> Path | None:
    """Start diagnostics logging; return the log path, or None when disabled.

    Idempotent: repeated calls return the same path without re-configuring.
    In frozen builds the OS-level stdout/stderr are redirected into the log so
    PyObjC delegate tracebacks (which bypass Python logging) are captured too.
    """
    global _log_path
    frozen = bool(getattr(sys, "frozen", False))
    if not frozen and not os.environ.get(_ENV_VAR):
        return None
    with _state_lock:
        if _log_path is not None:
            return _log_path
        path = log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        if frozen:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
            os.dup2(fd, 1)
            os.dup2(fd, 2)
            os.close(fd)
            handler: logging.Handler = logging.StreamHandler(sys.stderr)
        else:
            handler = logging.FileHandler(path, mode="w", encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)
        logger.propagate = False
        faulthandler.enable()
        logger.info("diagnostics enabled, version %s", version)
        logger.info(
            "frozen=%s _MEIPASS=%s platform=%s executable=%s",
            frozen,
            getattr(sys, "_MEIPASS", None),
            sys.platform,
            sys.executable,
        )
        _log_path = path
        return path


def install_bridge_probe(
    window,
    interval: float = 0.5,
    max_attempts: int = 120,
) -> None:
    """Poll ``window.pywebview.api`` from a daemon thread and log what we see.

    Starts immediately rather than waiting for the loaded event: the whole
    point is to catch the case where the Cocoa navigation delegate never
    fires, in which case no loaded event arrives either. Stops as soon as the
    api object is there; logs an error when the attempts run out.
    """

    def on_loaded() -> None:
        logger.info("loaded event fired (navigation delegate alive)")

    window.events.loaded += on_loaded

    def probe() -> None:
        logger.info("bridge probe started")
        for attempt in range(1, max_attempts + 1):
            try:
                result = window.evaluate_js(_probe_js)
            except Exception:
                logger.exception("bridge probe attempt %d raised", attempt)
            else:
                logger.info("bridge probe attempt %d: %s", attempt, result)
                if isinstance(result, str) and result.startswith("function:"):
                    logger.info("bridge ok: pywebview api present")
                    return
            threading.Event().wait(interval)
        logger.error(
            "bridge unavailable after %d attempts: window.pywebview.api never appeared",
            max_attempts,
        )

    threading.Thread(target=probe, daemon=True, name="yt-bridge-probe").start()


def log_native_menu_state() -> None:
    """Log the app's native menu titles (macOS only; best effort).

    The frontend installs menus through the bridge, so on a healthy app this
    shows File/Object/Arrange; with a dead bridge only the pywebview defaults
    (Edit/View) show up.
    """
    if sys.platform != "darwin":
        return
    try:
        from AppKit import NSApp  # type: ignore[import-not-found]

        menu = NSApp.mainMenu()
        titles = [item.title() for item in menu.itemArray()] if menu else []
        logger.info("native menu titles: %s", titles)
    except Exception:
        logger.exception("could not inspect native menu state")
