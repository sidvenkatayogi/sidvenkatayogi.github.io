import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { App, COMMANDS } from '../src/app.mjs';
import { render, strip, hyperlink, content, openingFrame, draw, OPENING_HOLD_MS, OPENING_FADE_MS, OPENING_QUOTE } from '../src/render.mjs';
import { wave, GLYPHS } from '../src/wave.mjs';
import { asciiArt } from '../src/art.mjs';
import { safeURL } from '../src/text.mjs';
import { deflateSync } from 'node:zlib';

const site = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));
const type = (app, value) => { for (const char of value) app.key(char, { name: char }); };
const enter = app => app.key('\r', { name: 'return' });

test('opening quote is centered on black, holds 1.5 seconds and fades before the home screen', () => {
  const first = openingFrame(100, 32, 0);
  assert.equal(OPENING_HOLD_MS, 1500);
  assert.deepEqual(first, openingFrame(100, 32, 1499));
  assert.equal(first.background, 0); assert.equal(first.hideCursor, true);
  const row = first.lines.findIndex(line => strip(line).includes(OPENING_QUOTE));
  assert.equal(row, 15);
  assert.equal(strip(first.lines[row]).indexOf(OPENING_QUOTE), Math.floor((100 - OPENING_QUOTE.length) / 2));
  assert.equal(first.lines.filter(Boolean).length, 1);
  const fading = openingFrame(100, 32, 1800);
  assert.notEqual(first.lines[row], fading.lines[row]);
  assert.equal(strip(first.lines[row]), strip(fading.lines[row]));
  assert.equal(openingFrame(100, 32, OPENING_HOLD_MS + OPENING_FADE_MS), null);
  assert.match(draw(first), /\x1b\[48;5;0m\x1b\[2J/);
  assert.doesNotMatch(draw(first), /\x1b\[\?25h/);
  assert.match(draw(render(new App(site), 100, 32), first), /\x1b\[0m\x1b\[2J/);
  for (const [cols, rows] of [[20, 8], [80, 24], [240, 90]]) {
    const resized = openingFrame(cols, rows, 500);
    assert.equal(resized.lines.length, rows);
    assert.ok(resized.lines.every(line => strip(line).length <= cols));
  }
});

test('commands, section shortcuts, selection, detail and back preserve location', () => {
  const app = new App(site);
  app.key('2', { name: '2' });
  assert.equal(app.page, 'projects');
  app.key('', { name: 'down' });
  const chosen = app.items()[1];
  enter(app);
  assert.equal(app.detail.slug, chosen.slug);
  app.key('', { name: 'escape' });
  assert.equal(app.detail, null);
  assert.equal(app.selected, 1);
  type(app, 'read 2'); enter(app);
  assert.equal(app.detail.slug, chosen.slug);
  app.execute('home'); app.execute('pixie');
  assert.equal(app.detail.slug, 'pixie');
  assert.equal(app.page, 'projects');
});

test('typing, editing and command history do not trigger navigation shortcuts', () => {
  const app = new App(site);
  type(app, 'read 12');
  assert.equal(app.page, 'home');
  app.key('', { name: 'backspace' });
  assert.equal(app.input, 'read 1');
  app.key('', { name: 'u', ctrl: true });
  type(app, 'pro'); app.key('', { name: 'tab' });
  assert.equal(app.input, 'projects'); enter(app);
  type(app, 'art'); enter(app);
  app.key('', { name: 'p', ctrl: true });
  assert.equal(app.input, 'art');
  app.key('', { name: 'up' });
  assert.equal(app.input, 'projects');
  app.key('', { name: 'escape' });
  type(app, 'helo'); app.key('', { name: 'b', ctrl: true });
  app.key('', { name: 'backspace' }); type(app, 'l');
  assert.equal(app.input, 'helo');
});

test('bracketed paste is bounded and does not run embedded commands', () => {
  const app = new App(site);
  app.key('', { sequence: '\x1b[200~' });
  type(app, '2'); enter(app); type(app, 'quit');
  app.key('', { sequence: '\x1b[201~' });
  assert.equal(app.page, 'home'); assert.equal(app.closed, false);
  assert.equal(app.input, '2 quit');
  type(app, 'x'.repeat(1000)); assert.equal(app.input.length, 256);
});

test('search handles no matches; invalid commands and URLs fail safely', () => {
  const app = new App(site);
  app.execute('search AI');
  assert.ok(app.items().length > 0 && app.items().length < site.projects.length);
  app.execute('search NO_SUCH_PROJECT'); assert.equal(app.items().length, 0);
  assert.equal(app.execute('read 999'), false);
  app.execute('search'); assert.equal(app.items().length, site.projects.length);
  assert.equal(app.execute('read missing-project'), false);
  assert.equal(app.detail, null);
  assert.equal(app.execute('cat /etc/passwd'), false);
  assert.equal(app.execute('open javascript:alert(1)'), false);
  assert.equal(safeURL('https://example.org\x1b[2J'), '');
  assert.ok(!hyperlink('javascript:alert(1)', 'click').includes('\x1b]8;'));
});

test('links exposes clickable references directly without a separate URL page', () => {
  const app = new App(site);
  app.execute('pixie'); app.execute('links');
  const url = 'https://s9v10.dev/programming/pixie/';
  app.selected = app.items().findIndex(item => item.url === url);
  const screen = render(app, 120, 32).lines.join('\n');
  assert.match(screen, /\x1b\]8;;https:\/\/s9v10.dev\/programming\/pixie\//);
  assert.match(strip(screen), /https:\/\/s9v10.dev\/programming\/pixie\/ \[d\]/);
  assert.doesNotMatch(strip(screen), /\bopen\b/);
  const depth = app.stack.length;
  enter(app); app.execute('links');
  assert.equal(app.page, 'links'); assert.equal(app.entry().url, url);
  assert.equal(app.stack.length, depth);
  app.back(); assert.equal(app.detail.slug, 'pixie');
  app.execute('links');
  assert.ok(app.items().some(item => item.url === 'https://github.com/sidvenkatayogi/pixie'));
  app.execute('contact'); enter(app);
  assert.equal(app.page, 'contact'); assert.equal(app.currentURL(), `mailto:${site.email}`);
  app.key('6', { name: '6' });
  assert.equal(app.page, 'links'); assert.equal(app.entry().url, safeURL(site.socials[0].url));
  assert.match(hyperlink(site.base), /\x1b\]8;;https:\/\/s9v10.dev/);
});

test('open and its aliases are removed from commands, completion, and help', () => {
  const app = new App(site); app.execute('pixie');
  for (const command of ['open', 'open a', 'web', '[b]']) {
    assert.equal(app.execute(command), false);
    assert.equal(app.page, 'projects'); assert.equal(app.detail.slug, 'pixie');
  }
  assert.ok(!COMMANDS.includes('open'));
  type(app, 'op'); app.key('', { name: 'tab' }); assert.equal(app.input, 'op');
  app.execute('help');
  const help = content(app, 120).map(row => row.text).join('\n');
  assert.doesNotMatch(help, /\bopen\b|Elsewhere|unfocus a project/);
  assert.match(help, /Left: back\nRight: forward/);
  assert.match(help, /back: go back\nforward: go forward through page history/);
});

test('frames fit small and large terminals, long commands and long content', () => {
  for (const [cols, rows] of [[20, 8], [36, 18], [40, 24], [80, 24], [120, 40], [500, 500]]) {
    for (const command of ['home', 'about', 'projects', 'art', 'blog', 'contact', 'help', 'pixie', 'links']) {
      const app = new App(site); app.execute(command);
      app.input = 'x'.repeat(256); app.cursor = 256;
      const screen = render(app, cols, rows);
      assert.doesNotMatch(strip(screen.lines.join('\n')), /Open in your browser|Cmd-click|Ctrl-click|Click the URL/i);
      assert.ok(screen.lines.length <= rows);
      for (const line of screen.lines) assert.ok(strip(line).length <= cols, `${cols}x${rows} ${command}: ${strip(line)}`);
      assert.ok(screen.cursor[0] <= rows && screen.cursor[1] <= cols);
    }
  }
});

test('one animated wave spans a two-dimensional field; toggles are independent', () => {
  const field = wave(72, 24);
  assert.equal(field.length, 24);
  assert.ok(field.every(row => row.length === 72 && row.every(cell => GLYPHS.includes(cell.char))));
  assert.ok(field.filter(row => row.some(cell => cell.char !== ' ')).length > 5);
  assert.notDeepEqual(field, wave(72, 24, 20));
  assert.deepEqual(field, wave(72, 24, 0, 1));
  assert.notDeepEqual(field, wave(72, 24, 0, 3));
  const app = new App(site);
  app.execute('motion off'); app.execute('color on');
  assert.equal(app.motion, false); assert.equal(app.color, true);
  app.execute('color nonsense'); assert.equal(app.color, true);
});

test('colored ASCII preserves source hues, while plain output remains ASCII', () => {
  const image = { width: 2, height: 1, channels: 3, pixels: deflateSync(Buffer.from([255, 0, 0, 0, 0, 255])).toString('base64') };
  const colored = asciiArt(image, 2, 1, true).join('');
  assert.match(colored, /\x1b\[38;5;196m/); assert.match(colored, /\x1b\[38;5;21m/);
  assert.equal(strip(colored), asciiArt(image, 2, 1).join(''));
  for (const item of site.art) assert.equal(item.image.channels, 3);
});

test('collections preview the selected entry on the right and scroll independently of the menu', () => {
  for (const page of ['projects', 'art', 'blog', 'contact']) {
    const app = new App(site); app.execute(page);
    const screen = render(app, 140, 48).lines.map(strip);
    const title = app.entry().title.slice(0, 12);
    const row = screen.find(row => row.indexOf(title) >= 0 && row.lastIndexOf(title) > row.indexOf(title));
    assert.ok(row, `${page} has its option and preview visible together`);
    assert.ok(row.lastIndexOf(title) >= 37);
    app.key('', { name: 'down' });
    assert.equal(app.entry().url, app.options()[1].url);
    app.key('', { name: 'pagedown' });
    assert.equal(app.selected, 1); assert.equal(app.offset, 6);
    app.key('', { name: 'down' }); assert.equal(app.offset, 0);
  }
  const about = new App(site); about.execute('about');
  const rows = render(about, 140, 48).lines.map(strip);
  assert.equal(rows.filter(row => row.includes('[0] home')).length, 1);
  assert.equal(rows.find(row => row.includes('Welcome!')).indexOf('Welcome!'), 3);
});

test('Home uses only top navigation and gives the introduction full width', () => {
  const app = new App(site);
  const screen = render(app, 140, 48).lines.map(strip);
  assert.equal(screen.filter(line => line.includes('[0] home')).length, 1);
  assert.ok(screen.findIndex(line => line.includes('[0] home')) < screen.findIndex(line => line.includes(site.quote)));
  assert.equal(screen.find(line => line.includes(site.quote)).indexOf(site.quote), 3);
  assert.deepEqual(content(app, 140).map(row => row.text), [site.quote]);
  assert.ok(!screen.some(line => /> \[0\] home/.test(line)));
});

test('project and blog focus scrolls in place, keeps its filter and selection, and does not add history', () => {
  for (const [page, filter, slug] of [['projects', 'cloud', 'pixie'], ['blog', 'Relevance Ranking', 'making-pixie']]) {
  const app = new App(site); app.execute(page); app.execute(`search ${filter}`);
  const chosen = app.entry(), depth = app.stack.length;
  app.key('', { name: 'right' });
  assert.equal(app.detail.url, chosen.url);
  app.key('', { name: 'down' }); app.key('', { name: 'down' });
  assert.equal(app.offset, 2); assert.equal(app.selected, 0);
  enter(app); app.key('', { name: 'right' });
  assert.equal(app.offset, 2); assert.equal(app.stack.length, depth);
  type(app, 'unfinished'); app.key('', { name: 'escape' });
  assert.equal(app.input, ''); assert.equal(app.detail, null);
  assert.equal(app.page, page); assert.equal(app.filter, filter); assert.equal(app.offset, 2);
  enter(app); app.key('', { name: 'left' });
  assert.equal(app.detail, null); assert.equal(app.offset, 2);
  app.execute('search'); app.key('', { name: 'down' });
  assert.equal(app.selected, 1); assert.equal(app.offset, 0);
  app.execute('search NO_SUCH_PROJECT'); app.key('', { name: 'right' });
  assert.equal(app.detail, null); assert.equal(app.page, page);
  app.execute(slug);
  assert.equal(app.filter, ''); assert.equal(app.options()[app.selected].slug, slug);
  }
});

test('project and blog focus draws a compact frame in the gutters without moving or rewrapping text', () => {
  for (const page of ['projects', 'blog']) for (const [cols, rows] of [[40, 24], [80, 24], [140, 48]]) {
    const app = new App(site); app.execute(page);
    const before = render(app, cols, rows).lines.map(strip);
    app.key('', { name: 'right' });
    const after = render(app, cols, rows).lines.map(strip);
    assert.match(before.at(-2), /enter\/->: focus/);
    assert.match(after.at(-2), /esc\/<-: list/);
    const marker = app.entry().title.slice(0, 10), row = before.findIndex(line => line.includes(marker));
    assert.ok(row >= 0);
    assert.equal(after[row].lastIndexOf(marker), before[row].lastIndexOf(marker));
    assert.equal(after.filter(line => /\+-{5,}\+/.test(line)).length, 2);
    const left = after[row].indexOf('|'), right = after[row].lastIndexOf('|');
    assert.ok(right > left);
    const start = before[row].lastIndexOf(marker);
    assert.equal(after[row].slice(start, start + marker.length + 4), before[row].slice(start, start + marker.length + 4));
    app.key('', { name: 'left' });
    assert.ok(!render(app, cols, rows).lines.map(strip).some(line => /\+-{5,}\+/.test(line)));
  }
});

test('reference letters and selection match the preview and survive back/forward', () => {
  const app = new App(site); app.execute('projects');
  app.selected = site.projects.findIndex(item => item.slug === 'pixie');
  const github = app.references().find(link => link.url === 'https://github.com/sidvenkatayogi/pixie');
  assert.match(app.entry().body, new RegExp(`Github repository! \\[${github.id}\\]`));
  app.execute('references');
  assert.equal(app.items().find(link => link.id === github.id).url, github.url);
  app.key('', { name: 'down' }); assert.equal(app.entry().url, github.url);
  assert.equal(app.references().find(link => link.id === github.id).url, github.url);
  app.back(); assert.equal(app.entry().slug, 'pixie');
  app.forward(); assert.equal(app.entry().url, github.url);
  assert.match(content(app, 100).map(row => row.text).join('\n'), /\[b\]/);
});

test('left/Esc and right preserve selected entries, scroll positions and page history', () => {
  const app = new App(site);
  app.execute('projects'); app.selected = 3; app.offset = 6;
  app.execute('pixie'); app.offset = 12;
  app.execute('links');
  app.key('', { name: 'left' });
  assert.equal(app.detail.slug, 'pixie'); assert.equal(app.offset, 12);
  app.key('', { name: 'left' });
  assert.equal(app.detail, null); assert.equal(app.selected, site.projects.findIndex(item => item.slug === 'pixie')); assert.equal(app.offset, 12);
  app.key('', { name: 'right' });
  assert.equal(app.detail.slug, 'pixie'); assert.equal(app.offset, 12);
  app.execute('forward'); assert.equal(app.page, 'links');
  app.key('', { name: 'escape' });
  app.execute('art'); assert.equal(app.future.length, 0);
  type(app, 'unfinished'); app.key('', { name: 'left' });
  assert.equal(app.input, ''); assert.equal(app.page, 'art');
  app.key('', { name: 'left' }); assert.equal(app.detail.slug, 'pixie');
});

test('requested copy is removed and About ends at the chosen opportunities line', () => {
  const app = new App(site);
  const home = strip(render(app, 100, 32).lines.join('\n'));
  assert.doesNotMatch(home, /hello, visitor|small corner|Building, researching, drawing/i);
  app.execute('help');
  assert.doesNotMatch(content(app, 100).map(row => row.text).join('\n'), /FIND YOUR WAY/);
  assert.match(site.about.body, /always looking for new opportunities!$/);
  assert.match(site.about.body, /Some highlights/);
  assert.doesNotMatch(site.about.body, /profile picture|favorite music/);
});

test('art is actual ASCII image content, fitted to each terminal with preserved aspect', () => {
  for (const item of site.art) {
    assert.ok(item.image?.pixels);
    for (const [width, height] of [[18, 5], [70, 25], [220, 90]]) {
      const image = asciiArt(item.image, width, height);
      assert.ok(image.length <= height && image.length > 0);
      assert.ok(image.every(row => row.length <= width && /^[\x20-\x7e]+$/.test(row)));
      assert.ok(new Set(image.join('')).size > 3);
      assert.ok(Math.abs(image.length - image[0].length * item.image.height / item.image.width / 2) <= 1);
    }
  }
  const app = new App(site); app.execute('art');
  const small = render(app, 80, 24); const large = render(app, 240, 90);
  assert.equal(large.lines.length, 90); assert.equal(large.cursor[0], 87);
  assert.ok(strip(large.lines.join('')).length > strip(small.lines.join('')).length * 3);
  assert.match(strip(large.lines.join('\n')), /EXTERMINATION/);
  app.key('', { name: 'down' });
  assert.match(strip(render(app, 100, 40).lines.join('\n')), new RegExp(app.items()[1].title));
});
