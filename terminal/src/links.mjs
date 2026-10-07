import { clean, safeURL } from './text.mjs';

export function letter(index) {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(97 + (n - 1) % 26) + result;
  return result;
}

export function labelLinks(links) {
  const result = [];
  for (const link of links) {
    const url = safeURL(link.url);
    if (!url || result.some(item => item.url === url)) continue;
    result.push({ id: letter(result.length), label: clean(link.label || link.title || url), url });
  }
  return result;
}
