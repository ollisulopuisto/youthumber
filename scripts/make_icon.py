"""Draws the YouThumber app icon from vector shapes.

The icon is described once, as shapes on a 1024 canvas, and written out twice:
- ``public/icon.svg``: the browser favicon and the toolbar logo.
- PNGs drawn with macOS CoreGraphics (vector, anti-aliased at every size), for the dock
  icon (``public/favicon.png``) and the app bundle (``assets/YouThumber.icns``).

Run: ``uv run python scripts/make_icon.py`` (the PNG/ICNS part needs macOS).
Edit this file, not the outputs; a test checks the committed SVG matches it.

The picture: a thumbnail card (16:9, white frame) on the brand's red→amber tile, with
a speaker cut out on the left, two headline bars on the right and a red play badge.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIZE = 1024

RED = "#DC2626"  # Tailwind red-600, as the toolbar badge used
AMBER = "#F59E0B"  # amber-500
AMBER_LIGHT = "#FBBF24"  # amber-400
SCREEN = "#111827"  # gray-900, the editor's own background
WHITE = "#FFFFFF"


@dataclass
class Gradient:
    """Linear gradient from ``start`` to ``end`` (canvas points)."""

    start: tuple[float, float]
    end: tuple[float, float]
    colors: tuple[str, str]


@dataclass
class Shape:
    kind: str  # "rect" (rounded), "ellipse" or "polygon"
    box: tuple[float, float, float, float]  # x, y, width, height (unused for polygon)
    fill: str | Gradient
    radius: float = 0.0
    opacity: float = 1.0
    clip: tuple[float, float, float, float, float] | None = None  # x, y, w, h, radius
    points: tuple[tuple[float, float], ...] = field(default_factory=tuple)


# macOS icon grid: the tile is 824 px inside a 1024 canvas, corner radius ~185.
TILE = (100, 100, 824, 824)
CARD = (184, 332, 656, 369)  # 16:9
CARD_RADIUS = 60
SCREEN_BOX = (220, 368, 584, 297)
SCREEN_RADIUS = 30
SCREEN_CLIP = (*SCREEN_BOX, SCREEN_RADIUS)

SHAPES = [
    Shape("rect", TILE, Gradient((100, 924), (924, 100), (RED, AMBER)), radius=185),
    # Flat drop shadow under the card: crisp at every size, unlike a blur.
    Shape("rect", (184, 352, 656, 369), "#7F1D1D", radius=CARD_RADIUS, opacity=0.35),
    Shape("rect", CARD, WHITE, radius=CARD_RADIUS),
    Shape("rect", SCREEN_BOX, SCREEN, radius=SCREEN_RADIUS),
    # The speaker: head and shoulders, shoulders cut off by the screen's bottom edge.
    Shape("ellipse", (306, 418, 128, 128), AMBER_LIGHT),
    Shape(
        "ellipse",
        (232, 560, 276, 220),
        Gradient((232, 560), (232, 665), (AMBER_LIGHT, AMBER)),
        clip=SCREEN_CLIP,
    ),
    # Headline text bars.
    Shape("rect", (536, 446, 214, 56), WHITE, radius=28),
    Shape("rect", (536, 530, 150, 56), AMBER_LIGHT, radius=28),
    # A play badge over the card's corner, so it reads as a video thumbnail.
    Shape("rect", (672, 604, 196, 140), "#7F1D1D", radius=40, opacity=0.35),
    Shape("rect", (672, 588, 196, 140), RED, radius=40),
    Shape("polygon", (0, 0, 0, 0), WHITE, points=((748, 624), (748, 692), (806, 658))),
]


def _fmt(value: float) -> str:
    return f"{value:g}"


def to_svg() -> str:
    defs: list[str] = []
    body: list[str] = []
    for index, shape in enumerate(SHAPES):
        attrs = []
        if isinstance(shape.fill, Gradient):
            gid = f"g{index}"
            (x1, y1), (x2, y2) = shape.fill.start, shape.fill.end
            c1, c2 = shape.fill.colors
            defs.append(
                f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" '
                f'x1="{_fmt(x1)}" y1="{_fmt(y1)}" x2="{_fmt(x2)}" y2="{_fmt(y2)}">'
                f'<stop offset="0" stop-color="{c1}"/>'
                f'<stop offset="1" stop-color="{c2}"/></linearGradient>'
            )
            attrs.append(f'fill="url(#{gid})"')
        else:
            attrs.append(f'fill="{shape.fill}"')
        if shape.opacity != 1.0:
            attrs.append(f'fill-opacity="{_fmt(shape.opacity)}"')
        if shape.clip:
            cid = f"c{index}"
            cx, cy, cw, ch, cr = shape.clip
            defs.append(
                f'<clipPath id="{cid}"><rect x="{_fmt(cx)}" y="{_fmt(cy)}" '
                f'width="{_fmt(cw)}" height="{_fmt(ch)}" rx="{_fmt(cr)}"/></clipPath>'
            )
            attrs.append(f'clip-path="url(#{cid})"')
        x, y, w, h = shape.box
        if shape.kind == "polygon":
            coords = " ".join(f"{_fmt(px)},{_fmt(py)}" for px, py in shape.points)
            geometry = f'<polygon points="{coords}"'
        elif shape.kind == "rect":
            geometry = (
                f'<rect x="{_fmt(x)}" y="{_fmt(y)}" width="{_fmt(w)}" '
                f'height="{_fmt(h)}" rx="{_fmt(shape.radius)}"'
            )
        else:
            geometry = (
                f'<ellipse cx="{_fmt(x + w / 2)}" cy="{_fmt(y + h / 2)}" '
                f'rx="{_fmt(w / 2)}" ry="{_fmt(h / 2)}"'
            )
        body.append(f"{geometry} {' '.join(attrs)}/>")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" '
        'width="1024" height="1024">\n'
        "<title>YouThumber</title>\n"
        f"<defs>{''.join(defs)}</defs>\n" + "\n".join(body) + "\n</svg>\n"
    )


def _rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    r, g, b = (int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return r, g, b, alpha


def render_png(size: int, path: Path) -> None:
    """Draws the icon at ``size`` px with CoreGraphics (macOS only)."""
    import Quartz

    space = Quartz.CGColorSpaceCreateWithName(Quartz.kCGColorSpaceSRGB)
    ctx = Quartz.CGBitmapContextCreate(
        None, size, size, 8, 0, space, Quartz.kCGImageAlphaPremultipliedLast
    )
    Quartz.CGContextSetShouldAntialias(ctx, True)
    scale = size / SIZE
    # CoreGraphics' origin is bottom-left; flip to the SVG's top-left.
    Quartz.CGContextTranslateCTM(ctx, 0, size)
    Quartz.CGContextScaleCTM(ctx, scale, -scale)

    def outline(kind, box, radius, points=()):
        if kind == "polygon":
            path = Quartz.CGPathCreateMutable()
            Quartz.CGPathMoveToPoint(path, None, *points[0])
            for point in points[1:]:
                Quartz.CGPathAddLineToPoint(path, None, *point)
            Quartz.CGPathCloseSubpath(path)
            return path
        rect = Quartz.CGRectMake(*box)
        if kind == "ellipse":
            return Quartz.CGPathCreateWithEllipseInRect(rect, None)
        return Quartz.CGPathCreateWithRoundedRect(rect, radius, radius, None)

    for shape in SHAPES:
        Quartz.CGContextSaveGState(ctx)
        if shape.clip:
            cx, cy, cw, ch, cr = shape.clip
            Quartz.CGContextAddPath(ctx, outline("rect", (cx, cy, cw, ch), cr))
            Quartz.CGContextClip(ctx)
        Quartz.CGContextAddPath(
            ctx, outline(shape.kind, shape.box, shape.radius, shape.points)
        )
        if isinstance(shape.fill, Gradient):
            Quartz.CGContextClip(ctx)
            colors = [
                Quartz.CGColorCreate(space, _rgba(c, shape.opacity))
                for c in shape.fill.colors
            ]
            gradient = Quartz.CGGradientCreateWithColors(space, colors, [0.0, 1.0])
            Quartz.CGContextDrawLinearGradient(
                ctx,
                gradient,
                Quartz.CGPointMake(*shape.fill.start),
                Quartz.CGPointMake(*shape.fill.end),
                Quartz.kCGGradientDrawsBeforeStartLocation
                | Quartz.kCGGradientDrawsAfterEndLocation,
            )
        else:
            Quartz.CGContextSetRGBFillColor(ctx, *_rgba(shape.fill, shape.opacity))
            Quartz.CGContextFillPath(ctx)
        Quartz.CGContextRestoreGState(ctx)

    image = Quartz.CGBitmapContextCreateImage(ctx)
    url = Quartz.CFURLCreateWithFileSystemPath(
        None, str(path), Quartz.kCFURLPOSIXPathStyle, False
    )
    dest = Quartz.CGImageDestinationCreateWithURL(url, "public.png", 1, None)
    Quartz.CGImageDestinationAddImage(dest, image, None)
    if not Quartz.CGImageDestinationFinalize(dest):
        raise RuntimeError(f"Could not write {path}")


ICONSET_SIZES = [16, 32, 128, 256, 512]


def main() -> None:
    (ROOT / "public" / "icon.svg").write_text(to_svg())
    print("wrote public/icon.svg")
    if sys.platform != "darwin":
        print("PNG/ICNS need macOS CoreGraphics; skipped")
        return

    render_png(512, ROOT / "public" / "favicon.png")
    print("wrote public/favicon.png")

    assets = ROOT / "assets"
    assets.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "YouThumber.iconset"
        iconset.mkdir()
        for base in ICONSET_SIZES:
            render_png(base, iconset / f"icon_{base}x{base}.png")
            render_png(base * 2, iconset / f"icon_{base}x{base}@2x.png")
        subprocess.run(
            [
                "iconutil",
                "-c",
                "icns",
                str(iconset),
                "-o",
                str(assets / "YouThumber.icns"),
            ],
            check=True,
        )
    print("wrote assets/YouThumber.icns")


if __name__ == "__main__":
    main()
