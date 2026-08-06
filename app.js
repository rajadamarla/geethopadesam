/* Geethopadesam — front-end.
   Talks only to this site's /api/*, which mirrors the Bhagavad Gita API
   (GET /v2/chapters/ and /v2/chapters/{n}/verses/). */

const PREF = {
  get(key, fallback) {
    try { return localStorage.getItem('geethopadesam-' + key) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('geethopadesam-' + key, value); } catch { /* ignore */ }
  },
};

async function api(path) {
  const res = await fetch('/api' + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* The source text separates each line of a shloka with a blank line, which
   `white-space: pre-line` would render as a full empty row. */
const tidy = (s) => String(s ?? '').replace(/\n{2,}/g, '\n').trim();

/* About a third of the verses arrive as one unbroken run of Devanagari, so the
   shloka is laid out here instead: break after each single daṇḍa (keeping the
   double daṇḍa that closes the verse intact), and after a speaker's "उवाच"
   when it has run into the first line. */
const DANDA_PAIR = '\u0000'; // sentinel so the closing '।।' survives the split
const formatSanskrit = (raw) =>
  tidy(raw)
    .replace(/।।/g, DANDA_PAIR)
    .replace(/।\s*/g, '।\n')
    .split(DANDA_PAIR)
    .join('।।')
    .replace(/(उवाच)(?=[^\s।])/g, '$1\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

/* ------------------------- Telugu script ---------------------------
   Devanagari and Telugu are both Brahmic abugidas, and Unicode lays their
   blocks out in parallel, so the same Sanskrit renders in Telugu script by
   shifting each codepoint by 0x300. This is transliteration, not translation:
   identical words, identical sounds, Telugu letters — which is exactly how
   Telugu editions of the Gita print the shlokas.

   Only codepoints whose Telugu counterpart is actually assigned are shifted;
   anything else passes through unchanged rather than becoming an empty box. */
const TELUGU_SHIFT = 0x300;
const TELUGU_SAFE = [
  [0x0900, 0x0903], // candrabindu, anusvara, visarga
  [0x0905, 0x090c], // independent vowels a .. vocalic l
  [0x090e, 0x0910], // short e, e, ai        (0x090d has no Telugu form)
  [0x0912, 0x0928], // short o, o, au, ka .. na
  [0x092a, 0x0939], // pa .. ha              (0x0929 has no Telugu form)
  [0x093d, 0x0944], // avagraha, vowel signs aa .. vocalic rr
  [0x0946, 0x0948],
  [0x094a, 0x094d], // .. virama
  [0x0960, 0x0963], // vocalic RR, LL and their signs
  [0x0966, 0x096f], // digits
];

const inTeluguRange = (cp) => TELUGU_SAFE.some(([lo, hi]) => cp >= lo && cp <= hi);

function toTelugu(text) {
  // This source writes long ṝ as "ृ + nukta" (पितृ़न for pitṝn); Telugu spells
  // it with a single sign, and Telugu has no nukta for the stray cases.
  const src = String(text ?? '').replace(/ृ़/g, 'ॄ');

  let out = '';
  for (const ch of src) {
    const cp = ch.codePointAt(0);
    if (cp === 0x093c) continue;                 // leftover nukta
    if (cp === 0x0950) { out += 'ఓం'; continue; } // ॐ has no Telugu glyph
    out += inTeluguRange(cp) ? String.fromCodePoint(cp + TELUGU_SHIFT) : ch;
  }
  return out;
}

/** Render Devanagari source in the reader's chosen script. */
const inScript = (text, script) => (script === 'telugu' ? toTelugu(text) : text);

function showState(container, message, kind = '') {
  container.innerHTML = '';
  const state = el('div', 'state ' + kind);
  if (!kind) state.append(el('span', 'om-spin', 'ॐ'));
  state.append(el('p', null, esc(message)));
  container.append(state);
}

/* ------------------------------ theme ------------------------------ */

function initTheme() {
  const button = document.getElementById('theme-toggle');
  if (!button) return;
  const paint = () => {
    button.textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '◐';
  };
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    PREF.set('theme', next);
    paint();
  });
  paint();
}

/* The reader's current script, so late-rendered bits can ask for it. */
let currentScript = PREF.get('script', 'telugu'); // Telugu default — the site is named in it

/* Standing Sanskrit in the markup (the hero shloka, ॐ तत्सत्, and so on) is
   authored in Devanagari and carries the original on a data-sanskrit attribute,
   so it can be re-rendered in either script without losing the source. */
function paintStandingSanskrit() {
  document.querySelectorAll('[data-sanskrit]').forEach((node) => {
    node.textContent = inScript(node.dataset.sanskrit, currentScript);
    node.dataset.script = currentScript;
  });
}

/* The script switch lives in the site header, so both pages share this. It
   returns the current choice and calls back whenever the reader changes it. */
function initScriptSwitch(onChange) {
  const group = document.getElementById('script-switch');
  paintStandingSanskrit();
  if (!group) return currentScript;

  const paint = () =>
    group.querySelectorAll('button[data-script]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.script === currentScript))
    );
  paint();

  group.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-script]');
    if (!button || button.dataset.script === currentScript) return;
    currentScript = button.dataset.script;
    PREF.set('script', currentScript);
    paint();
    paintStandingSanskrit();
    onChange(currentScript);
  });

  return currentScript;
}

