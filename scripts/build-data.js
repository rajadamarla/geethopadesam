#!/usr/bin/env node
/**
 * Builds the offline dataset used when no GITA_API_KEY is configured.
 *
 * Source: https://github.com/gita/gita  (the dataset that backs
 *         https://github.com/gita/bhagavad-gita-api)
 *
 * Output is shaped exactly like the GitaChapter / GitaVerse schemas served by
 * https://api.bhagavadgita.io/v2/, so the front-end cannot tell the two apart.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, '.raw');
const OUT = path.join(ROOT, 'data');

const FILES = {
  chapters: 'chapters.json',
  verse: 'verse.json',
  translation: 'translation.json',
  authors: 'authors.json',
  languages: 'languages.json',
};
const BASE = 'https://raw.githubusercontent.com/gita/gita/main/data';

async function ensureRaw() {
  fs.mkdirSync(RAW, { recursive: true });
  for (const file of Object.values(FILES)) {
    const dest = path.join(RAW, file);
    if (fs.existsSync(dest)) continue;
    process.stdout.write(`downloading ${file} ... `);
    const res = await fetch(`${BASE}/${file}`);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log('ok');
  }
}

const read = (file) => JSON.parse(fs.readFileSync(path.join(RAW, file), 'utf8'));

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const clean = (s) => (s || '').replace(/\r/g, '').trim();

async function main() {
  await ensureRaw();

  const chapters = read(FILES.chapters);
  const verses = read(FILES.verse);
  const translations = read(FILES.translation);
  const languages = read(FILES.languages);

  const langById = new Map(languages.map((l) => [l.id, l.language]));

  // group translations by verse id
  const byVerse = new Map();
  for (const t of translations) {
    if (!byVerse.has(t.verse_id)) byVerse.set(t.verse_id, []);
    byVerse.get(t.verse_id).push({
      id: t.id,
      description: clean(t.description),
      author_name: t.authorName,
      language: t.lang || langById.get(t.language_id) || 'english',
    });
  }

  const outChapters = chapters
    .sort((a, b) => a.chapter_number - b.chapter_number)
    .map((c) => ({
      id: c.id,
      name: clean(c.name),
      slug: c.image_name || slugify(c.name_translation),
      name_transliterated: clean(c.name_transliterated),
      name_translated: clean(c.name_translation),
      verses_count: c.verses_count,
      chapter_number: c.chapter_number,
      name_meaning: clean(c.name_meaning),
      chapter_summary: clean(c.chapter_summary),
      chapter_summary_hindi: clean(c.chapter_summary_hindi),
    }));

  fs.mkdirSync(path.join(OUT, 'verses'), { recursive: true });
  fs.writeFileSync(
    path.join(OUT, 'chapters.json'),
    JSON.stringify(outChapters, null, 1)
  );

  let totalVerses = 0;
  for (const chapter of outChapters) {
    const list = verses
      .filter((v) => v.chapter_number === chapter.chapter_number)
      .sort((a, b) => a.verse_order - b.verse_order)
      .map((v) => {
        const words = clean(v.transliteration).split(/\s+/).slice(0, 8).join(' ');
        return {
          id: v.id,
          verse_number: v.verse_number,
          chapter_number: v.chapter_number,
          slug: slugify(words) || `chapter-${v.chapter_number}-verse-${v.verse_number}`,
          text: clean(v.text),
          transliteration: clean(v.transliteration),
          word_meanings: clean(v.word_meanings),
          translations: (byVerse.get(v.id) || []).sort((a, b) =>
            a.author_name.localeCompare(b.author_name)
          ),
        };
      });
    totalVerses += list.length;
    fs.writeFileSync(
      path.join(OUT, 'verses', `${chapter.chapter_number}.json`),
      JSON.stringify(list, null, 1)
    );
  }

  console.log(
    `built ${outChapters.length} chapters and ${totalVerses} verses into data/`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
