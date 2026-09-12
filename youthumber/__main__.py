"""CLI entry point: launch YouThumber native desktop window or headless server."""

from __future__ import annotations

import argparse
import sys
import threading
import webbrowser

from .gui import launch_gui
from .paths import get_dist_dir
from .server import create_app


def main(argv: list[str] | None = None) -> int:
    """Entry point for running YouThumber."""
    parser = argparse.ArgumentParser(
        prog="youthumber",
        description="YouThumber: Local-first YouTube thumbnail editor with Apple Silicon background removal.",
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        default=None,
        help="Launch native desktop application window (default)",
    )
    parser.add_argument(
        "--no-gui",
        "--headless",
        dest="gui",
        action="store_false",
        help="Run as local HTTP background server without opening window",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Attach to Vite dev server (http://localhost:5173) with hot-reloading",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8731,
        help="Port to bind server to (default: 8731)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host address to bind to (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable developer tools / WebKit inspector",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not automatically open web browser in headless mode",
    )

    args = parser.parse_args(argv)

    use_gui = args.gui if args.gui is not None else True
    dist_dir = get_dist_dir()

    if use_gui:
        target_url = "http://localhost:5173" if args.dev else None
        launch_gui(
            dist_dir=dist_dir,
            target_url=target_url,
            host=args.host,
            port=args.port,
            debug=args.debug,
        )
        return 0

    # Headless server mode
    app = create_app(dist_dir=dist_dir)
    url = f"http://{args.host}:{args.port}/"

    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    print(f"YouThumber server running on {url}")

    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