/* ------------------------------ banner ----------------------------- */

/* The artwork carries the wordmark. If it hasn't been dropped into
   public/assets/ yet, fall back to the text title instead of a broken image. */
function initBanner() {
  const hero = document.getElementById('hero');
  const image = hero && hero.querySelector('#banner img');
  if (!hero || !image) return;
  const missing = () => hero.setAttribute('data-banner', 'missing');
  if (image.complete && image.naturalWidth === 0) missing();
  image.addEventListener('error', missing);
}

/* ------------------------------ home ------------------------------- */

function chapterCard(chapter, script) {
  const card = el('a', 'chapter-card');
  card.href = `/chapter?ch=${chapter.chapter_number}`;
  card.innerHTML = `
    <div class="chapter-num">Chapter ${chapter.chapter_number}</div>
    <p class="chapter-deva" data-script="${esc(script)}">${esc(inScript(chapter.name, script))}</p>
    <h3 class="chapter-title">${esc(chapter.name_transliterated)}</h3>
    <p class="chapter-meaning">${esc(chapter.name_meaning)}</p>
    <p class="chapter-summary">${esc(chapter.chapter_summary)}</p>
    <div class="chapter-foot">
      <span>${chapter.verses_count} verses</span>
      <span class="go">Read →</span>
    </div>`;
  card.dataset.search = [
    chapter.chapter_number,
    chapter.name,
    toTelugu(chapter.name), // searchable by either script
    chapter.name_transliterated,
    chapter.name_translated,
    chapter.name_meaning,
    chapter.chapter_summary,
  ].join(' ').toLowerCase();
  return card;
}

async function renderHome() {
  initTheme();
  initBanner();
  const grid = document.getElementById('chapter-grid');

  let chapters;
  try {
    chapters = await api('/chapters');
  } catch (err) {
    return showState(grid, `Could not load the chapters — ${err.message}`, 'error');
  }

  const search = document.getElementById('chapter-search');
  const count = document.getElementById('chapter-count');
  const countDefault = count.innerHTML; // holds the script-aware अध्यायाः span

  const paintCards = (script) => {
    grid.innerHTML = '';
    chapters.forEach((chapter) => grid.append(chapterCard(chapter, script)));
    search.dispatchEvent(new Event('input')); // keep any active filter applied
  };

  paintCards(initScriptSwitch(paintCards));

  const totalVerses = chapters.reduce((sum, c) => sum + (c.verses_count || 0), 0);
  document.getElementById('stat-chapters').textContent = chapters.length;
  document.getElementById('stat-verses').textContent = totalVerses;

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    grid.querySelectorAll('.chapter-card').forEach((card) => {
      const match = !query || card.dataset.search.includes(query);
      card.hidden = !match;
      if (match) shown += 1;
    });
    if (query) {
      count.textContent = `${shown} chapter${shown === 1 ? '' : 's'} matching “${search.value.trim()}”`;
    } else {
      count.innerHTML = countDefault;
      paintStandingSanskrit();
    }
  });
}

/* ----------------------------- chapter ----------------------------- */

