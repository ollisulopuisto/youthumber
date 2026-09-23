"""Texture backgrounds generated on the GPU with Core Image (Metal).

Each preset chains Apple's built-in Core Image generators and filters, coloured with
two user colours. The same preset, colours and seed always give the same texture;
change the seed for a variation. Sizes are set for a 1920-wide render and scaled, so a
small preview looks like the full-size image.
"""

from __future__ import annotations

import io
import logging
import random
import sys
import threading

from PIL import Image

from .cgimage import cgimage_to_pil

logger = logging.getLogger(__name__)

HAS_CORE_IMAGE = False
if sys.platform == "darwin":
    try:
        import Quartz

        HAS_CORE_IMAGE = (
            Quartz.CIFilter.filterWithName_("CIRandomGenerator") is not None
        )
    except ImportError as e:
        logger.warning("Core Image not available for textures: %s", e)

TEXTURE_PRESETS = [
    {"id": "grain", "name": "Film grain"},
    {"id": "smoke", "name": "Smoke"},
    {"id": "sunbeams", "name": "Sunbeams"},
    {"id": "halo", "name": "Light halo"},
    {"id": "stained-glass", "name": "Stained glass"},
    {"id": "hex-tiles", "name": "Hex tiles"},
    {"id": "halftone", "name": "Halftone"},
    {"id": "bokeh", "name": "Bokeh"},
]
_PRESET_IDS = {p["id"] for p in TEXTURE_PRESETS}
REFERENCE_WIDTH = 1920

_context = None
# PyObjC resolves Quartz functions lazily on first use, and that isn't thread-safe:
# eight parallel preview requests on a fresh engine failed with KeyErrors (2026-09-23).
# Renders take ~10ms per preview, so running them one at a time costs nothing visible.
_render_lock = threading.Lock()


def parse_hex_color(value: str) -> tuple[float, float, float]:
    """'#RRGGBB' (or 'RRGGBB') to 0-1 floats."""
    digits = value.strip().lstrip("#")
    if len(digits) != 6 or any(c not in "0123456789abcdefABCDEF" for c in digits):
        raise ValueError(f"Not a #RRGGBB colour: {value!r}")
    return tuple(int(digits[i : i + 2], 16) / 255 for i in (0, 2, 4))


# --- Core Image plumbing -------------------------------------------------------------


def _ci_context():
    global _context
    if _context is None:
        _context = Quartz.CIContext.contextWithOptions_(None)  # Metal-backed by default
    return _context


def _filter(name: str, **params):
    f = Quartz.CIFilter.filterWithName_(name)
    f.setDefaults()
    for key, value in params.items():
        f.setValue_forKey_(value, key)
    return f.outputImage()


def _vec(*values: float):
    if len(values) == 2:
        return Quartz.CIVector.vectorWithX_Y_(*values)
    return Quartz.CIVector.vectorWithX_Y_Z_W_(*values)


def _color(rgb: tuple[float, float, float], alpha: float = 1.0):
    return Quartz.CIColor.colorWithRed_green_blue_alpha_(*rgb, alpha)


def _scaled(
    rgb: tuple[float, float, float], factor: float
) -> tuple[float, float, float]:
    return tuple(c * factor for c in rgb)


def _transform(image, transform):
    return image.imageByApplyingTransform_(transform)


def _crop(image, width: int, height: int):
    return image.imageByCroppingToRect_(Quartz.CGRectMake(0, 0, width, height))


def _blur(image, radius: float):
    return _filter(
        "CIGaussianBlur", inputImage=image.imageByClampingToExtent(), inputRadius=radius
    )


def _noise(rnd: random.Random, cell: float):
    """Grey value noise; ``cell`` > 1 stretches it into larger, softer features."""
    ox, oy = rnd.uniform(0, 4000), rnd.uniform(0, 4000)
    noise = _transform(
        _filter("CIRandomGenerator"), Quartz.CGAffineTransformMakeTranslation(-ox, -oy)
    )
    noise = _filter("CIColorControls", inputImage=noise, inputSaturation=0.0)
    if cell > 1:
        noise = _transform(noise, Quartz.CGAffineTransformMakeScale(cell, cell))
    return noise


