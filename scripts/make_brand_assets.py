"""Generate BillScan icon, adaptive icon layers, splash icon and favicon.
Run: python3 scripts/make_brand_assets.py  (needs Pillow)"""
from PIL import Image, ImageDraw, ImageFilter

SLATE = (27, 34, 48, 255)      # #1B2230
MINT = (16, 185, 129, 255)     # #10B981
WHITE = (255, 255, 255, 255)
LINE = (203, 213, 225, 255)    # #CBD5E1
OUT = "assets/"

def receipt(size, scale, fg=WHITE, line=LINE, mark=SLATE, scan=MINT, glow=True):
    """Receipt with zig-zag bottom and a mint scan line, centred, occupying `scale` of the canvas."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    h = size * scale
    w = h * 0.78
    x0 = (size - w) / 2
    y0 = (size - h) / 2
    teeth = 7
    tooth_h = h * 0.06
    pts = [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h - tooth_h)]
    step = w / teeth
    for i in range(teeth, 0, -1):
        pts.append((x0 + (i - 0.5) * step, y0 + h))
        pts.append((x0 + (i - 1) * step, y0 + h - tooth_h))
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h * 0.5], radius=h * 0.06, fill=fg)
    d.polygon(pts, fill=fg)
    # text lines
    lh = h * 0.045
    pad = w * 0.16
    rows = [(0.16, 0.70), (0.27, 0.45), (0.38, 0.70), (0.49, 0.50), (0.60, 0.68)]
    for yf, wf in rows:
        y = y0 + h * yf
        d.rounded_rectangle([x0 + pad, y, x0 + pad + (w - 2 * pad) * wf, y + lh], radius=lh / 2, fill=line)
    # total line (right aligned, dark)
    y = y0 + h * 0.74
    tw = (w - 2 * pad) * 0.45
    d.rounded_rectangle([x0 + w - pad - tw, y, x0 + w - pad, y + lh * 1.3], radius=lh / 2, fill=mark)
    # scan line with glow
    sy = y0 + h * 0.43
    sh = h * 0.035
    if glow:
        g = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        gd.rectangle([x0 - w * 0.12, sy - sh, x0 + w * 1.12, sy + sh * 2], fill=(scan[0], scan[1], scan[2], 150))
        g = g.filter(ImageFilter.GaussianBlur(size * 0.012))
        img = Image.alpha_composite(img, g)
        d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0 - w * 0.12, sy, x0 + w * 1.12, sy + sh], radius=sh / 2, fill=scan)
    return img

def on_bg(fg, bg=SLATE, size=1024):
    base = Image.new("RGBA", (size, size), bg)
    return Image.alpha_composite(base, fg)

# App icon: slate square, receipt ~62%
on_bg(receipt(1024, 0.62)).convert("RGB").save(OUT + "icon.png")
# Android adaptive: foreground within the 66% safe zone
receipt(1024, 0.50).save(OUT + "android-icon-foreground.png")
Image.new("RGBA", (1024, 1024), SLATE).save(OUT + "android-icon-background.png")
mono = receipt(1024, 0.50, fg=WHITE, line=(0, 0, 0, 0), mark=(0, 0, 0, 0), scan=WHITE, glow=False)
mono.save(OUT + "android-icon-monochrome.png")
# Splash icon: transparent, shown on slate background
receipt(1024, 0.80).save(OUT + "splash-icon.png")
# Favicon
on_bg(receipt(1024, 0.62)).resize((48, 48), Image.LANCZOS).save(OUT + "favicon.png")
print("brand assets written")
