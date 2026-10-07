import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { inflateSync } from 'node:zlib';
import { safeURL } from './text.mjs';

const MAX_BYTES = 16 * 1024 * 1024;

export function validateContent(data) {
  const require = (ok, message) => { if (!ok) throw new Error(`Invalid content: ${message}`); };
  const text = value => typeof value === 'string' && value.length <= 1_000_000 && !/[^\x20-\x7e\n]/.test(value);
  const links = value => Array.isArray(value) && value.length <= 1024 && value.every(link =>
    text(link.label) && typeof link.url === 'string' && !!safeURL(link.url));
  const entry = item => item && text(item.title) && text(item.body) && typeof item.url === 'string'
    && item.url.startsWith('https://s9v10.dev/') && !!safeURL(item.url) && links(item.links)
    && item.links.every(link => /^[a-z]+$/.test(link.id));
  require(data?.schemaVersion === 1, 'unsupported schema');
  require(data.sourceRevision === null || /^[a-f0-9]{40,64}$/.test(data.sourceRevision), 'revision');
  require(data.base === 'https://s9v10.dev', 'website origin');
  for (const key of ['name', 'quote', 'email']) require(text(data[key]) && data[key].length > 0, key);
  require(entry(data.about), 'about');
  require(links(data.socials), 'socials');
  for (const key of ['projects', 'art', 'blog']) {
    require(Array.isArray(data[key]) && data[key].length <= 1000, key);
    require(data[key].every(item => entry(item) && text(item.slug) && text(item.summary)
      && text(item.date) && Number.isFinite(item.order) && Array.isArray(item.tags) && item.tags.every(text)), `${key} entries`);
    require(new Set(data[key].map(item => item.url)).size === data[key].length, `${key} duplicate URLs`);
  }
  for (const { image } of data.art) {
    require(image && [image.width, image.height].every(n => Number.isInteger(n) && n > 0 && n <= 480)
      && image.channels === 3 && typeof image.pixels === 'string' && image.pixels.length <= 1_000_000
      && /^[A-Za-z0-9+/]+={0,2}$/.test(image.pixels), 'artwork');
    const size = image.width * image.height * 3;
    require(inflateSync(Buffer.from(image.pixels, 'base64'), { maxOutputLength: size }).length === size, 'artwork pixels');
  }
  return data;
}

// An update replaces the snapshot, so connected visitors keep a consistent view.
export async function createContentStore({ initial, url, cachePath, fetcher = fetch, logger = console, intervalMs = 60_000 } = {}) {
  let current = validateContent(initial), etag, digest, pending, timer, stopped = false;
  if (cachePath) {
    try {
      const saved = await readFile(cachePath);
      if (saved.length > MAX_BYTES) throw new Error('Content cache is too large');
      current = validateContent(JSON.parse(saved));
    } catch (error) {
      if (error.code !== 'ENOENT') logger.warn(`Using bundled content: ${error.message}`);
    }
  }
  async function update() {
    if (!url || stopped) return false;
    try {
      const target = new URL(url);
      // GitHub Pages caches for ten minutes; a minute key checks the current deployment.
      target.searchParams.set('refresh', String(Math.floor(Date.now() / 60_000)));
      const response = await fetcher(target, {
        headers: etag ? { 'If-None-Match': etag } : {},
        signal: AbortSignal.timeout(15_000), redirect: 'error',
      });
      if (response.status === 304) return false;
      if (!response.ok) throw new Error(`Content HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > MAX_BYTES) {
        await response.body?.cancel(); throw new Error('Content response is too large');
      }
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_BYTES) throw new Error('Content response is too large');
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks, size);
      const nextDigest = createHash('sha256').update(body).digest('hex');
      if (nextDigest === digest) { etag = response.headers.get('etag'); return false; }
      const next = validateContent(JSON.parse(body));
      if (stopped) return false;
      // Reuse the existing ASCII rendering cache when only text has changed.
      for (const item of next.art) {
        const previous = current.art.find(old => old.url === item.url)?.image;
        if (previous && ['width', 'height', 'channels', 'pixels', 'source'].every(key => previous[key] === item.image[key])) {
          item.image = previous;
        }
      }
      if (cachePath) {
        await mkdir(dirname(cachePath), { recursive: true });
        await writeFile(`${cachePath}.tmp`, body, { mode: 0o600 });
        await rename(`${cachePath}.tmp`, cachePath);
      }
      current = next; digest = nextDigest; etag = response.headers.get('etag');
      logger.info(`Terminal content refreshed: ${next.sourceRevision || nextDigest.slice(0, 12)}`);
      return true;
    } catch (error) {
      logger.warn(`Keeping last working terminal content: ${error.message}`);
      return false;
    }
  }
  const refresh = () => pending ||= update().finally(() => { pending = undefined; });
  return {
    get: () => current,
    refresh,
    start() {
      if (timer || !url || stopped) return;
      void refresh();
      timer = setInterval(refresh, intervalMs); timer.unref();
    },
    stop() { stopped = true; clearInterval(timer); },
  };
}