def _cloud(rnd: random.Random, s: float, brightness: float = 0.0):
    """Soft cloudy luminance from two octaves of blurred noise, contrast-stretched.
    Negative ``brightness`` leaves more of the dark colour showing."""
    fine = _blur(_noise(rnd, 24 * s), 18 * s)
    coarse = _blur(_noise(rnd, 96 * s), 70 * s)
    half = _vec(0.5, 0, 0, 0), _vec(0, 0.5, 0, 0), _vec(0, 0, 0.5, 0)
    fine = _filter(
        "CIColorMatrix",
        inputImage=fine,
        inputRVector=half[0],
        inputGVector=half[1],
        inputBVector=half[2],
    )
    coarse = _filter(
        "CIColorMatrix",
        inputImage=coarse,
        inputRVector=half[0],
        inputGVector=half[1],
        inputBVector=half[2],
    )
    mixed = _filter(
        "CIAdditionCompositing", inputImage=fine, inputBackgroundImage=coarse
    )
    stretched = _filter(
        "CIColorControls",
        inputImage=mixed,
        inputContrast=3.0,
        inputBrightness=brightness,
    )
    # Contrast pushes values past 0-1, and CIFalseColor then overshoots the chosen
    # colours (Smoke came out brighter than its accent colour), so clamp.
    return _filter(
        "CIColorClamp",
        inputImage=stretched,
        inputMinComponents=_vec(0, 0, 0, 0),
        inputMaxComponents=_vec(1, 1, 1, 1),
    )


def _false_color(image, c0, c1):
    return _filter(
        "CIFalseColor", inputImage=image, inputColor0=_color(c0), inputColor1=_color(c1)
    )


def _gradient(width: int, height: int, c0, c1):
    return _filter(
        "CISmoothLinearGradient",
        inputPoint0=_vec(0, 0),
        inputPoint1=_vec(width, height),
        inputColor0=_color(c0),
        inputColor1=_color(c1),
    )


def _screen(top, bottom):
    return _filter("CIScreenBlendMode", inputImage=top, inputBackgroundImage=bottom)


def _pil_to_ciimage(image: Image.Image):
    from Foundation import NSData

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return Quartz.CIImage.imageWithData_(
        NSData.dataWithBytes_length_(buf.getvalue(), len(buf.getvalue()))
    )


def _bokeh_lights(rnd: random.Random, width: int, height: int, s: float) -> Image.Image:
    """Out-of-focus light discs of varying size and brightness, on black."""
    from PIL import ImageDraw

    lights = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(lights)
    for _ in range(45):
        x, y = rnd.uniform(0, width), rnd.uniform(0, height)
        r = rnd.uniform(18, 70) * s
        level = int(rnd.uniform(50, 200))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(level, level, level))
    return lights


# --- Presets -------------------------------------------------------------------------


