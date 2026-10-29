"""Pytest configuration for the security path tests.

``youthumber.server`` imports several heavy optional dependencies at module
import time (FastAPI, PIL, framescore, ...). In a minimal test sandbox those
may not be installed, while CI has them available. The stubs below are only
activated when the real module cannot be imported, so they never shadow real
dependencies in a fully provisioned environment.
"""

import sys
from types import ModuleType


def _stub(name: str, attrs: dict) -> None:
    if name in sys.modules:
        return
    module = ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    sys.modules[name] = module


# fastapi is imported eagerly by youthumber.server.
try:
    import fastapi  # noqa: F401
except ImportError:

    def _http_exc_init(self, status_code, detail=None):
        self.status_code = status_code
        self.detail = detail

    _http_exc = type(
        "HTTPException",
        (Exception,),
        {"__init__": _http_exc_init},
    )
    _stub("fastapi", {"FastAPI": type("FastAPI", (), {}), "HTTPException": _http_exc})
    _stub("fastapi.middleware.cors", {"CORSMiddleware": object})
    _stub(
        "fastapi.responses",
        {"FileResponse": object, "HTMLResponse": object, "JSONResponse": object},
    )
    _stub("fastapi.staticfiles", {"StaticFiles": object})

# PIL is imported by matting / segmentation / textures / cgimage.
try:
    from PIL import Image  # noqa: F401
except ImportError:
    _stub(
        "PIL",
        {
            "Image": type("Image", (), {}),
            "ImageFilter": type("ImageFilter", (), {}),
        },
    )

# framescore is imported by videoscan.
try:
    import framescore  # noqa: F401
except ImportError:
    _stub(
        "framescore",
        {
            "FrameCandidate": type("FrameCandidate", (), {}),
            "assign_hands_to_faces": lambda *a, **k: None,
            "expression_score": lambda *a, **k: 0.0,
            "gesture_score": lambda *a, **k: 0.0,
            "head_shoulders_box": lambda *a, **k: None,
            "rank_candidates": lambda *a, **k: [],
        },
    )
