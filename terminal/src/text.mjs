// Content is deliberately ASCII: predictable cell widths, including old terminals.
export function clean(value) {
  return String(value ?? '')
    .replace(/\x1b(?:\][^\x07\x1b]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...')
    .replace(/\u00d7/g, 'x').replace(/\u2192/g, '->')
    .normalize('NFKD').replace(/[^\x20-\x7e\n]/g, '');
}

export function safeURL(value, base = 'https://s9v10.dev') {
  const raw = String(value ?? '');
  if (!raw || /[\x00-\x20\x7f-\x9f]/.test(raw)) return '';
  try {
    const url = new URL(raw, base);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return '';
    if (url.hostname === 'sidvenkatayogi.github.io') url.hostname = 's9v10.dev';
    return url.href;
  } catch { return ''; }
}

export function wrap(text, width) {
  width = Math.max(1, width);
  const output = [];
  for (const paragraph of clean(text).split('\n')) {
    let line = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && line.length + word.length + 1 > width) {
        output.push(line); line = '';
      }
      while (word.length > width) {
        output.push(word.slice(0, width)); word = word.slice(width);
      }
      if (word) line += (line ? ' ' : '') + word;
    }
    output.push(line);
  }
  return output;
}
