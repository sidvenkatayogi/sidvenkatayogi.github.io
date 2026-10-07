import { clean, safeURL, wrap } from './text.mjs';
import { wave } from './wave.mjs';
import { asciiArt } from './art.mjs';
import { READING_SECTIONS } from './app.mjs';

export const ESC = '\x1b[';
export const RESET = `${ESC}0m`;
export const ENTER = `${ESC}?1049h${ESC}?2004h${ESC}2J`;
export const LEAVE = `${RESET}${ESC}?2004l${ESC}?25h${ESC}?1049l`;
export const OPENING_HOLD_MS = 1500;
export const OPENING_FADE_MS = 600;
export const OPENING_QUOTE = 'Do you see how infinite you are?';
const paint = (text, color = 252, bold = false) => `${ESC}${bold ? '1;' : ''}38;5;${color}m${text}${RESET}`;
export const strip = value => value.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');

export function hyperlink(url, label = url) {
  url = safeURL(url);
  return url ? `\x1b]8;;${url}\x1b\\${clean(label)}\x1b]8;;\x1b\\` : clean(label);
}

function truncate(value, width) {
  return value.length <= width ? value : value.slice(0, Math.max(0, width - 3)) + '.'.repeat(Math.min(3, width));
}

export function openingFrame(cols, rows, elapsedMs) {
  if (elapsedMs >= OPENING_HOLD_MS + OPENING_FADE_MS) return null;
  const width = Math.max(1, Math.min(1024, Math.floor(Number(cols)) || 80));
  const height = Math.max(1, Math.min(256, Math.floor(Number(rows)) || 24));
  const quote = wrap(OPENING_QUOTE, Math.max(1, width - 4)).slice(0, height);
  const top = Math.floor((height - quote.length) / 2);
  const fade = Math.max(0, (elapsedMs - OPENING_HOLD_MS) / OPENING_FADE_MS);
  const shade = 232 + Math.round(23 * (1 - fade));
  const lines = Array(height).fill('');
  quote.forEach((line, index) => {
    lines[top + index] = ' '.repeat(Math.max(0, Math.floor((width - line.length) / 2))) + paint(line, shade);
  });
  return { lines, cursor: [height, 1], background: 0, hideCursor: true };
}

export function content(app, width, height = 40) {
  const line = (text, role = 'text', url) => ({ text: clean(text), role, url, ...(role === 'art' ? { ansi: text } : {}) });
  const rows = (text, role = 'text', url) => wrap(text, width).map(text => line(text, role, url));
  const refs = app.references();
  const linked = (label, url) => {
    const ref = refs.find(ref => ref.url === safeURL(url));
    return `${label}${ref ? ` [${ref.id}]` : ''}`;
  };
  if (app.page === 'home') return rows(app.site.quote, 'quote');
  if (app.page === 'about') return rows(app.site.about.body);
  if (app.page === 'help') return [
    ...[
      'KEYS', '',
      '0-5: jump to a section (empty prompt)',
      '6: GitHub   7: LinkedIn   8: Twitter   9: TikTok',
      'Up / Down: select an entry',
      'PgUp: scroll up   PgDn: scroll down',
      'Enter: read selection',
      'Left: back',
      'Right: forward',
      'Esc: back',
      'Tab: complete a command or slug',
      'Ctrl-P: previous command   Ctrl-N: next command',
      'Ctrl-U: clear the command prompt',
      'Ctrl-B: move cursor left   Ctrl-F: move cursor right',
      'Home: command start   End: command end',
      'Ctrl-C / Ctrl-D: disconnect', '',
      'COMMANDS', '',
      'about / projects / art / blog / contact: go to section',
      'back: go back',
      'forward: go forward through page history',
      'read 2: read the second listed entry',
      'pixie: jump directly to a project slug',
      'search AI: filter the current collection',
      'search: clear the filter',
      'links: references, with the same letter labels',
      'references: alias for links',
      'color: toggle the background rainbow palette',
      'motion: pause or resume the ASCII animation',
      'quit: disconnect', '',
      'Link letters belong to the current entry and match its references.',
    ].flatMap(text => rows(text)),
  ];
  const item = app.entry();
  if (!item) return rows('No matches. Type search to clear your filter.', 'muted');
  if (['links', 'contact'].includes(app.page)) return [
    ...rows(`[${item.id}] ${item.label || item.title}`, 'quote', item.url), line(''),
    ...rows(linked(item.url, item.url), 'link', item.url),
  ];
  if (item.image) {
    const footer = refs.filter(ref => ref.url !== item.url).flatMap(ref => rows(`${ref.label} [${ref.id}]`, 'link', ref.url));
    const picture = asciiArt(item.image, width, Math.max(1, height - footer.length - 3), true);
    const indent = ' '.repeat(Math.max(0, Math.floor((width - strip(picture[0] || '').length) / 2)));
    return [...rows(linked(item.title, item.url), 'quote', item.url), line(''),
      ...picture.map(row => line(indent + row, 'art')), line(''), ...footer];
  }
  return [...rows(linked(item.title, item.url), 'quote', item.url),
    ...rows([item.date, ...(item.tags || [])].filter(Boolean).join(' / '), 'muted'), line(''),
    ...rows(item.body), line(''), ...rows('links: references', 'accent')];
}

