import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createContentStore, validateContent } from '../src/content.mjs';

const base = 'https://s9v10.dev';
const item = (body, url = `${base}/programming/cs439/`) => ({
  title: 'CS439', slug: 'cs439', date: '', order: 1, tags: [], summary: body, body, url,
  links: [{ id: 'a', label: 'Website', url }],
});
const snapshot = body => ({
  schemaVersion: 1, sourceRevision: 'a'.repeat(40), name: 'Sid', quote: 'Hello', email: 'hi@example.org', base,
  about: item(body, `${base}/about.html`), socials: [], projects: [item(body)], art: [], blog: [],
});
const quiet = { info() {}, warn() {} };
const response = (data, etag = 'new') => new Response(JSON.stringify(data), { headers: { etag } });
async function cache(t) {
  const folder = await mkdtemp(join(tmpdir(), 's9v10-content-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return join(folder, 'content.json');
}

test('refresh publishes a new immutable snapshot, persists it, and reuses it after restart offline', async t => {
  const cachePath = await cache(t), old = snapshot('old'), next = snapshot('updated CS439');
  const requests = [];
  const store = await createContentStore({ initial: old, url: `${base}/terminal-content.json`, cachePath, logger: quiet,
    fetcher: async (url, options) => { requests.push({ url, options }); return response(next); } });
  const activeVisitor = store.get();
  assert.equal(await store.refresh(), true);
  assert.equal(store.get().projects[0].body, 'updated CS439');
  assert.equal(activeVisitor.projects[0].body, 'old');
  assert.deepEqual(JSON.parse(await readFile(cachePath, 'utf8')), next);
  assert.equal(await store.refresh(), false);
  assert.equal(requests[1].options.headers['If-None-Match'], 'new');
  assert.ok(requests[0].url.searchParams.has('refresh'));
  const restarted = await createContentStore({ initial: old, url: `${base}/terminal-content.json`, cachePath, logger: quiet,
    fetcher: async () => { throw new Error('offline'); } });
  assert.equal(await restarted.refresh(), false);
  assert.equal(restarted.get().projects[0].body, 'updated CS439');
});

test('HTTP errors, invalid JSON, bad schema, and timeouts preserve the snapshot and disk cache', async t => {
  const cachePath = await cache(t), good = snapshot('good');
  await writeFile(cachePath, JSON.stringify(good));
  const failures = [
    () => new Response('Unavailable', { status: 503 }),
    () => new Response('<html>Not JSON</html>'),
    () => response({ ...good, schemaVersion: 999 }),
    () => { throw new DOMException('Timeout', 'TimeoutError'); },
    () => new Response(null, { status: 304 }),
  ];
  const store = await createContentStore({ initial: snapshot('bundled'), url: `${base}/terminal-content.json`, cachePath,
    logger: quiet, fetcher: async () => failures.shift()() });
  const previous = store.get();
  while (failures.length) {
    assert.equal(await store.refresh(), false);
    assert.equal(store.get(), previous);
    assert.deepEqual(JSON.parse(await readFile(cachePath, 'utf8')), good);
  }
});

test('a corrupt cache falls back to bundled content; overlapping refreshes share one download', async t => {
  const cachePath = await cache(t); await writeFile(cachePath, 'broken');
  let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const store = await createContentStore({ initial: snapshot('bundled'), url: `${base}/terminal-content.json`, cachePath,
    logger: quiet, fetcher: async () => { calls++; await gate; return response(snapshot('new')); } });
  assert.equal(store.get().projects[0].body, 'bundled');
  const first = store.refresh(), second = store.refresh();
  assert.equal(first, second); assert.equal(calls, 1);
  release(); await first;
  assert.equal(store.get().projects[0].body, 'new');
});

test('response size is bounded with and without a content-length header', async () => {
  for (const knownLength of [true, false]) {
    const store = await createContentStore({ initial: snapshot('safe'), url: `${base}/terminal-content.json`, logger: quiet,
      fetcher: async () => knownLength
        ? new Response('small', { headers: { 'content-length': String(17 * 1024 * 1024) } })
        : new Response(new Uint8Array(17 * 1024 * 1024)) });
    assert.equal(await store.refresh(), false);
    assert.equal(store.get().projects[0].body, 'safe');
  }
});

test('text updates reuse unchanged artwork, while changed pixels get a new rendering cache', async () => {
  const original = snapshot('old');
  original.art = [{ ...item('art'), image: { width: 1, height: 1, channels: 3,
    pixels: deflateSync(Buffer.from([1, 2, 3])).toString('base64') } }];
  const textUpdate = structuredClone(original); textUpdate.projects[0].body = 'new text';
  const imageUpdate = structuredClone(textUpdate);
  imageUpdate.art[0].image.pixels = deflateSync(Buffer.from([4, 5, 6])).toString('base64');
  const versions = [textUpdate, imageUpdate];
  const store = await createContentStore({ initial: original, url: `${base}/terminal-content.json`, logger: quiet,
    fetcher: async () => response(versions.shift()) });
  await store.refresh(); assert.equal(store.get().art[0].image, original.art[0].image);
  await store.refresh(); assert.notEqual(store.get().art[0].image, original.art[0].image);
});

test('validation rejects unsafe links and malformed artwork before visitors can render it', () => {
  const data = snapshot('valid');
  data.projects[0].links[0].url = 'javascript:alert(1)';
  assert.throws(() => validateContent(data), /Invalid content/);
  data.projects = [];
  data.art = [{ ...item('art'), image: { width: 1, height: 1, channels: 3, pixels: deflateSync(Buffer.from([1, 2, 3])).toString('base64') } }];
  assert.equal(validateContent(data), data);
  data.art[0].image.width = 100_000;
  assert.throws(() => validateContent(data), /artwork/);
  data.art[0].image.width = 2;
  assert.throws(() => validateContent(data), /artwork pixels/);
});

test('automatic refresh starts immediately and polls again without restarting the app', { timeout: 2000 }, async t => {
  let calls = 0, second;
  const received = new Promise(resolve => { second = resolve; });
  const store = await createContentStore({ initial: snapshot('before'), url: `${base}/terminal-content.json`, logger: quiet,
    intervalMs: 10, fetcher: async () => { calls++; if (calls === 2) second(); return response(snapshot(`version ${calls}`)); } });
  t.after(() => store.stop()); store.start();
  await received; await store.refresh();
  assert.equal(store.get().projects[0].body, 'version 2');
  store.stop(); assert.equal(await store.refresh(), false);
});
