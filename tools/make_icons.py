#!/usr/bin/env python3
"""Generate PDForce toolbar icons.

Each mode gets a rounded-square badge in its colour with a white glyph:
  off      - a horizontal bar (no interference)
  view     - an eye
  download - an arrow pointing into a tray

Run: python3 tools/make_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent.parent / "icons"
SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 8
BASE = 128 * SUPERSAMPLE

COLOURS = {
    "off": (154, 160, 166, 255),
    "view": (47, 111, 237, 255),
    "download": (23, 163, 74, 255),
}

WHITE = (255, 255, 255, 255)


def s(value: float) -> float:
    """Scale a 0-128 design coordinate to the supersampled canvas."""
    return value * BASE / 128


def badge(colour):
    image = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        [s(6), s(6), s(122), s(122)], radius=s(26), fill=colour
    )
    return image, draw


def glyph_off(draw):
    draw.rounded_rectangle(
        [s(32), s(58), s(96), s(70)], radius=s(6), fill=WHITE
    )


def glyph_view(draw):
    # Eye: a lens made from two arcs, plus a pupil.
    draw.ellipse([s(24), s(42), s(104), s(86)], fill=WHITE)
    draw.ellipse([s(52), s(50), s(76), s(78)], fill=COLOURS["view"])


def glyph_download(draw):
    draw.rounded_rectangle([s(57), s(28), s(71), s(70)], radius=s(6), fill=WHITE)
    draw.polygon([(s(40), s(62)), (s(88), s(62)), (s(64), s(90))], fill=WHITE)
    draw.rounded_rectangle([s(34), s(96), s(94), s(106)], radius=s(5), fill=WHITE)


GLYPHS = {"off": glyph_off, "view": glyph_view, "download": glyph_download}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for mode, colour in COLOURS.items():
        image, draw = badge(colour)
        GLYPHS[mode](draw)
        for size in SIZES:
            image.resize((size, size), Image.LANCZOS).save(
                OUT_DIR / f"{mode}-{size}.png"
            )
            print(f"wrote icons/{mode}-{size}.png")


if __name__ == "__main__":
    main()