function backgroundSpan(cells, start, end, color) {
  let output = '', run = '', last;
  const flush = () => { if (run) output += last === null ? run : paint(run, last); run = ''; };
  for (let i = start; i < end; i++) {
    const cell = cells[i];
    const shade = cell.char === ' ' ? null : color ? cell.color : cell.gray;
    if (shade !== last) { flush(); last = shade; }
    run += cell.char;
  }
  flush(); return output;
}

const backgrounds = new WeakMap();
export function render(app, cols = 80, rows = 24) {
  // Accept ordinary windows in full; bound malicious SSH dimensions before allocating.
  const width = Math.max(1, Math.min(1024, Math.floor(Number(cols)) || 80));
  const height = Math.max(1, Math.min(256, Math.floor(Number(rows)) || 24));
  if (width < 16 || height < 8) {
    const lines = wrap('A little more room? Resize to at least 16 columns x 8 rows. Ctrl-C to leave.', Math.max(1, width - 1)).slice(0, height);
    return { lines, cursor: [height, 1] };
  }
  const padding = width >= 60 ? 3 : 1;
  const inner = width - padding * 2;
  const accent = app.color ? 78 : 252;
  let cached = backgrounds.get(app);
  if (!cached || cached.width !== width || cached.height !== height || cached.frame !== app.frame || cached.color !== app.color) {
    const field = wave(width, height, app.frame);
    cached = { width, height, frame: app.frame, color: app.color,
      field, lines: field.map(row => backgroundSpan(row, 0, width, app.color).trimEnd()) };
    backgrounds.set(app, cached);
  }
  const lines = [...cached.lines];
  const placeAt = (row, column, value) => {
    if (row < 0 || row >= height) return;
    const length = strip(value).length;
    const end = Math.min(width, column + length + 2);
    lines[row] = (backgroundSpan(cached.field[row], 0, Math.max(0, column - 1), app.color)
      + (column ? ' ' : '') + value + ' '.repeat(Math.max(0, end - column - length))
      + backgroundSpan(cached.field[row], end, width, app.color)).trimEnd();
  };
  const place = (row, value) => placeAt(row, padding, value);
  const compact = height < 18;
  const navRow = height >= 24 ? 4 : height >= 14 ? 3 : 1;
  const titleRow = navRow + (compact ? 1 : 2);
  const bodyTop = titleRow + (app.page === 'home' ? 0 : compact ? 1 : 2);
  const footerStart = height - (compact ? 3 : 5);
  const bodyHeight = Math.max(1, footerStart - bodyTop - 1);
  place(height >= 18 ? 1 : 0, paint(truncate(app.site.name, inner), 255, true));
  if (height >= 24) place(2, paint('s9v10.dev / terminal', 245));
  const nav = width >= 76 ? '[0] home  [1] about  [2] projects  [3] art  [4] blog  [5] contact'
    : width >= 42 ? '0 home  1 about  2 code  3 art  4 blog' : '0 home  1 me  2 code  3 art  4 blog';
  place(navRow, paint(truncate(nav, inner), 248));
  const options = app.options();
  const collection = ['projects', 'art', 'blog', 'links', 'contact'].includes(app.page);
  const selected = collection ? app.selected : 0;
  const menu = collection ? options.map((item, index) => ({
    text: item.id ? `[${item.id}] ${item.label || item.title}` : `${String(index + 1).padStart(2, '0')} ${item.title}`,
    url: item.id ? item.url : null,
  })) : [];
  const entry = app.entry();
  const title = app.page + (app.filter ? ` / ${app.filter}` : '')
    + (collection && entry ? ` / ${app.selected + 1} of ${options.length}` : '');
  if (app.page !== 'home') place(titleRow, paint(truncate(title, inner), accent, true));
  const sidebar = collection && inner >= 58 && bodyHeight >= 4 ? Math.min(30, Math.floor(inner * 0.28)) : 0;
  const previewWidth = inner - (sidebar ? sidebar + 4 : 0);
  const focused = READING_SECTIONS.includes(app.page) && !!app.detail;
  const previewLeft = padding + (sidebar ? sidebar + 4 : 0);
  const boxLeft = previewLeft - Math.min(padding, 2);
  const boxRight = Math.min(width - 1, previewLeft + previewWidth + Math.min(1, padding - 1));
  if (focused) {
    // The frame occupies the existing gutters, so focusing never reflows the text.
    const edge = paint('+' + '-'.repeat(boxRight - boxLeft - 1) + '+', accent);
    placeAt(bodyTop - 1, boxLeft, edge);
    placeAt(bodyTop + bodyHeight, boxLeft, edge);
  }
  const body = content(app, previewWidth, bodyHeight);
  app.offset = Math.max(0, Math.min(Math.max(0, body.length - bodyHeight), app.offset));
  app.listOffset = Math.max(0, Math.min(app.listOffset, Math.max(0, selected)));
  if (selected >= app.listOffset + bodyHeight) app.listOffset = selected - bodyHeight + 1;
  const refs = app.references();
  const decorate = text => text.replace(/\[([a-z]+)\]/g, (marker, id) => {
    const ref = refs.find(ref => ref.id === id);
    return ref ? hyperlink(ref.url, marker) : marker;
  });
  for (let index = 0; index < bodyHeight; index++) {
    const option = menu[index + app.listOffset];
    const active = index + app.listOffset === selected;
    const label = option ? `${active ? '>' : ' '} ${option.text}` : '';
    const leftText = truncate(label, sidebar).padEnd(sidebar);
    const row = body[index + app.offset];
    const left = sidebar && (option || row?.text) ? paint(option?.url ? hyperlink(option.url, leftText) : leftText, active ? accent : 245, active) + '    ' : '';
    let right = '';
    if (row?.text) {
      const text = truncate(row.text, previewWidth);
      const color = { muted: 245, art: 250, quote: 255, selected: accent, accent, link: accent }[row.role] || 252;
      const value = row.role === 'art' ? row.ansi : row.url ? hyperlink(row.url, text) : decorate(text);
      right = paint(value, color, ['quote', 'selected'].includes(row.role)) + (row.role === 'art' ? ' '.repeat(previewWidth - text.length) : '');
    }
    if (focused) {
      const menuText = sidebar ? paint(leftText, active ? accent : 245, active)
        + ' '.repeat(boxLeft - padding - sidebar) : '';
      const border = paint('|', accent);
      const fill = ' '.repeat(Math.max(0, boxRight - previewLeft - strip(right).length));
      placeAt(bodyTop + index, sidebar ? padding : boxLeft,
        menuText + border + ' '.repeat(previewLeft - boxLeft - 1) + right + fill + border);
    } else if (left || right) place(bodyTop + index, left + right);
  }
  const progress = body.length > bodyHeight ? ` ${app.offset + 1}-${Math.min(body.length, app.offset + bodyHeight)}/${body.length} ` : '';
  if (!compact) place(footerStart, paint('-'.repeat(Math.max(0, inner - progress.length)) + progress, 239));
  const prompt = width >= 30 ? 'visitor > ' : '> ';
  const inputWidth = Math.max(1, inner - prompt.length - 1);
  const inputStart = Math.max(0, app.cursor - inputWidth);
  const promptRow = height - (compact ? 3 : 4);
  place(promptRow, paint(prompt, accent) + clean(app.input.slice(inputStart, inputStart + inputWidth + 1)));
  place(promptRow + 1, paint(truncate(app.status, inner), 245));
  const hints = ['links', 'contact'].includes(app.page) ? ['esc/<-: back', 'up/down: select', 'pgup/pgdn: scroll']
    : READING_SECTIONS.includes(app.page) ? focused
    ? ['esc/<-: list', 'up/down: scroll', 'links: references']
    : ['enter/->: focus', '<-: back', 'up/down: select', 'links: references']
    : ['<-: back', '->: forward', `up/down: ${app.items().length ? 'select' : 'scroll'}`, 'links: references'];
  let hintText = '';
  for (const hint of hints) {
    const next = hintText ? `${hintText}   ${hint}` : hint;
    if (next.length > inner) break;
    hintText = next;
  }
  place(promptRow + 2, paint(hintText || truncate(hints[0], inner), 244));
  return { lines, cursor: [promptRow + 1, padding + 1 + prompt.length + app.cursor - inputStart] };
}

export function draw(screen, previous) {
  let output = `${ESC}?25l`;
  const background = screen.background === 0 ? `${ESC}48;5;0m` : '';
  if (!previous || previous.background !== screen.background) {
    output += `${RESET}${background}${ESC}2J`;
    previous = null;
  }
  screen.lines.forEach((line, row) => {
    if (!previous || previous.lines[row] !== line) output += `${ESC}${row + 1};1H${background}${ESC}2K${line}${RESET}`;
  });
  output += `${ESC}${screen.cursor[0]};${screen.cursor[1]}H${screen.hideCursor ? '' : `${ESC}?25h`}`;
  return output;
}

export function plain(app) {
  const url = safeURL(app.currentURL());
  const ref = app.references().find(link => link.url === url);
  return `${app.site.name}\n${app.detail?.title || app.page}\n\n${content(app, 90).map(line => line.text).join('\n')}\n\n${ref ? `[${ref.id}] ` : ''}${url}\n`;
}
