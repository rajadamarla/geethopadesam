# Geethopadesam · गीतोपदेशम्

The Bhagavad Gita on the web, chapter by chapter — all 18 chapters and 701
verses in the original Sanskrit, with transliteration, word-by-word meanings and
translations from classical commentators.

Built on the [Bhagavad Gita API](https://github.com/gita/bhagavad-gita-api)
(`GET /v2/chapters/` and `GET /v2/chapters/{n}/verses/`).

## Run it

```bash
npm start           # http://localhost:3000
npm run dev         # same, with auto-restart on file changes
```

No dependencies and no build step — Node 18+ is all it needs.

## Where the text comes from

The upstream API requires a key, so the site works two ways:

| | Data source | Setup |
|---|---|---|
| **Default** | `data/`, bundled in the repo | none |
| **Live** | `api.bhagavadgita.io` | set `GITA_API_KEY` |

```bash
GITA_API_KEY=your-key npm start
```

With a key set, the server proxies the live API, caches responses for 10 minutes,
and **falls back to `data/` if the call fails** — so the site never breaks on a
network hiccup. Every response carries an `X-Data-Source: api | local` header if
you want to check which path served it. The key stays server-side; the browser
only ever talks to this site's own `/api/*`.

Going through the RapidAPI gateway instead? Set `GITA_API_BASE` and
`GITA_API_HOST` too — see [.env.example](.env.example).

The bundled dataset is generated from [gita/gita](https://github.com/gita/gita),
the same open data that backs the API, shaped into the API's exact
`GitaChapter` / `GitaVerse` schemas:

```bash
npm run build:data   # downloads to .raw/ and writes data/
```

## Artwork

The full-bleed home banner, the header chakra, the footer lockup and the favicon
all live in `public/assets/` — see
[public/assets/README.md](public/assets/README.md) for sizes, how the logo files
are derived from `logo.png`, and how to swap any of them out.

## Layout

```
server.js              static files + /api/* mirroring the Gita API
scripts/build-data.js  builds data/ from the open dataset
scripts/build-logo.py  derives the logo files from public/assets/logo.png
data/                  chapters.json + verses/1..18.json
public/
  index.html           banner, chapter grid, search
  chapter.html         one chapter, verse by verse
  app.js               fetches /api/*, renders both pages
  styles.css           light + dark themes
  assets/              banner, logo files, favicon
```

## What you can do on the site

- Browse all 18 chapters as cards, with live text search across names and summaries
  (matching either script, so `సాంఖ్య` and `सांख्य` both find chapter 2).
- Read any chapter verse by verse: Sanskrit, transliteration, translation, word meanings.
- Read the Sanskrit in **తెలుగు or देवनागरी script** — switched from the header,
  applies site-wide, and remembered. Telugu is the default. See below.
- Switch translation language (English / Hindi) and translator — the choice is remembered.
- Toggle transliteration and word meanings off for a cleaner read.
- Read chapter summaries in English or Hindi.
- Jump to a verse number, or deep-link one: `/chapter?ch=2#verse-47`.
- Light and dark themes, following your system setting by default.

## Telugu script

The site is named in Telugu, but the API carries only English and Hindi
translations plus the Sanskrit source — no Telugu at all. What it does allow is
the Sanskrit itself in Telugu letters, which is how Telugu editions of the Gita
print the shlokas.

Devanagari and Telugu are both Brahmic abugidas and Unicode lays their blocks
out in parallel, so the conversion is a **+0x300 codepoint shift** — exact,
reversible, and done in the browser (`toTelugu` in [public/app.js](public/app.js)).
Two details it handles:

- Only codepoints with an assigned Telugu counterpart are shifted; anything else
  passes through rather than rendering as an empty box.
- This source spells long ṝ as `ृ` + nukta (`पितृ़न` for *pitṝn*). Telugu writes
  it with a single sign, so that pair maps to `ౄ` and stray nuktas are dropped.

Verified across all 701 verses: no leftover Devanagari, no unassigned codepoints.

**This is transliteration, not translation** — same words, same sounds, Telugu
letters. The verse translations remain English or Hindi. A Telugu translation
would need a source the API doesn't provide.

## Notes on the source text

About a third of the verses arrive from the dataset as one unbroken run of
Devanagari. The shloka lines are laid out client-side (`formatSanskrit` in
[public/app.js](public/app.js)) by breaking after each single daṇḍa and after a
speaker's `उवाच`, leaving the closing `।।n.n।।` intact.

## Credit

Verse text, transliterations and translations © their respective translators,
made available through the [Bhagavad Gita API](https://github.com/gita/bhagavad-gita-api)
project (MIT).
