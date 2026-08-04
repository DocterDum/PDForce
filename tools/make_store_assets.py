#!/usr/bin/env python3
"""Build the Chrome Web Store listing images into store/.

  screenshot-1280x800.png   required screenshot (the popup, on a backdrop)
  promo-small-440x280.png   required small promotional tile
  promo-marquee-1400x560.png optional marquee tile

The popup shot is rendered from src/popup/popup.html by headless Chrome, so it
is the real UI rather than a mockup.

Run: python3 tools/make_store_assets.py
"""

import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "store"

CHROME_CANDIDATES = [
    "/usr/bin/google-chrome-stable",
    "/usr/local/bin/google-chrome",
    "/usr/bin/chromium",
]

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
FONT_BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"
FONT_REGULAR = FONT_DIR / "DejaVuSans.ttf"

INK = (22, 26, 40)
MUTED = (92, 100, 122)
BLUE = (47, 63, 208)


def font(path, size):
    return ImageFont.truetype(str(path), size)


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    raise SystemExit("Chrome not found; install it or edit CHROME_CANDIDATES")


def render_popup():
    """Screenshot the real popup with Force View selected."""
    html = (ROOT / "src/popup/popup.html").read_text()
    html = html.replace('<script src="popup.js"></script>', "")
    html = html.replace('data-mode="off" aria-checked="true"', 'data-mode="off" aria-checked="false"')
    html = html.replace('data-mode="view" aria-checked="false"', 'data-mode="view" aria-checked="true"')

    work = Path(tempfile.mkdtemp())
    (work / "popup.html").write_text(html)
    (work / "popup.css").write_text((ROOT / "src/popup/popup.css").read_text())
    shot = work / "popup.png"

    subprocess.run(
        [
            find_chrome(),
            "--headless",
            "--no-sandbox",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=3",
            "--window-size=264,310",
            f"--screenshot={shot}",
            (work / "popup.html").as_uri(),
        ],
        check=True,
        capture_output=True,
    )
    return Image.open(shot).convert("RGB")


def rounded(image, radius):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *[v - 1 for v in image.size]], radius=radius, fill=255)
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def drop_shadow(canvas, box, radius, blur=28, opacity=70):
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(box, radius=radius, fill=(20, 26, 50, opacity))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(blur)))


def backdrop(size, top=(238, 241, 250), bottom=(214, 223, 246)):
    width, height = size
    canvas = Image.new("RGBA", size)
    draw = ImageDraw.Draw(canvas)
    for y in range(height):
        t = y / max(height - 1, 1)
        draw.line(
            [(0, y), (width, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,),
        )
    return canvas


def screenshot():
    canvas = backdrop((1280, 800))
    popup = render_popup()

    target_height = 620
    scale = target_height / popup.height
    popup = popup.resize((round(popup.width * scale), target_height), Image.LANCZOS)
    popup = rounded(popup, 22)

    x, y = 1280 - popup.width - 110, (800 - popup.height) // 2
    drop_shadow(canvas, [x, y + 10, x + popup.width, y + popup.height + 10], 22)
    canvas.alpha_composite(popup, (x, y))

    icon = Image.open(ROOT / "icons/store-128.png").convert("RGBA").resize((84, 84), Image.LANCZOS)
    canvas.alpha_composite(icon, (110, 176))

    draw = ImageDraw.Draw(canvas)
    draw.text((212, 196), "PDForce", font=font(FONT_BOLD, 46), fill=INK)

    headline = font(FONT_BOLD, 52)
    for index, line in enumerate(["Choose how", "PDFs open."]):
        draw.text((110, 300 + index * 66), line, font=headline, fill=INK)

    lines = [
        "Force them into the browser",
        "viewer, force them to download,",
        "or leave sites well alone.",
    ]
    for index, line in enumerate(lines):
        draw.text((110, 466 + index * 44), line, font=font(FONT_REGULAR, 27), fill=MUTED)

    canvas.convert("RGB").save(OUT_DIR / "screenshot-1280x800.png")


def promo(size, icon_size, title_size, tag_size, name):
    width, height = size
    canvas = backdrop(size, top=(46, 60, 190), bottom=(28, 36, 130))

    icon = Image.open(ROOT / "icons/store-128.png").convert("RGBA")
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)

    title_font = font(FONT_BOLD, title_size)
    tag_font = font(FONT_REGULAR, tag_size)
    draw = ImageDraw.Draw(canvas)

    title = "PDForce"
    tagline = "View or download PDFs, your call"
    title_width = draw.textlength(title, font=title_font)
    tag_width = draw.textlength(tagline, font=tag_font)

    block_height = icon_size + title_size + tag_size + round(height * 0.09)
    top = (height - block_height) // 2

    canvas.alpha_composite(icon, ((width - icon_size) // 2, top))
    draw.text(
        ((width - title_width) / 2, top + icon_size + height * 0.045),
        title,
        font=title_font,
        fill=(255, 255, 255),
    )
    draw.text(
        ((width - tag_width) / 2, top + icon_size + title_size + height * 0.075),
        tagline,
        font=tag_font,
        fill=(198, 208, 250),
    )

    canvas.convert("RGB").save(OUT_DIR / name)


def main():
    OUT_DIR.mkdir(exist_ok=True)
    screenshot()
    promo((440, 280), 96, 40, 18, "promo-small-440x280.png")
    promo((1400, 560), 200, 90, 38, "promo-marquee-1400x560.png")
    for path in sorted(OUT_DIR.iterdir()):
        print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
