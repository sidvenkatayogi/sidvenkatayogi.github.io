import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatMarkdown } from '../src/markdown.mjs';
import { wrap } from '../src/text.mjs';
import { App } from '../src/app.mjs';
import { content, render, strip } from '../src/render.mjs';

test('tables use aligned columns, ASCII borders and Markdown column alignment', () => {
  const source = '| Name | Score |\n| :--- | ---: |\n| Alpha | 12 |\n| B | 3.5 |';
  assert.deepEqual(formatMarkdown(source, 80), [
    '+-------+-------+',
    '| Name  | Score |',
    '+-------+-------+',
    '| Alpha |    12 |',
    '| B     |   3.5 |',
    '+-------+-------+',
  ]);
  const centered = formatMarkdown('| Name |\n| :---: |\n| X |', 80);
  assert.ok(centered.includes('|  X   |'));
});

test('tables wrap cells to fit and use labeled values on narrow screens', () => {
  const source = '| Name | Description |\n| --- | --- |\n| Alpha | A longer description with a reference [a] |\n| Beta | Other value |';
  const normal = formatMarkdown(source, 32);
  assert.ok(normal.filter(line => line.startsWith('|')).length > 3);
  assert.ok(normal.every(line => line.length === normal[0].length));
  assert.match(normal.join('\n'), /\[a\]/);
  const narrow = formatMarkdown(source, 18).join('\n');
  assert.match(narrow, /Name: Alpha/);
  assert.match(narrow, /Name: Beta/);
  assert.match(narrow, /Description: Other\nvalue/);
  for (const width of [1, 8, 18, 32, 64, 120]) {
    const lines = formatMarkdown(source, width);
    assert.ok(lines.every(line => line.length <= width));
    assert.doesNotMatch(lines.join('\n'), /\| --- \|/);
  }
});

test('optional outer pipes, escaped pipes, empty cells and surrounding prose survive', () => {
  const source = 'Before\nName | Value\n--- | ---\nA\\|B | [a]\n\nAfter';
  const lines = formatMarkdown(source, 80);
  assert.equal(lines[0], 'Before'); assert.equal(lines.at(-1), 'After');
  assert.ok(lines.some(line => line.includes('A|B') && line.includes('[a]')));
  const empty = formatMarkdown('| Name | Value |\n| --- | --- |\n| C | |', 80);
  assert.ok(empty.includes('| C    |       |'));
});

test('ordinary pipes and malformed tables stay ordinary text without dropping content', () => {
  for (const source of ['A | B\nA sentence below', '| A | B |\n| -- | --- |\n| 1 | 2 |', '| A | B |\n| --- |\n| 1 | 2 |']) {
    assert.deepEqual(formatMarkdown(source, 20), wrap(source, 20));
  }
  const source = '| A | B |\n| --- | --- |\n| mismatched |\nAfter';
  assert.ok(formatMarkdown(source, 80).includes('| mismatched |'));
});

test('actual project and blog tables remain readable in previews, focus and after resize', () => {
  const site = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));
  for (const [page, slug] of [['projects', 'qwen-qrec'], ['projects', 'tiger'], ['blog', 'relevance-ranking-jev-qwen']]) {
    const app = new App(site); app.execute(page);
    app.selected = site[page].findIndex(item => item.slug === slug);
    app.key('', { name: 'return' });
    const body = content(app, 90).map(row => row.text).join('\n');
    assert.match(body, /\+-+\+-+/); assert.doesNotMatch(body, /\|\s*:---/);
    for (const [cols, rows] of [[40, 24], [80, 24], [140, 48]]) {
      app.offset = 15;
      const focused = render(app, cols, rows).lines.map(strip);
      assert.ok(focused.every(line => line.length <= cols));
      app.key('', { name: 'down' });
      assert.ok(app.offset > 0);
      app.key('', { name: 'left' });
      assert.equal(app.detail, null);
      app.key('', { name: 'right' });
      assert.equal(app.detail.slug, slug);
    }
  }
});
