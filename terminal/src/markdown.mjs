import { clean, wrap } from './text.mjs';

function cells(line) {
  const source = line.trim(), result = [''];
  let separators = 0, trailing = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    trailing = false;
    if (char === '\\' && ['|', '\\'].includes(source[i + 1])) result[result.length - 1] += source[++i];
    else if (char === '|') { result.push(''); separators++; trailing = true; }
    else result[result.length - 1] += char;
  }
  if (!separators) return null;
  if (source.startsWith('|')) result.shift();
  if (trailing) result.pop();
  return result.map(cell => cell.trim());
}

function table(header, alignment, data, width) {
  const rows = [header, ...data];
  const ideal = header.map((_, column) => Math.max(1, ...rows.map(row => row[column].length)));
  const sizes = header.map((_, column) => Math.min(ideal[column], Math.max(5,
    ...rows.flatMap(row => row[column].split(/\s+/).map(word => Math.min(10, word.length))))));
  const available = width - (header.length * 3 + 1);
  if (sizes.reduce((sum, size) => sum + size, 0) > available) {
    // Keep every value readable when columns would be squeezed into fragments.
    if (!data.length) return header.flatMap(label => wrap(label, width));
    return data.flatMap((row, index) => [
      ...(index ? ['-'.repeat(width)] : []),
      ...row.flatMap((value, column) => wrap(`${header[column]}: ${value}`, width)),
    ]);
  }
  let remaining = available - sizes.reduce((sum, size) => sum + size, 0);
  while (remaining > 0) {
    let grew = false;
    for (let column = 0; column < sizes.length && remaining > 0; column++) {
      if (sizes[column] < ideal[column]) { sizes[column]++; remaining--; grew = true; }
    }
    if (!grew) break;
  }
  const border = '+' + sizes.map(size => '-'.repeat(size + 2)).join('+') + '+';
  const output = [border];
  rows.forEach((row, index) => {
    const wrapped = row.map((value, column) => wrap(value, sizes[column]));
    for (let line = 0; line < Math.max(...wrapped.map(cell => cell.length)); line++) {
      output.push('|' + wrapped.map((cell, column) => {
        const text = cell[line] || '', space = sizes[column] - text.length;
        const left = alignment[column] === 'right' ? space : alignment[column] === 'center' ? Math.floor(space / 2) : 0;
        return ' ' + ' '.repeat(left) + text + ' '.repeat(space - left) + ' ';
      }).join('|') + '|');
    }
    if (index === 0 || index === rows.length - 1) output.push(border);
  });
  return output;
}

// Content has already had links labeled and Markdown emphasis removed at build time.
// Preserve table rows here, before ordinary paragraph wrapping destroys the columns.
export function formatMarkdown(text, width) {
  width = Math.max(1, Math.floor(width));
  const source = clean(text).split('\n'), output = [];
  for (let index = 0; index < source.length; index++) {
    const header = cells(source[index]), divider = cells(source[index + 1] || '');
    if (!header?.length || divider?.length !== header.length || !divider.every(cell => /^:?-{3,}:?$/.test(cell))) {
      output.push(...wrap(source[index], width));
      continue;
    }
    const alignment = divider.map(cell => cell.endsWith(':') ? cell.startsWith(':') ? 'center' : 'right' : 'left');
    const data = [];
    index++;
    while (index + 1 < source.length) {
      const row = cells(source[index + 1]);
      if (!row || row.length !== header.length) break;
      data.push(row); index++;
    }
    output.push(...table(header, alignment, data, width));
  }
  return output;
}
