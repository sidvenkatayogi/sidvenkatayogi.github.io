// Port of script.js's desktop Waves: the motion and Bezier controls are unchanged.
// Rasterize strokes here instead of depending on a browser canvas on the SSH host.
export const GLYPHS = '@#$?!abc;:+*=-,.` ';
export const PALETTE = [171, 62, 45, 78, 221, 196];
export const SETTINGS = Object.freeze({ rotation: 45, waves: 1, thinWaves: 0, width: 200,
  amplitude: 1.5, speed: [0.003, 0.015], thinSpeed: [0.005, 0.01], asciiCellSize: 12, targetFps: 30 });
export const TERMINAL_FPS = 8;
const DEFAULT_SEED = 910;

export function randomSource(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function createWaves(random = randomSource(DEFAULT_SEED), count = SETTINGS.waves) {
  return Array.from({ length: count + SETTINGS.thinWaves }, (_, index) => {
    const thin = index >= count, range = thin ? SETTINGS.thinSpeed : SETTINGS.speed;
    return { thin, angle: Array.from({ length: 4 }, () => random() * Math.PI * 2),
      speed: Array.from({ length: 4 }, () => (range[0] + random() * (range[1] - range[0])) * (random() > 0.5 ? 1 : -1)) };
  });
}

export function controlPoints(wave, step, width, height) {
  const a = wave.angle.map((angle, index) => Math.sin(angle + wave.speed[index] * step));
  const radius = Math.hypot(width, height) / 2, r3 = radius / 3, x = width / 2, y = height / 2;
  const amp = SETTINGS.amplitude, rotation = SETTINGS.rotation * Math.PI / 180;
  return [
    [x - radius * Math.cos(a[0] * amp + rotation), y - radius * Math.sin(a[0] * amp + rotation)],
    [x - r3 * Math.cos(a[1] * amp * 2), y - r3 * Math.sin(a[1] * amp * 2)],
    [x + r3 * Math.cos(a[2] * amp * 2), y + r3 * Math.sin(a[2] * amp * 2)],
    [x + radius * Math.cos(a[3] * amp + rotation), y + radius * Math.sin(a[3] * amp + rotation)],
  ];
}

// Flatten cubic curves to subpixel precision, splitting even a curve whose ends coincide.
function flatten(points, draw, depth = 0) {
  const [a, b, c, d] = points;
  const error = Math.max(Math.abs(3 * b[0] - 2 * a[0] - d[0]), Math.abs(3 * b[1] - 2 * a[1] - d[1]),
    Math.abs(3 * c[0] - 2 * d[0] - a[0]), Math.abs(3 * c[1] - 2 * d[1] - a[1]));
  if (error < 0.6 || depth >= 10) { draw(a, d); return; }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const ab = mid(a, b), bc = mid(b, c), cd = mid(c, d), abc = mid(ab, bc), bcd = mid(bc, cd), center = mid(abc, bcd);
  flatten([a, ab, abc, center], draw, depth + 1);
  flatten([center, bcd, cd, d], draw, depth + 1);
}

export function wave(width, height, frame = 0, count = SETTINGS.waves, seed = DEFAULT_SEED) {
  width = Math.max(1, Math.floor(width)); height = Math.max(1, Math.floor(height));
  // Six samples across a normal cell match the site's two-pixel sampling. Tall
  // terminal cells need twice the vertical samples. Bound work for huge windows.
  const samples = Math.max(1, Math.min(6, Math.floor(Math.sqrt(450_000 / (width * height * 2)))));
  const w = width * samples, h = height * samples * 2, size = w * h;
  const red = new Float32Array(size), green = new Float32Array(size);
  const marks = new Uint16Array(size), coverage = new Float32Array(size), touched = [];
  let stroke = 0, radius = 0;
  const draw = (a, b) => {
    const vertical = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
    let major0 = a[vertical ? 1 : 0], minor0 = a[vertical ? 0 : 1];
    let major1 = b[vertical ? 1 : 0], minor1 = b[vertical ? 0 : 1];
    if (major0 > major1) { [major0, major1] = [major1, major0]; [minor0, minor1] = [minor1, minor0]; }
    if (major1 - major0 < 1e-8) return;
    const slope = (minor1 - minor0) / (major1 - major0), normal = 1 / Math.hypot(1, slope);
    const reach = (radius + 0.5) / normal;
    const end = Math.min((vertical ? h : w) - 1, Math.floor(major1));
    for (let major = Math.max(0, Math.floor(major0)); major <= end; major++) {
      const center = minor0 + (major + 0.5 - major0) * slope;
      const last = Math.min((vertical ? w : h) - 1, Math.floor(center + reach));
      for (let minor = Math.max(0, Math.floor(center - reach)); minor <= last; minor++) {
        const amount = Math.min(1, radius + 0.5 - Math.abs(minor + 0.5 - center) * normal);
        if (amount <= 0) continue;
        const index = vertical ? major * w + minor : minor * w + major;
        if (marks[index] !== stroke) { marks[index] = stroke; coverage[index] = amount; touched.push(index); }
        else if (amount > coverage[index]) coverage[index] = amount;
      }
    }
  };
  const step = Math.floor(Math.max(0, frame) * SETTINGS.targetFps / TERMINAL_FPS);
  for (const ribbon of createWaves(randomSource(seed), count)) {
    // Desktop preloads 200 lines, then advances once before its first draw.
    radius = (ribbon.thin ? 1 : 2) * samples / SETTINGS.asciiCellSize / 2;
    for (let trail = 0; trail < SETTINGS.width; trail++) {
      stroke++; touched.length = 0;
      flatten(controlPoints(ribbon, step + trail + 2, w, h), draw);
      const opacity = ribbon.thin ? 0.25 : 0.4;
      for (const index of touched) {
        const alpha = coverage[index] * opacity;
        red[index] = red[index] * (1 - alpha) + (ribbon.thin ? 0 : alpha * 255);
        green[index] = green[index] * (1 - alpha) + (ribbon.thin ? alpha * 255 : 0);
      }
    }
  }
  return Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, col) => {
    let normal = 0, thin = 0;
    for (let yy = row * samples * 2; yy < (row + 1) * samples * 2; yy++) {
      for (let xx = col * samples; xx < (col + 1) * samples; xx++) {
        normal += red[yy * w + xx]; thin += green[yy * w + xx];
      }
    }
    const brightness = Math.max(normal, thin) / (samples * samples * 2);
    const index = Math.max(0, Math.min(GLYPHS.length - 1, Math.floor(brightness / 255 * (GLYPHS.length - 1))));
    const gray = thin > normal ? 238 : 236; // nearest 256-color values to #444444 / #323232
    const cellSeed = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
    const colorPick = Math.sin(col * 39.346 + row * 11.135) * 43758.5453;
    const color = brightness > 2 && index <= 1 && cellSeed - Math.floor(cellSeed) < 0.02
      ? PALETTE[Math.floor((colorPick - Math.floor(colorPick)) * PALETTE.length)] : gray;
    return { char: brightness > 2 ? GLYPHS[index] : '`', color, gray };
  }));
}
