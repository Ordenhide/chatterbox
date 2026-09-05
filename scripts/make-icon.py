#!/usr/bin/env python3
"""
Generates the launcher icon from the app's own palette.

The concept is unchanged from the icon it replaces — a padlock whose body is a
speech bubble — because that mark already reads as this app. What changes is
the colour: the old one was a purple/indigo gradient from the palette this app
had before the terminal redesign, so the icon on the home screen and the app
behind it no longer agreed.

Every value here comes from src/theme/colors.ts rather than being picked:

  ground  #000000  the dark theme's `backdrop`, "the absence of light so the
                   green is the only thing emitting any"
  signal  #00FF41  `primary`, 15.38:1 on that ground
  ink     #000000  `textOnPrimary` — black on the green, because white there
                   is 1.37:1. The inversion is not a preference.

Drawn at 8x and downsampled, because the mark has curves and a 48px mdpi icon
drawn directly is a staircase.

    python3 scripts/make-icon.py
"""
import os
from PIL import Image, ImageDraw

GROUND = (0, 0, 0, 255)
SIGNAL = (0, 255, 65, 255)
INK = (0, 0, 0, 255)

SS = 8  # supersample factor
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

ANDROID = {  # density -> px
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}


def draw_mark_layers(s, ground=None):
    """The mark at `s` px, already supersampled. `ground` fills behind it."""
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if ground == "round":
        d.ellipse([0, 0, s - 1, s - 1], fill=GROUND)
    elif ground == "square":
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.17), fill=GROUND)

    # Shackle — an open arc above the body, stroked in the signal colour.
    # Width is a proportion of the icon so it survives the downsample at mdpi.
    sw = max(2, int(s * 0.052))
    ax0, ay0 = s * 0.335, s * 0.155
    ax1, ay1 = s * 0.665, s * 0.545
    d.arc([ax0, ay0, ax1, ay1], start=180, end=360, fill=SIGNAL, width=sw)

    # Body — the speech bubble, a solid block of the signal colour. Solid
    # rather than outlined because a hairline is the first thing to disappear
    # at 48px, and because a filled block is what an outgoing bubble is.
    bx0, by0 = s * 0.175, s * 0.40
    bx1, by1 = s * 0.825, s * 0.80
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=int(s * 0.11), fill=SIGNAL)

    # Tail, bottom-left, the direction a sent message points.
    d.polygon(
        [(s * 0.255, s * 0.775), (s * 0.255, s * 0.895), (s * 0.395, s * 0.775)],
        fill=SIGNAL,
    )

    # Three dots in the ink the palette specifies for this fill.
    r = s * 0.042
    cy = (by0 + by1) / 2
    for cx in (s * 0.375, s * 0.50, s * 0.625):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)

    return img


def draw_mark(size, round_mask):
    """The legacy launcher icon at `size` px, ground included."""
    return draw_mark_layers(size * SS, "round" if round_mask else "square").resize(
        (size, size), Image.LANCZOS
    )


def draw_foreground(size):
    """
    The adaptive-icon foreground: the mark alone, on transparency.

    Android's adaptive canvas is 108dp with only the centre 66dp guaranteed
    visible — the launcher masks the rest to whatever shape it likes and may
    parallax the layers. So the mark is drawn into that safe centre rather than
    edge to edge, which is also why the legacy icons above cannot simply be
    reused: handed to a round mask, a full-bleed square gets shrunk and padded,
    and the launcher fills the gap with white.
    """
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    inner = int(s * 66 / 108)
    mark = draw_mark_layers(inner)
    img.paste(mark, ((s - inner) // 2, (s - inner) // 2), mark)
    return img.resize((size, size), Image.LANCZOS)


def write(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print(f"  {img.size[0]:>4}px  {os.path.relpath(path, ROOT)}")


def main():
    print("Android:")
    for density, px in ANDROID.items():
        base = os.path.join(ROOT, "android/app/src/main/res", f"mipmap-{density}")
        write(os.path.join(base, "ic_launcher.png"), draw_mark(px, False))
        write(os.path.join(base, "ic_launcher_round.png"), draw_mark(px, True))

    # Adaptive icon: two layers plus the XML that pairs them. Without this the
    # launcher treats ic_launcher.png as a legacy icon — it shrinks the square
    # into its mask and pads the gap, which is where the white ring around a
    # black icon comes from.
    print("Android adaptive:")
    for density, px in ANDROID.items():
        base = os.path.join(ROOT, "android/app/src/main/res", f"mipmap-{density}")
        # 108dp at this density, since the foreground is the full canvas.
        write(os.path.join(base, "ic_launcher_foreground.png"), draw_foreground(px * 108 // 48))

    anydpi = os.path.join(ROOT, "android/app/src/main/res/mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />\n'
        "</adaptive-icon>\n"
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(anydpi, name), "w") as f:
            f.write(xml)
        print(f"        {os.path.relpath(os.path.join(anydpi, name), ROOT)}")

    values = os.path.join(ROOT, "android/app/src/main/res/values")
    os.makedirs(values, exist_ok=True)
    bg = os.path.join(values, "ic_launcher_background.xml")
    with open(bg, "w") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            '    <color name="ic_launcher_background">#000000</color>\n</resources>\n'
        )
    print(f"        {os.path.relpath(bg, ROOT)}")

    icon_set = os.path.join(ROOT, "ios/ChatterboxTemp/Images.xcassets/AppIcon.appiconset")
    if os.path.isdir(icon_set):
        print("iOS:")
        # Regenerate exactly the files already declared in Contents.json, at the
        # size each one already is — inventing entries would desync the set.
        for name in sorted(os.listdir(icon_set)):
            if not name.endswith(".png"):
                continue
            path = os.path.join(icon_set, name)
            with Image.open(path) as existing:
                px = existing.size[0]
            # iOS applies its own mask and rejects alpha, so: square, opaque.
            write(path, draw_mark(px, False).convert("RGB"))


if __name__ == "__main__":
    main()
