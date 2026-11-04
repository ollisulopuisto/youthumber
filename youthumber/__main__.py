"""CLI entry point: launch YouThumber native desktop window or headless server."""

from __future__ import annotations

import argparse
import sys
import threading
import webbrowser

# The GUI and the engine are imported only once it's known which one runs: the desktop
# window opens while the engine is still importing (see gui.launch_gui).
try:
    from .paths import get_dist_dir
except (ImportError, ValueError):
    from youthumber.paths import get_dist_dir


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
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Check this install has everything it needs, then exit (1 on problems)",
    )
    parser.add_argument(
        "--list-actions",
        action="store_true",
        help="Print available thumbnail manipulation actions and LLM tools as JSON, then exit",
    )
    parser.add_argument(
        "--run-actions",
        metavar="JSON_FILE_OR_STRING",
        help="Execute a batch of actions from a JSON file path or inline JSON string and print the resulting project",
    )

    args = parser.parse_args(argv)
    if args.list_actions:
        import json

        from youthumber.actions import (
            get_anthropic_tools,
            get_openai_tools,
            list_actions,
        )

        print(
            json.dumps(
                {
                    "actions": list_actions(),
                    "tools": {
                        "openai": get_openai_tools(),
                        "anthropic": get_anthropic_tools(),
                    },
                },
                indent=2,
            )
        )
        return 0

    if args.run_actions:
        import json
        from pathlib import Path

        from youthumber.actions import execute_batch

        raw = args.run_actions.strip()
        data = None
        target_path = Path(raw)
        if target_path.is_file():
            data = json.loads(target_path.read_text(encoding="utf-8"))
        else:
            data = json.loads(raw)

        actions_list = data if isinstance(data, list) else data.get("actions", [])
        initial_proj = data.get("project") if isinstance(data, dict) else None
        res = execute_batch(actions_list, initial_project=initial_proj)
        print(json.dumps(res, indent=2))
        return 0
    if args.self_test:
        from youthumber.selftest import main as self_test

        return self_test()

    use_gui = args.gui if args.gui is not None else True
    dist_dir = get_dist_dir()

    if use_gui:
        from youthumber.gui import launch_gui

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
    from youthumber.server import create_app

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
