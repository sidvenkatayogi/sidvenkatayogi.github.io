import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { frontmatter, plainMarkdown, extractLinks, linkedMarkdown } from '../scripts/build-content.mjs';
import { letter, labelLinks } from '../src/links.mjs';
import { validateContent } from '../src/content.mjs';

// Interface tests use the committed fixture; these checks verify the fresh build.
const contentPath = process.env.CONTENT_OUTPUT || new URL('../content/site.json', import.meta.url);

test('content snapshot covers the actual Jekyll collections and canonical routes', () => {
  const data = JSON.parse(readFileSync(contentPath, 'utf8'));
  validateContent(data);
  for (const [key, folder] of [['projects', '_projects'], ['art', '_art'], ['blog', '_posts']]) {
    const files = readdirSync(new URL(`../../${folder}/`, import.meta.url)).filter(file => file.endsWith('.md'));
    assert.equal(data[key].length, files.length);
    assert.equal(new Set(data[key].map(item => item.url)).size, files.length);
    for (const item of data[key]) assert.match(item.url, /^https:\/\/s9v10\.dev\//);
  }
  assert.deepEqual(data.blog.map(item => item.date), data.blog.map(item => item.date).sort().reverse());
  for (const file of readdirSync(new URL('../../_posts/', import.meta.url)).filter(file => file.endsWith('.md'))) {
    const { meta } = frontmatter(readFileSync(new URL(`../../_posts/${file}`, import.meta.url), 'utf8'));
    assert.ok(data.blog.some(item => item.url === `https://s9v10.dev/blog/${String(meta.date).slice(0, 10).replaceAll('-', '/')}/${meta.slug}/`));
  }
});

test('inline links and reference rows share letters, including repeats and more than 26 links', () => {
  const source = '[First](/art) and <a href="/art">again</a>, [Second](https://example.org).\n<iframe src="https://video.example.org"></iframe>';
  const refs = labelLinks(extractLinks(source));
  assert.deepEqual(refs.map(link => link.id), ['a', 'b', 'c']);
  const text = linkedMarkdown(source, refs);
  assert.match(text, /First \[a\].*again \[a\].*Second \[b\]/);
  assert.match(text, /Video demo \[c\]/);
  assert.equal(letter(25), 'z'); assert.equal(letter(26), 'aa'); assert.equal(letter(27), 'ab');
  const bare = labelLinks(extractLinks('See https://example.org/page.'));
  assert.equal(linkedMarkdown('See https://example.org/page.', bare), 'See https://example.org/page [a].');
  assert.equal(labelLinks([{ label: 'bad', url: 'javascript:bad()' }]).length, 0);
  const site = JSON.parse(readFileSync(contentPath, 'utf8'));
  for (const item of [...site.projects, ...site.art, ...site.blog, site.about]) {
    for (const match of item.body.matchAll(/\[([a-z]+)\]/g)) assert.ok(item.links.some(link => link.id === match[1]));
    assert.ok(item.links.some(link => link.url === item.url));
  }
});

test('front matter supports quoted titles; malformed source fails loudly', () => {
  assert.equal(frontmatter('---\ntitle: "a: b"\n---\nBody').meta.title, 'a: b');
  assert.throws(() => frontmatter('No metadata'), /front matter/);
});

test('Markdown hides comments, embeds and escape sequences but preserves readable text', () => {
  const text = plainMarkdown('<!-- private -->\n### Hello **there**\n<script>bad()</script>\n[Site](/art)\n\x1b[2Jok');
  assert.ok(!text.includes('private') && !text.includes('bad()') && !text.includes('\x1b'));
  assert.match(text, /Hello there/); assert.match(text, /Site/);
  assert.deepEqual(extractLinks('[Site](/art) [bad](javascript:evil) <!-- [secret](https://example.org) -->'),
    [{ label: 'Site', url: 'https://s9v10.dev/art' }]);
});
