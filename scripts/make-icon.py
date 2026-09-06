#!/usr/bin/env python3
"""
Generates the launcher icon from the app's own palette.

Redrawn from the Figma design: a white speech bubble on black, a padlock with
a keyhole inside it, a signal-green rule under the lock body, and the app's own
corner brackets framing the whole thing.

Redrawn rather than exported, because what arrived was a screenshot of the
design page and not an asset. Every coordinate below is a fraction of the icon
so it holds at 20px and at 1024.

  ground  #000000  the dark theme's `backdrop`
  paper   #FFFFFF  the bubble
  signal  #00FF41  `primary`, and what CornerBrackets already draws in
  ink     #000000  the lock, on the paper

## The brackets do not sit at the edge

In the design they touch the corners. On a device they would be the first
thing lost: an Android adaptive icon only guarantees the centre 66 of 108dp,
and iOS masks to a squircle. So the whole mark, brackets included, is drawn
inside a safe inset — the frame survives the mask instead of being trimmed
into four green stubs.

Drawn at 8x and downsampled, because the mark has curves and a 48px mdpi icon
drawn directly is a staircase.

    python3 scripts/make-icon.py
"""
import os
from PIL import Image, ImageDraw

GROUND = (0, 0, 0, 255)
SIGNAL = (0, 255, 65, 255)
INK = (0, 0, 0, 255)
PAPER = (255, 255, 255, 255)

SS = 8  # supersample factor
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

ANDROID = {  # density -> px
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}


def draw_mark_layers(s, ground=None, inset=0.0):
    """
    The mark at `s` px, already supersampled.

    `ground` fills behind it; `inset` pulls the artwork in from the edge as a
    fraction, so the same drawing serves the full-bleed legacy icon and the
    adaptive foreground that has to survive a mask.
    """
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if ground == "round":
        d.ellipse([0, 0, s - 1, s - 1], fill=GROUND)
    elif ground == "square":
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.17), fill=GROUND)

    # Everything below is expressed against a unit square, then mapped through
    # the inset — so a coordinate reads as "where in the design" rather than
    # "where on this particular canvas".
    o = s * inset
    e = s * (1 - 2 * inset)

    def x(u):
        return o + e * u

    # ── Speech bubble ────────────────────────────────────────────────
    # Square corners, not rounded: the design's geometry is hard, and the app
    # itself sets radius.sm to 6 on a 44px avatar for the same reason.
    d.rectangle([x(0.152), x(0.125), x(0.850), x(0.642)], fill=PAPER)
    # Tail, dropping from the bubble's bottom-left corner.
    d.polygon(
        [(x(0.152), x(0.642)), (x(0.152), x(0.858)), (x(0.360), x(0.642))],
        fill=PAPER,
    )

    # ── Padlock ──────────────────────────────────────────────────────
    body_top, body_bot = 0.372, 0.566
    d.rectangle([x(0.381), x(body_top), x(0.624), x(body_bot)], fill=INK)

    # Shackle: a semicircle on two straight legs, drawn after the body so the
    # legs can run under its top edge without a seam. Measured off the design —
    # the shackle stands about four fifths of the body's own height above it,
    # and getting that wrong is what makes a padlock read as a handbag.
    # Span and stroke are both measured, and the ratio between them is what
    # matters: at a stroke much over a third of the outer radius the hole
    # closes and the shackle reads as a solid blob rather than a loop.
    sl, sr = 0.421, 0.579
    sw = max(2, int(e * 0.042))
    arc_top = 0.178
    arc_h = (sr - sl) / 2
    d.arc(
        [x(sl), x(arc_top), x(sr), x(arc_top + 2 * arc_h)],
        start=180, end=360, fill=INK, width=sw,
    )
    for lx in (sl, sr - (sw / e)):
        d.rectangle([x(lx), x(arc_top + arc_h), x(lx) + sw, x(body_top + 0.01)], fill=INK)

    # Keyhole: a circle over a tapering stem, cut out of the lock body.
    kr = e * 0.032
    kcx, kcy = x(0.5025), x(0.437)
    d.ellipse([kcx - kr, kcy - kr, kcx + kr, kcy + kr], fill=PAPER)
    d.polygon(
        [
            (kcx - kr * 0.62, kcy),
            (kcx + kr * 0.62, kcy),
            (kcx + kr * 0.42, x(0.522)),
            (kcx - kr * 0.42, x(0.522)),
        ],
        fill=PAPER,
    )

    # ── The one green thing inside: a rule under the lock ────────────
    gh = max(1, int(e * 0.012))
    d.rectangle([x(0.381), x(0.566), x(0.624), x(0.566) + gh], fill=SIGNAL)

    # ── Corner brackets ──────────────────────────────────────────────
    # The same motif as components/CornerBrackets, which is why they are the
    # signal colour and a hairline rather than a frame.
    bw = max(2, int(e * 0.038))   # stroke
    bl = e * 0.175                # arm length
    # Pulled well in from the artwork's edge, and this is geometry rather than
    # taste. An adaptive icon only guarantees a *circle* of 66 of the 108dp
    # canvas; the corners of the 66dp square sit at radius 46.7 and the circle
    # stops at 33, so brackets placed at the square's edge are sliced into four
    # green stubs by any round launcher — which is exactly what happened. At
    # this inset they land inside the circle, and they end up framing the
    # bubble instead of the tile, which is the better composition anyway.
    bi = 0.092
    for cx, cy, sx, sy in (
        (x(bi), x(bi), 1, 1),
        (x(1 - bi), x(bi), -1, 1),
        (x(bi), x(1 - bi), 1, -1),
        (x(1 - bi), x(1 - bi), -1, -1),
    ):
        d.rectangle(sorted_box(cx, cy, cx + sx * bl, cy + sy * bw), fill=SIGNAL)
        d.rectangle(sorted_box(cx, cy, cx + sx * bw, cy + sy * bl), fill=SIGNAL)

    return img


def sorted_box(x0, y0, x1, y1):
    """PIL wants an ordered box; the bracket maths produces either order."""
    return [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]


def draw_mark(size, round_mask):
    """The legacy launcher icon at `size` px, ground included."""
    return draw_mark_layers(
        size * SS, "round" if round_mask else "square", inset=0.155
    ).resize((size, size), Image.LANCZOS)


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
    # 66/108 is the guaranteed-visible centre; the mark is drawn to fill it.
    # Slightly under the 66dp square, so that once the brackets are inset the
    # whole frame clears the guaranteed circle with room to spare.
    inner = int(s * 0.52)
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

    icon_set = os.path.join(ROOT, "ios/Chatterbox/Images.xcassets/AppIcon.appiconset")
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
