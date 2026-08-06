#!/usr/bin/env python3
"""Encode the served hero banners from the master artwork.

Two masters, because one shape can't serve both layouts:

  banner.png               3:1  -> banner.jpg         wide screens (>=700px)
  banner-mobile-master.jpg 16:9 -> banner-mobile.jpg  phones (<700px)

A 3:1 band is only ~140px tall on a phone, which leaves the wordmark painted
into it unreadable; the taller 16:9 crop gives it room. Replace either master
and re-run this.

PNG can't compress a photographic render (the 3:1 master is 2.2MB and stays
2.1MB even re-optimized), so what the site loads is progressive JPEG. The mobile
file is also downscaled — phones never need more than ~1200px across.

    python3 scripts/build-banner.py
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'public', 'assets')

# (master, output, max width or None to keep, quality, expected ratio)
JOBS = [
    ('banner.png',               'banner.jpg',        None, 90, 3.0),
    ('banner-mobile-master.jpg', 'banner-mobile.jpg', 1200, 86, 16 / 9),
]


def main():
    for master, out, max_width, quality, want_ratio in JOBS:
        src = os.path.join(ASSETS, master)
        dest = os.path.join(ASSETS, out)
        if not os.path.exists(src):
            sys.exit(f'missing {src}')

        im = Image.open(src).convert('RGB')
        ratio = im.size[0] / im.size[1]
        if max_width and im.size[0] > max_width:
            im = im.resize((max_width, round(max_width / ratio)), Image.LANCZOS)

        im.save(dest, 'JPEG', quality=quality, optimize=True, progressive=True)
        print(f'{master:26} -> {out:18} {im.size[0]}x{im.size[1]}  '
              f'{os.path.getsize(dest) / 1024:6.1f} KB')
        if abs(ratio - want_ratio) > 0.03:
            print(f'  note: {ratio:.2f}:1, expected {want_ratio:.2f}:1 — it will be '
                  'scaled to fit whole, with the sides filled by a blurred copy.')

    print('\nremember: the <img>/<source> width & height in public/index.html '
          'must match these dimensions.')


if __name__ == '__main__':
    main()
