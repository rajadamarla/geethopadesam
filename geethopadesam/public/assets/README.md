# Site assets

| File | Used for | Notes |
|---|---|---|
| `banner.png` | Master — wide | Source artwork, 2172×724 (3:1). Not loaded by the site. |
| `banner-mobile-master.jpg` | Master — phone | Source artwork, 1672×941 (16:9). Not loaded by the site. |
| `banner.jpg` | Hero, ≥700px | Generated. Full-bleed in a **3:1** box, edge to edge with no crop. |
| `banner-mobile.jpg` | Hero, <700px | Generated, 1200×675. A 3:1 band is only ~140px tall on a phone, leaving its wordmark unreadable; the 16:9 crop gives it room. |
| `logo.png` | Source artwork | The original gold-on-black lockup. Not loaded by the site; kept as the master to re-derive the two below. |
| `logo-mark.png` | Header brand mark | The ॐ chakra alone, 160px, transparent background. |
| `logo-lockup.png` | Footer | The full lockup (chakra + wordmark + tagline), 760px, transparent background. |
| `favicon.png` | Browser tab | 96px chakra. |

## Re-deriving the logo files

`logo.png` is gold on solid black, which would show as a black slab on the cream
theme. The two derived files replace that black with real transparency: alpha
ramps with pixel luminance (from a floor of 34 up to solid at 118), which drops
the soft outer glow instead of blooming it into a halo, and the colour is lifted
slightly so edge pixels don't fringe dark. They're then palette-quantized —
together they're about 66 KB rather than the ~1 MB the straight cuts weighed.

If you replace `logo.png`, regenerate them with
[`scripts/build-logo.py`](../../scripts/build-logo.py):

```bash
python3 scripts/build-logo.py
```

The crop boxes in that script are tuned to the current artwork — if the new logo
is laid out differently, adjust `MARK_BOX` and `LOCKUP_BOX`.

## Replacing the banner

There are two, picked by a `<picture>` element at a 700px breakpoint. Save new
artwork over the master you want to change, then:

```bash
python3 scripts/build-banner.py
```

That writes the JPEGs the site actually loads. The conversion earns its keep:
PNG can't compress a photographic render — the 3:1 master is 2.2 MB and stays
2.1 MB even re-optimized, while the JPEG is 362 KB and visually identical. The
mobile one is also downscaled to 1200px, since phones never need more.

**Wide (`banner.png`) — ratio 3:1.** Currently 2172×724. 2880×960 would be
sharper on retina displays; 2400×800 is a good middle ground.

**Phone (`banner-mobile-master.jpg`) — ratio 16:9**, or anything taller. It's
shown whole at the full screen width, so the only real requirement is that any
baked-in text still reads at ~400px across.

At 3:1 the artwork fills the band edge to edge with nothing cropped, at these
heights (measured, not estimated):

| Viewport width | Banner height |
|---|---|
| 1280 | 427 px |
| 1440 | 480 px |
| 1920 | 640 px |

Composition notes:

- Nothing is ever cropped at 3:1, so the whole canvas is usable — but keep the
  wordmark, tagline and faces clear of the outer ~4% so nothing sits awkwardly
  against a screen edge.
- Art at any other ratio still works: it's scaled down whole and the space
  beside it is filled with a blurred, darkened copy of itself.

If you change either artwork's dimensions, update the matching `width`/`height`
on the `<source>` and `<img>` in [`../index.html`](../index.html) — they reserve
the right space before the image loads. To change the wide band's proportions,
edit `aspect-ratio` on `.banner` in [`../styles.css`](../styles.css); a larger
first number means shorter and wider. To move the breakpoint, change it in both
the `<source media>` attribute and that `@media` rule. If `banner.jpg` is
missing, the home page falls back to a plain text title rather than breaking.
