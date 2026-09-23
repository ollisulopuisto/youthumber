"""Core Graphics <-> PIL conversion shared by the macOS-only modules."""

import io

from PIL import Image


def cgimage_to_pil(cg_image) -> Image.Image:
    """Converts a CGImage to an RGB PIL Image via a lossless PNG round-trip."""
    import Quartz

    data = Quartz.CFDataCreateMutable(None, 0)
    dest = Quartz.CGImageDestinationCreateWithData(data, "public.png", 1, None)
    Quartz.CGImageDestinationAddImage(dest, cg_image, None)
    Quartz.CGImageDestinationFinalize(dest)
    return Image.open(io.BytesIO(bytes(data))).convert("RGB")
