import { inflateSync } from 'node:zlib';

// Bright pixels use denser glyphs, preserving the picture on a dark terminal.
export const ART_GLYPHS = ' .:-=+*#%@';
const cache = new WeakMap();
const levels = [0, 95, 135, 175, 215, 255];
function cube(value) {
  return levels.reduce((best, level, index) => Math.abs(level - value) < Math.abs(levels[best] - value) ? index : best, 0);
}

export function asciiArt(image, width, height, shaded = false) {
  if (!image || width < 1 || height < 1) return [];
  let stored = cache.get(image);
  if (!stored) {
    const channels = image.channels || 1;
    const pixels = inflateSync(Buffer.from(image.pixels, 'base64'), { maxOutputLength: image.width * image.height * channels });
    if (pixels.length !== image.width * image.height * channels) throw new Error('Invalid artwork pixel map');
    const stride = image.width + 1;
    const sums = Array.from({ length: channels }, () => new Uint32Array(stride * (image.height + 1)));
    for (let channel = 0; channel < channels; channel++) {
      for (let y = 0; y < image.height; y++) {
        let row = 0;
        for (let x = 0; x < image.width; x++) {
          row += pixels[(y * image.width + x) * channels + channel];
          sums[channel][(y + 1) * stride + x + 1] = sums[channel][y * stride + x + 1] + row;
        }
      }
    }
    stored = { sums, stride, frames: new Map() }; cache.set(image, stored);
  }
  // A terminal cell is approximately twice as tall as it is wide.
  const cols = Math.max(1, Math.min(Math.floor(width), Math.floor(height * 2 * image.width / image.height)));
  const rows = Math.max(1, Math.min(Math.floor(height), Math.round(cols * image.height / image.width / 2)));
  const key = `${cols}x${rows}`;
  if (stored.frames.has(key)) return stored.frames.get(key)[shaded ? 'shaded' : 'plain'];
  const { sums, stride } = stored;
  const shadedLines = [];
  const lines = Array.from({ length: rows }, (_, y) => {
    const top = Math.floor(y * image.height / rows), bottom = Math.max(top + 1, Math.floor((y + 1) * image.height / rows));
    let shadedLine = '', lastColor;
    const line = Array.from({ length: cols }, (_, x) => {
      const left = Math.floor(x * image.width / cols), right = Math.max(left + 1, Math.floor((x + 1) * image.width / cols));
      const rgb = sums.map(sum => (sum[bottom * stride + right] - sum[top * stride + right]
        - sum[bottom * stride + left] + sum[top * stride + left]) / ((bottom - top) * (right - left)));
      if (rgb.length === 1) rgb.push(rgb[0], rgb[0]);
      const light = (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255;
      const char = ART_GLYPHS[Math.min(ART_GLYPHS.length - 1, Math.floor(light ** 0.8 * ART_GLYPHS.length))];
      const color = Math.max(...rgb) - Math.min(...rgb) < 8
        ? 232 + Math.min(23, Math.round(light * 23))
        : 16 + 36 * cube(rgb[0]) + 6 * cube(rgb[1]) + cube(rgb[2]);
      if (color !== lastColor) { shadedLine += `\x1b[38;5;${color}m`; lastColor = color; }
      shadedLine += char;
      return char;
    }).join('');
    shadedLines.push(shadedLine + '\x1b[0m');
    return line;
  });
  // Keep resize/visitor churn bounded rather than caching every possible size.
  if (stored.frames.size >= 24) stored.frames.delete(stored.frames.keys().next().value);
  stored.frames.set(key, { plain: lines, shaded: shadedLines });
  return shaded ? shadedLines : lines;
}