function renderChapterHero(chapter) {
  const hero = document.getElementById('chapter-hero');
  hero.className = 'chapter-hero';
  hero.innerHTML = `
    <div class="eyebrow">Chapter ${chapter.chapter_number} of 18 · ${chapter.verses_count} verses</div>
    <h1 id="chapter-name">${esc(chapter.name)}</h1>
    <p class="translit">${esc(chapter.name_transliterated)}</p>
    <p class="meaning">${esc(chapter.name_translated)} — ${esc(chapter.name_meaning)}</p>
    <div class="summary-box" id="summary-box" data-lang="english">
      <div class="summary-label">
        <span>Chapter summary</span>
      </div>
      <div id="summary-body"></div>
      <div class="pill-group" id="summary-lang" style="margin-top:.9rem">
        <button type="button" data-lang="english" aria-pressed="true">English</button>
        <button type="button" data-lang="hindi" aria-pressed="false">हिन्दी</button>
      </div>
    </div>`;

  const box = document.getElementById('summary-box');
  const body = document.getElementById('summary-body');
  const paint = (lang) => {
    const text = lang === 'hindi' ? chapter.chapter_summary_hindi : chapter.chapter_summary;
    box.dataset.lang = lang;
    body.innerHTML = String(text || '')
      .split(/\n+/)
      .filter(Boolean)
      .map((p) => `<p>${esc(p)}</p>`)
      .join('');
  };
  paint('english');

  document.getElementById('summary-lang').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-lang]');
    if (!button) return;
    document.querySelectorAll('#summary-lang button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b === button))
    );
    paint(button.dataset.lang);
  });

  document.title = `${chapter.chapter_number}. ${chapter.name_transliterated} — Geethopadesam`;
}

function wordMeaningsHtml(raw) {
  return String(raw || '')
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      // glosses are "term—meaning"; never split on the hyphens inside a term
      const [term, ...rest] = pair.split(/[—–]/);
      const gloss = rest.join('—').trim();
      return gloss
        ? `<b>${esc(term.trim())}</b> — ${esc(gloss)}`
        : esc(pair);
    })
    .join('; ');
}

function verseNode(verse, options) {
  const node = el('article', 'verse');
  node.id = `verse-${verse.verse_number}`;

  const pick =
    verse.translations.find(
      (t) => t.author_name === options.author && t.language === options.language
    ) ||
    verse.translations.find((t) => t.language === options.language) ||
    verse.translations[0];

  const parts = [
    `<div class="verse-head">
       <a class="verse-no" href="#verse-${verse.verse_number}">${verse.chapter_number}.${verse.verse_number}</a>
       <span class="verse-rule"></span>
     </div>`,
    `<p class="verse-sanskrit" data-script="${esc(options.script)}">${
       esc(inScript(formatSanskrit(verse.text), options.script))}</p>`,
  ];

  if (options.showTransliteration && verse.transliteration) {
    parts.push(`<p class="verse-translit">${esc(tidy(verse.transliteration))}</p>`);
  }

  if (pick) {
    parts.push(`<blockquote class="verse-translation" data-lang="${esc(pick.language)}">
        ${esc(tidy(pick.description))}
        <span class="attrib">${esc(pick.author_name)} · ${esc(titleCase(pick.language))}</span>
      </blockquote>`);
  }

  if (options.showWordMeanings && verse.word_meanings) {
    parts.push(`<details${options.wordMeaningsOpen ? ' open' : ''}>
        <summary>Word meanings</summary>
        <p class="word-meanings">${wordMeaningsHtml(verse.word_meanings)}</p>
      </details>`);
  }

  node.innerHTML = parts.join('\n');
  return node;
}