def _build(preset: str, c0, c1, rnd: random.Random, width: int, height: int):
    s = width / REFERENCE_WIDTH
    dark = _scaled(c0, 0.25)

    if preset == "grain":
        grain = _filter(
            "CIColorControls", inputImage=_noise(rnd, 1), inputContrast=0.35
        )
        return _filter(
            "CISoftLightBlendMode",
            inputImage=grain,
            inputBackgroundImage=_gradient(width, height, c0, c1),
        )

    if preset == "smoke":
        # At brightness 0 the clamped cloud came out mostly flat accent colour.
        return _false_color(_cloud(rnd, s, brightness=-0.35), c0, c1)

    if preset == "sunbeams":
        sun = _filter(
            "CISunbeamsGenerator",
            inputCenter=_vec(
                width * rnd.uniform(0.3, 0.7), height * rnd.uniform(0.7, 1.0)
            ),
            inputColor=_color(c1),
            inputSunRadius=180 * s,
            inputMaxStriationRadius=2.2,
            inputStriationStrength=0.6,
            inputStriationContrast=1.37,
            inputTime=rnd.random(),
        )
        return _screen(sun, _gradient(width, height, c0, dark))

    if preset == "halo":
        center = _vec(width * rnd.uniform(0.25, 0.75), height * rnd.uniform(0.45, 0.85))
        halo = _filter(
            "CILenticularHaloGenerator",
            inputCenter=center,
            inputColor=_color(c1),
            inputHaloRadius=220 * s,
            inputHaloWidth=60 * s,
            inputHaloOverlap=0.77,
            inputStriationStrength=0.5,
            inputStriationContrast=1.0,
            inputTime=rnd.random(),
        )
        # A soft, wide glow around the ring rather than a solid disc inside it.
        glow = _blur(
            _filter(
                "CIRadialGradient",
                inputCenter=center,
                inputRadius0=0.0,
                inputRadius1=700 * s,
                inputColor0=_color(c1, 0.35),
                inputColor1=_color(c1, 0.0),
            ),
            40 * s,
        )
        return _screen(halo, _screen(glow, _gradient(width, height, c0, dark)))

    if preset == "stained-glass":
        return _filter(
            "CICrystallize",
            inputImage=_false_color(_cloud(rnd, s), c0, c1),
            inputRadius=70 * s,
            inputCenter=_vec(rnd.uniform(0, width), rnd.uniform(0, height)),
        )

    if preset == "hex-tiles":
        # Replaced CIPointillize, which fills the gaps between its dots with white.
        return _filter(
            "CIHexagonalPixellate",
            inputImage=_false_color(_cloud(rnd, s, brightness=-0.15), c0, c1),
            inputCenter=_vec(rnd.uniform(0, width), rnd.uniform(0, height)),
            inputScale=46 * s,
        )

    if preset == "halftone":
        center = _vec(width * rnd.uniform(0.3, 0.7), height * rnd.uniform(0.3, 0.7))
        light = _filter(
            "CIRadialGradient",
            inputCenter=center,
            inputRadius0=0.0,
            inputRadius1=width * 0.7,
            inputColor0=_color((1, 1, 1)),
            inputColor1=_color((0, 0, 0)),
        )
        dots = _filter(
            "CIDotScreen",
            inputImage=light,
            inputCenter=center,
            inputAngle=rnd.uniform(0, 1.5),
            inputWidth=22 * s,
            inputSharpness=0.7,
        )
        return _false_color(dots, c0, c1)

    if preset == "bokeh":
        # Lights are placed from the seed (thresholding Core Image noise lit about half
        # the frame, not a sparse few: its greyscale noise isn't uniform in the working
        # colour space). Positions and sizes are relative, so previews match.
        lights = _crop(
            _pil_to_ciimage(_bokeh_lights(rnd, width, height, s)), width, height
        )
        tinted = _filter(
            "CIMultiplyCompositing",
            inputImage=_crop(
                _filter("CIConstantColorGenerator", inputColor=_color(c1)),
                width,
                height,
            ),
            inputBackgroundImage=lights,
        )
        bokeh = _filter(
            "CIBokehBlur",
            inputImage=tinted,
            inputRadius=14 * s,
            inputRingAmount=0.4,
            inputRingSize=0.12,
            inputSoftness=1.0,
        )
        return _screen(bokeh, _gradient(width, height, c0, dark))

    raise ValueError(f"Unknown texture preset: {preset!r}")


def render_texture(
    preset: str, colors: list[str], seed: int, width: int, height: int
) -> Image.Image:
    """Renders a texture preset at ``width`` x ``height`` in the two given colours."""
    if preset not in _PRESET_IDS:
        raise ValueError(f"Unknown texture preset: {preset!r}")
    if len(colors) != 2:
        raise ValueError("Textures take exactly two colours")
    c0, c1 = (parse_hex_color(c) for c in colors)
    if not HAS_CORE_IMAGE:
        raise RuntimeError("Textures need macOS Core Image")

    with _render_lock:
        image = _crop(
            _build(preset, c0, c1, random.Random(seed), width, height), width, height
        )
        cg_image = _ci_context().createCGImage_fromRect_(
            image, Quartz.CGRectMake(0, 0, width, height)
        )
        return cgimage_to_pil(cg_image)
