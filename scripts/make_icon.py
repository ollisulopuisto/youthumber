"""Draws the YouThumber app icon from vector shapes.

The picture: a person lifted out of a photo, leaving a see-through (checkerboard) hole,
which is what the app does to a video frame.

The icon is described once, as shapes on a 1024 canvas, in two levels of detail:
- detailed (64 px and up): dark tile, photo card, fine checkerboard, shadows.
- small (16 and 32 pt): the tile is the photo, bigger shapes, a 2x2 checkerboard, no
  shadows, so it still scans in a browser tab or a Finder list.

Outputs:
- ``public/icon.svg`` (small art): favicon and toolbar logo, shown at 16-36 px.
- PNGs drawn with macOS CoreGraphics (vector, anti-aliased at every size):
  ``public/favicon.png`` (dock icon) and ``assets/YouThumber.icns`` (app bundle).

Run: ``uv run python scripts/make_icon.py`` (the PNG/ICNS part needs macOS).
Edit this file, not the outputs; a test checks the committed SVG matches it.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIZE = 1024

RED = "#DC2626"  # Tailwind red-600
AMBER = "#F59E0B"  # amber-500
TILE_TOP, TILE_BOTTOM = "#1F2937", "#0B0F19"  # the editor's dark greys
CHECK_LIGHT, CHECK_DARK = "#E5E7EB", "#9CA3AF"  # the usual "transparent" pattern
WHITE = "#FFFFFF"
SHADOW = "#000000"


@dataclass
class Gradient:
    """Linear gradient from ``start`` to ``end`` (canvas points)."""

    start: tuple[float, float]
    end: tuple[float, float]
    colors: tuple[str, str]


@dataclass
class Shape:
    kind: str  # "rect" (rounded) or "ellipse"
    box: tuple[float, float, float, float]  # x, y, width, height
    fill: str | Gradient | None = None
    radius: float = 0.0
    opacity: float = 1.0
    clip: list[Shape] = field(default_factory=list)  # drawn only inside all of these


TILE = (100, 100, 824, 824)  # macOS icon grid: 824 px tile inside the 1024 canvas
TILE_RADIUS = 185
WARM = Gradient((100, 924), (924, 100), (RED, AMBER))
DARK = Gradient((100, 100), (100, 924), (TILE_TOP, TILE_BOTTOM))


def _person(cx: float, top: float, scale: float) -> tuple[Shape, Shape]:
    """Head and shoulders outlines; ``cx`` is the centre line, ``top`` the top of the head."""
    head_r = 88 * scale
    head = Shape("ellipse", (cx - head_r, top, 2 * head_r, 2 * head_r))
    body_w, body_h = 360 * scale, 300 * scale
    body = Shape(
        "ellipse", (cx - body_w / 2, top + 2 * head_r + 14 * scale, body_w, body_h)
    )
    return head, body


def shapes(detail: bool) -> list[Shape]:
    if detail:
        card, card_r, scale, person_x, lift, top_gap = (
            (150, 300, 724, 424),
            44,
            1.0,
            215,
            (250, -110),
            34,
        )
    else:
        card, card_r, scale, person_x, lift, top_gap = (
            TILE,
            TILE_RADIUS,
            1.25,
            225,
            (360, -110),
            300,
        )
    cx, cy, cw, ch = card
    card_clip = Shape("rect", card, radius=card_r)
    hole_x, top = cx + person_x, cy + top_gap
    head, body = _person(hole_x, top, scale)

    out: list[Shape] = []
    if detail:
        out += [
            Shape("rect", TILE, DARK, radius=TILE_RADIUS),
            Shape("rect", (cx, cy + 18, cw, ch), SHADOW, card_r, opacity=0.35),
        ]
    out.append(Shape("rect", card, WARM, radius=card_r))

    # The hole the person left: a checkerboard, the usual sign for "transparent".
    hole = (hole_x - 200 * scale, top, 400 * scale, cy + ch - top)
    columns = 6 if detail else 2
    cell = hole[2] / columns
    rows = int(hole[3] / cell) + 1
    for part in (head, body):
        clip = [part, card_clip]
        out.append(Shape("rect", hole, CHECK_LIGHT, clip=clip))
        for i in range(columns):
            for j in range(rows):
                if (i + j) % 2:
                    square = (hole[0] + i * cell, hole[1] + j * cell, cell, cell)
                    out.append(Shape("rect", square, CHECK_DARK, clip=clip))

    # The person, lifted up and to the right, cut straight where it left the photo.
    dx, dy = lift
    lifted_head, lifted_body = _person(hole_x + dx, top + dy, scale)
    cut = Shape("rect", (0, 0, SIZE, cy + ch + dy))
    if detail:
        for part, extra_clip in ((lifted_head, []), (lifted_body, [cut])):
            x, y, w, h = part.box
            shadow_clip = [Shape("rect", (0, 0, SIZE, cy + ch + dy + 22))]
            out.append(
                Shape(
                    "ellipse",
                    (x + 16, y + 22, w, h),
                    SHADOW,
                    opacity=0.3,
                    clip=shadow_clip if extra_clip else [],
                )
            )
        out += [
            Shape("ellipse", lifted_head.box, WHITE),
            Shape("ellipse", lifted_body.box, WHITE, clip=[cut]),
        ]
    else:
        out += [
            Shape("ellipse", lifted_head.box, WHITE, clip=[card_clip]),
            Shape("ellipse", lifted_body.box, WHITE, clip=[cut, card_clip]),
        ]
    return out


def _fmt(value: float) -> str:
    return f"{round(value, 3):g}"


def _svg_outline(shape: Shape, extra: str = "") -> str:
    x, y, w, h = shape.box
    if shape.kind == "ellipse":
        return (
            f'<ellipse cx="{_fmt(x + w / 2)}" cy="{_fmt(y + h / 2)}" '
            f'rx="{_fmt(w / 2)}" ry="{_fmt(h / 2)}"{extra}/>'
        )
    radius = f' rx="{_fmt(shape.radius)}"' if shape.radius else ""
    return (
        f'<rect x="{_fmt(x)}" y="{_fmt(y)}" width="{_fmt(w)}" '
        f'height="{_fmt(h)}"{radius}{extra}/>'
    )


def to_svg(detail: bool = False) -> str:
    defs: list[str] = []
    body: list[str] = []
    for index, shape in enumerate(shapes(detail)):
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
            fill = f' fill="url(#{gid})"'
        else:
            fill = f' fill="{shape.fill}"'
        if shape.opacity != 1.0:
            fill += f' fill-opacity="{_fmt(shape.opacity)}"'
        element = _svg_outline(shape, fill)
        # Several clips = nested groups, one clip-path each.
        for depth, clip in enumerate(shape.clip):
            cid = f"c{index}_{depth}"
            defs.append(f'<clipPath id="{cid}">{_svg_outline(clip)}</clipPath>')
            element = f'<g clip-path="url(#{cid})">{element}</g>'
        body.append(element)
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


def render_png(size: int, path: Path, detail: bool) -> None:
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

    def outline(shape: Shape):
        rect = Quartz.CGRectMake(*shape.box)
        if shape.kind == "ellipse":
            return Quartz.CGPathCreateWithEllipseInRect(rect, None)
        return Quartz.CGPathCreateWithRoundedRect(
            rect, shape.radius, shape.radius, None
        )

    for shape in shapes(detail):
        Quartz.CGContextSaveGState(ctx)
        for clip in shape.clip:
            Quartz.CGContextAddPath(ctx, outline(clip))
            Quartz.CGContextClip(ctx)
        Quartz.CGContextAddPath(ctx, outline(shape))
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


# Point sizes in a macOS iconset; up to 32 pt uses the small art, also at @2x.
ICONSET_POINTS = [16, 32, 128, 256, 512]
SMALL_UP_TO_POINTS = 32


def main() -> None:
    (ROOT / "public" / "icon.svg").write_text(to_svg(detail=False))
    print("wrote public/icon.svg")
    if sys.platform != "darwin":
        print("PNG/ICNS need macOS CoreGraphics; skipped")
        return

    render_png(512, ROOT / "public" / "favicon.png", detail=True)
    print("wrote public/favicon.png")

    assets = ROOT / "assets"
    assets.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "YouThumber.iconset"
        iconset.mkdir()
        for points in ICONSET_POINTS:
            detail = points > SMALL_UP_TO_POINTS
            render_png(points, iconset / f"icon_{points}x{points}.png", detail)
            render_png(points * 2, iconset / f"icon_{points}x{points}@2x.png", detail)
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