function renderControls(verses, options, redraw) {
  const host = document.getElementById('controls');
  host.className = 'controls';

  // authors available for this chapter, grouped by language
  const byLanguage = new Map();
  verses.forEach((verse) =>
    verse.translations.forEach((t) => {
      if (!byLanguage.has(t.language)) byLanguage.set(t.language, new Set());
      byLanguage.get(t.language).add(t.author_name);
    })
  );

  const languages = [...byLanguage.keys()].sort();
  if (!languages.includes(options.language)) options.language = languages[0];

  const authorsFor = (lang) => [...(byLanguage.get(lang) || [])].sort();
  if (!authorsFor(options.language).includes(options.author)) {
    options.author = authorsFor(options.language)[0];
  }

  host.innerHTML = `
    <div class="field">
      <label for="lang-select">Language</label>
      <select id="lang-select">
        ${languages.map((l) =>
          `<option value="${esc(l)}"${l === options.language ? ' selected' : ''}>${esc(titleCase(l))}</option>`
        ).join('')}
      </select>
    </div>
    <div class="field">
      <label for="author-select">Translation</label>
      <select id="author-select">
        ${authorsFor(options.language).map((a) =>
          `<option value="${esc(a)}"${a === options.author ? ' selected' : ''}>${esc(a)}</option>`
        ).join('')}
      </select>
    </div>
    <label class="toggle">
      <input type="checkbox" id="translit-toggle"${options.showTransliteration ? ' checked' : ''}>
      Transliteration
    </label>
    <label class="toggle">
      <input type="checkbox" id="words-toggle"${options.showWordMeanings ? ' checked' : ''}>
      Word meanings
    </label>
    <div class="field" style="margin-left:auto">
      <label for="verse-jump">Go to verse</label>
      <input type="number" id="verse-jump" min="1" max="${verses.length}" style="width:5.2rem" placeholder="1">
    </div>`;

  const languageSelect = document.getElementById('lang-select');
  const authorSelect = document.getElementById('author-select');

  languageSelect.addEventListener('change', () => {
    options.language = languageSelect.value;
    options.author = authorsFor(options.language)[0];
    PREF.set('language', options.language);
    PREF.set('author', options.author);
    redraw();
  });

  authorSelect.addEventListener('change', () => {
    options.author = authorSelect.value;
    PREF.set('author', options.author);
    redraw();
  });

  document.getElementById('translit-toggle').addEventListener('change', (e) => {
    options.showTransliteration = e.target.checked;
    PREF.set('translit', String(e.target.checked));
    redraw();
  });

  document.getElementById('words-toggle').addEventListener('change', (e) => {
    options.showWordMeanings = e.target.checked;
    PREF.set('words', String(e.target.checked));
    redraw();
  });

  document.getElementById('verse-jump').addEventListener('change', (e) => {
    const n = Number(e.target.value);
    const target = document.getElementById(`verse-${n}`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderPager(chapters, current) {
  const pager = document.getElementById('pager');
  const prev = chapters.find((c) => c.chapter_number === current - 1);
  const next = chapters.find((c) => c.chapter_number === current + 1);
  pager.innerHTML = [
    prev
      ? `<a class="prev" href="/chapter?ch=${prev.chapter_number}">
           <span class="dir">← Chapter ${prev.chapter_number}</span>
           <span class="label">${esc(prev.name_transliterated)}</span>
         </a>`
      : '',
    next
      ? `<a class="next" href="/chapter?ch=${next.chapter_number}">
           <span class="dir">Chapter ${next.chapter_number} →</span>
           <span class="label">${esc(next.name_transliterated)}</span>
         </a>`
      : '',
  ].join('');
}

async function renderChapter() {
  initTheme();
  const list = document.getElementById('verse-list');

  const requested = Number(new URLSearchParams(location.search).get('ch'));
  const number = Number.isInteger(requested) && requested >= 1 && requested <= 18 ? requested : 1;

  let chapter, verses, chapters;
  try {
    [chapter, verses, chapters] = await Promise.all([
      api(`/chapters/${number}`),
      api(`/chapters/${number}/verses`),
      api('/chapters'),
    ]);
  } catch (err) {
    return showState(list, `Could not load this chapter — ${err.message}`, 'error');
  }

  renderChapterHero(chapter);
  renderPager(chapters, chapter.chapter_number);

  const options = {
    script: 'telugu', // replaced below by the header switch's current value
    language: PREF.get('language', 'english'),
    author: PREF.get('author', 'Swami Sivananda'),
    showTransliteration: PREF.get('translit', 'true') === 'true',
    showWordMeanings: PREF.get('words', 'true') === 'true',
    wordMeaningsOpen: false,
  };

  const heading = document.getElementById('chapter-name');

  let firstDraw = true;
  const draw = () => {
    heading.dataset.script = options.script;
    heading.textContent = inScript(chapter.name, options.script);

    list.innerHTML = '';
    verses.forEach((verse) => list.append(verseNode(verse, options)));
    // honour a /chapter?ch=2#verse-47 deep link, but don't yank the reader back
    // there every time they switch translator or toggle a panel
    if (firstDraw && location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView({ block: 'start' });
    }
    firstDraw = false;
  };

  options.script = initScriptSwitch((script) => {
    options.script = script;
    draw();
  });

  renderControls(verses, options, draw);
  draw();
}
