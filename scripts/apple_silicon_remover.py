#!/usr/bin/env python3
"""Local Apple Silicon / Core ML background removal HTTP service.

Compatibility runner wrapping youthumber.server.
"""

import sys
from pathlib import Path

# Add project root to sys.path so youthumber package can be loaded directly
project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import uvicorn

from youthumber.server import create_app

HOST = "127.0.0.1"
PORT = 5055


def run(port: int = PORT) -> None:
    app = create_app()
    print(f"YouThumber Apple Silicon backend running on http://{HOST}:{port}")
    uvicorn.run(app, host=HOST, port=port, log_level="info")


if __name__ == "__main__":
    run()
