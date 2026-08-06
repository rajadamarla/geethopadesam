#!/usr/bin/env python3
"""Derive the site's logo files from public/assets/logo.png.

The source artwork is gold on solid black, which would read as a black slab on
the cream theme. Here that black becomes real transparency: alpha ramps with
pixel luminance, so the soft outer glow falls away instead of blooming into a
halo, and colour is lifted slightly so edge pixels don't fringe dark. Outputs
are palette-quantized to keep them small.

    python3 scripts/build-logo.py

Crop boxes are tuned to the current artwork — retune them if the logo changes.
"""
import os
import sys

from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'public', 'assets')
SOURCE = os.path.join(ASSETS, 'logo.png')

# (left, top, right, bottom) in the source image
MARK_BOX = (76, 270, 516, 710)      # the ॐ chakra, squared about its centre
LOCKUP_BOX = (70, 247, 1481, 725)   # chakra + wordmark + tagline

# background floor and the luminance at which a pixel becomes fully opaque
ALPHA_FLOOR, ALPHA_SOLID = 34, 118


def cut(src, box, size, colors):
    left, top, right, bottom = box
    a = src[top:bottom, left:right]
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    alpha = np.clip((lum - ALPHA_FLOOR) / (ALPHA_SOLID - ALPHA_FLOOR), 0, 1)
    lift = 0.70 + 0.30 * (lum / 255.0)
    rgb = np.clip(a / lift[..., None], 0, 255)
    img = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8))
    img = img.resize(size, Image.LANCZOS)
    return img.quantize(colors=colors, method=Image.FASTOCTREE,
                        dither=Image.FLOYDSTEINBERG)


def main():
    if not os.path.exists(SOURCE):
        sys.exit(f'missing {SOURCE}')
    src = np.asarray(Image.open(SOURCE).convert('RGB')).astype(np.float32)

    for box, size, name, colors in (
        (MARK_BOX,   (160, 160), 'logo-mark.png',   128),
        (MARK_BOX,   (96, 96),   'favicon.png',     128),
        (LOCKUP_BOX, (760, 258), 'logo-lockup.png', 160),
    ):
        path = os.path.join(ASSETS, name)
        cut(src, box, size, colors).save(path, optimize=True)
        print(f'{name:18} {size[0]}x{size[1]}  {os.path.getsize(path) / 1024:6.1f} KB')


if __name__ == '__main__':
    main()
