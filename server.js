#!/usr/bin/env node
/**
 * Geethopadesam — server.
 *
 * Serves the static site and a small JSON API that mirrors the Bhagavad Gita
 * API (https://github.com/gita/bhagavad-gita-api):
 *
 *   GET /api/chapters                      ->  /v2/chapters/
 *   GET /api/chapters/:n                   ->  /v2/chapters/{n}/
 *   GET /api/chapters/:n/verses            ->  /v2/chapters/{n}/verses/
 *
 * The upstream API needs a key. Set GITA_API_KEY (and optionally GITA_API_HOST
 * for the RapidAPI gateway) and requests are proxied live; without a key the
 * server answers from data/, built by `npm run build:data` from the same
 * open dataset that backs the API. Responses are identical in shape either way.
 * The key stays server-side and is never exposed to the browser.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.GITA_API_KEY || '';
const API_BASE = process.env.GITA_API_BASE || 'https://api.bhagavadgita.io/v2';
const API_HOST = process.env.GITA_API_HOST || '';
const CACHE_TTL_MS = 10 * 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const cache = new Map();

function sendJson(res, status, body, meta = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Data-Source': meta.source || 'local',
  });
  res.end(payload);
}

/** Fetch from the upstream API, with a short in-process cache. */
async function fetchUpstream(pathname) {
  const hit = cache.get(pathname);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;

  const headers = { 'X-API-KEY': API_KEY, Accept: 'application/json' };
  if (API_HOST) {
    headers['X-RapidAPI-Key'] = API_KEY;
    headers['X-RapidAPI-Host'] = API_HOST;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API_BASE}${pathname}`, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
    const body = await res.json();
    cache.set(pathname, { at: Date.now(), body });
    return body;
  } finally {
    clearTimeout(timer);
  }
}

const readLocal = (file) =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

const localChapters = () => readLocal('chapters.json');
const localVerses = (n) => readLocal(path.join('verses', `${n}.json`));

/**
 * Resolve a request: try the live API first when a key exists, otherwise (or on
 * any upstream failure) fall back to the bundled dataset.
 */
async function resolve(upstreamPath, localFn) {
  if (API_KEY) {
    try {
      return { body: await fetchUpstream(upstreamPath), source: 'api' };
    } catch (err) {
      console.warn(`[gita] ${upstreamPath} -> ${err.message}; using local data`);
    }
  }
  return { body: localFn(), source: 'local' };
}

async function handleApi(req, res, url) {
  const parts = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '').split('/');

  // /api/chapters
  if (parts.length === 1 && parts[0] === 'chapters') {
    const { body, source } = await resolve('/chapters/', localChapters);
    return sendJson(res, 200, body, { source });
  }

  const num = Number(parts[1]);
  const validChapter = parts[0] === 'chapters' && Number.isInteger(num) && num >= 1 && num <= 18;

  // /api/chapters/:n
  if (parts.length === 2 && validChapter) {
    const { body, source } = await resolve(`/chapters/${num}/`, () =>
      localChapters().find((c) => c.chapter_number === num)
    );
    if (!body) return sendJson(res, 404, { detail: 'Chapter not found' });
    return sendJson(res, 200, body, { source });
  }

  // /api/chapters/:n/verses
  if (parts.length === 3 && validChapter && parts[2] === 'verses') {
    const { body, source } = await resolve(`/chapters/${num}/verses/`, () =>
      localVerses(num)
    );
    return sendJson(res, 200, body, { source });
  }

  if (parts[0] === 'chapters' && parts.length >= 2 && !validChapter) {
    return sendJson(res, 404, { detail: 'Chapter must be between 1 and 18' });
  }

  return sendJson(res, 404, { detail: 'Unknown endpoint' });
}

function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (!path.extname(rel)) rel += '.html';

  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>404</h1><p><a href="/">Back to Geethopadesam</a></p>');
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    serveStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { detail: 'Internal error' });
  }
});

server.listen(PORT, () => {
  const mode = API_KEY
    ? `live API (${API_BASE}) with local fallback`
    : 'bundled dataset (set GITA_API_KEY to use the live API)';
  console.log(`\n  ॐ  Geethopadesam running at http://localhost:${PORT}`);
  console.log(`     data source: ${mode}\n`);
});
