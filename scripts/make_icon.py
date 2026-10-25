#!/usr/bin/env python3
"""Draw the launcher's app icon: a miniature of the home screen itself.

Samsung asks for a 512x423 PNG app icon (developer.samsung.com/smarttv/design/app-icons-and-screenshots).
The icon is the default wallpaper with its pre-rendered glass dock, a focused tile, three app marks and
the clock, rendered at 2x and downsampled for clean edges. Output: launcher/icon.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "launcher" / "assets"
WALL = "misty"
W, H, SS = 512, 423, 2                     # final size, supersampling factor
CW, CH = W * SS, H * SS


def cover(img: Image.Image, w: int, h: int) -> Image.Image:
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    l, t = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((l, t, l + w, t + h))


def rounded_mask(size, box, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def vgrad(size, top_rgba, bottom_rgba, start=0.0):
    w, h = size
    g = Image.new("RGBA", size)
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = 0 if y < start * h else (y - start * h) / max(1, (1 - start) * h)
        c = tuple(round(top_rgba[i] + (bottom_rgba[i] - top_rgba[i]) * t) for i in range(4))
        d.line([(0, y), (w, y)], fill=c)
    return g


def main() -> None:
    photo = cover(Image.open(ASSETS / "wallpapers" / f"{WALL}.jpg").convert("RGB"), CW, CH).convert("RGBA")
    glass = cover(Image.open(ASSETS / "materials" / f"{WALL}-study-soft.jpg").convert("RGB"), CW, CH).convert("RGBA")

    # CleanFrame's top shade and bottom scrim
    photo = Image.alpha_composite(photo, vgrad((CW, CH), (4, 10, 12, 90), (4, 10, 12, 0), 0.0).crop((0, 0, CW, CH)))
    photo = Image.alpha_composite(photo, vgrad((CW, CH), (4, 10, 12, 0), (4, 10, 12, 140), 0.45))

    # Glass dock: the pre-rendered material inside a rounded pill, darkened by the dock veil
    dock = (56 * SS, 268 * SS, (W - 56) * SS, 380 * SS)
    veil = Image.new("RGBA", (CW, CH), (8, 14, 18, 70))
    glass = Image.alpha_composite(glass, veil)
    shadow = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((dock[0], dock[1] + 8 * SS, dock[2], dock[3] + 8 * SS), radius=28 * SS, fill=(0, 0, 0, 90))
    photo = Image.alpha_composite(photo, shadow.filter(ImageFilter.GaussianBlur(10 * SS)))
    photo.paste(glass, (0, 0), rounded_mask((CW, CH), dock, 28 * SS))
    # Draw translucent shapes on their own layer, then blend (drawing straight onto an RGBA image
    # would overwrite pixels with the translucent colour instead of mixing it).
    layer = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(dock, radius=28 * SS, outline=(255, 255, 255, 46), width=2 * SS)

    # Four tiles, the first focused with CleanFrame's light plate
    pad, gap = 10 * SS, 6 * SS
    tile_w = (dock[2] - dock[0] - 2 * pad - 3 * gap) // 4
    tiles = [(dock[0] + pad + i * (tile_w + gap), dock[1] + pad, dock[0] + pad + i * (tile_w + gap) + tile_w, dock[3] - pad) for i in range(4)]
    d.rounded_rectangle(tiles[0], radius=20 * SS, fill=(255, 255, 255, 64), outline=(255, 255, 255, 80), width=1 * SS)

    white = (255, 255, 255, 240)
    for i, (x0, y0, x1, y1) in enumerate(tiles):
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        u = (y1 - y0) / 100
        if i == 0:   # play button
            d.rounded_rectangle((cx - 26 * u, cy - 18 * u, cx + 26 * u, cy + 18 * u), radius=9 * u, fill=white)
            d.polygon([(cx - 8 * u, cy - 10 * u), (cx - 8 * u, cy + 10 * u), (cx + 11 * u, cy)], fill=(52, 60, 64, 255))
        elif i == 1:  # film / N-like ribbon
            d.polygon([(cx - 14 * u, cy - 24 * u), (cx - 4 * u, cy - 24 * u), (cx + 14 * u, cy + 24 * u), (cx + 4 * u, cy + 24 * u)], fill=white)
            d.rectangle((cx - 14 * u, cy - 24 * u, cx - 5 * u, cy + 24 * u), fill=white)
            d.rectangle((cx + 5 * u, cy - 24 * u, cx + 14 * u, cy + 24 * u), fill=white)
        elif i == 2:  # sound waves
            d.ellipse((cx - 24 * u, cy - 24 * u, cx + 24 * u, cy + 24 * u), fill=white)
            for k, r in enumerate((15, 10, 5)):
                yy = cy - 7 * u + k * 7 * u
                d.arc((cx - r * 1.4 * u, yy - 4 * u, cx + r * 1.4 * u, yy + 10 * u), 200, 340, fill=(40, 46, 50, 255), width=max(2, round(3 * u)))
        else:         # grid of apps
            s = 9 * u
            for gx in (-1, 1):
                for gy in (-1, 1):
                    d.rounded_rectangle((cx + gx * 11 * u - s, cy + gy * 11 * u - s, cx + gx * 11 * u + s, cy + gy * 11 * u + s), radius=3 * u, outline=white, width=max(2, round(2.6 * u)))

    photo = Image.alpha_composite(photo, layer)
    d = ImageDraw.Draw(photo)

    # Clock, top left, as on the home screen
    font = ImageFont.truetype(str(ASSETS / "fonts" / "Manrope-600.ttf"), 78 * SS)
    tx, ty = 46 * SS, 34 * SS
    sh = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((tx, ty + 3 * SS), "21:00", font=font, fill=(0, 0, 0, 110))
    photo = Image.alpha_composite(photo, sh.filter(ImageFilter.GaussianBlur(4 * SS)))
    ImageDraw.Draw(photo).text((tx, ty), "21:00", font=font, fill=(250, 250, 246, 255))

    out = photo.resize((W, H), Image.LANCZOS).convert("RGB")
    out.save(ROOT / "launcher" / "icon.png", optimize=True)
    print(f"launcher/icon.png {out.size[0]}x{out.size[1]} {(ROOT / 'launcher' / 'icon.png').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()

