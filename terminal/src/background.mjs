// Growing circles form clipped power cells: overlapping discs share their
// radical-axis chord, clipped against every other circle in the scene.
export const GLYPHS = ' +*#%@';
export const TERMINAL_FPS = 8;
const TAU = Math.PI * 2;
const EPS = 1e-8;
export const LAYER_INTERVAL = 8;
const MAX_CIRCLES_PER_LAYER = 18;

function randomSource(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

// Layers are deterministic from the animation clock: pausing and resizing do
// not accumulate frame history. Each layer has its own circle arrangement.
export function layersAt(width, height, seconds = 0, seed = 0) {
  const physicalHeight = height * 2;
  const aspect = width / physicalHeight;
  const target = Math.min(MAX_CIRCLES_PER_LAYER, Math.max(7, Math.round(5 * Math.max(aspect, 1 / aspect))));
  const columns = Math.min(target, Math.max(1, Math.round(Math.sqrt(target * aspect))));
  const rows = Math.max(1, Math.floor(target / columns));
  const tileWidth = width / columns, tileHeight = physicalHeight / rows;
  const diagonal = Math.hypot(tileWidth, tileHeight);
  const time = (Number.isFinite(seconds) ? Math.max(0, seconds) : 0) + 6;
  const latest = Math.floor(time / LAYER_INTERVAL);
  const layers = [];
  for (let layerId = latest; layerId >= 0; layerId--) {
    const age = time - layerId * LAYER_INTERVAL;
    const circles = [];
    let coversViewport = true;
    for (let slot = 0; slot < columns * rows; slot++) {
      const id = layerId * MAX_CIRCLES_PER_LAYER + slot;
      const random = randomSource((id * 7919 + 910) ^ seed);
      const left = slot % columns * tileWidth, top = Math.floor(slot / columns) * tileHeight;
      const x = left + (0.15 + random() * 0.7) * tileWidth;
      const y = top + (0.15 + random() * 0.7) * tileHeight;
      const delay = slot === 0 ? 0 : 0.4 + random() * 2.6;
      const speed = diagonal * (0.085 + random() * 0.02);
      if (age <= delay) { coversViewport = false; continue; }
      const radius = speed * (age - delay);
      circles.push({ id, x, y, radius, opacity: 1 });
      const farX = Math.max(x - left, left + tileWidth - x);
      const farY = Math.max(y - top, top + tileHeight - y);
      if (radius < Math.hypot(farX, farY)) coversViewport = false;
    }
    layers.push({ id: layerId, circles });
    // A circle covers each tile, so their union covers the whole viewport.
    // Everything below is hidden. With these delays/speeds this takes <=13s,
    // bounding generation to three layers even after hours of animation.
    if (coversViewport) break;
  }
  return layers.reverse();
}

const power = (circle, x, y) => (x - circle.x) ** 2 + (y - circle.y) ** 2 - circle.radius ** 2;

export function circleBoundaries(input) {
  const circles = input.filter(circle => Number.isFinite(circle.x + circle.y + circle.radius)
    && circle.radius > EPS && (circle.opacity ?? 1) > 0);
  const arcs = [], edges = [];
  for (let i = 0; i < circles.length; i++) {
    const a = circles[i], angles = [0, TAU];
    // Split the circumference at intersections, retaining only exposed arcs.
    for (let j = 0; j < circles.length; j++) {
      if (i === j) continue;
      const b = circles[j], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
      if (distance <= Math.abs(a.radius - b.radius) + EPS || distance >= a.radius + b.radius - EPS) continue;
      const along = (a.radius ** 2 - b.radius ** 2 + distance ** 2) / (2 * distance);
      const angle = Math.atan2(dy, dx), delta = Math.acos(Math.max(-1, Math.min(1, along / a.radius)));
      angles.push((angle - delta + TAU) % TAU, (angle + delta + TAU) % TAU);
      if (j < i) continue;
      // Start with the common chord, then clip it to the power cell. This is
      // what makes any number of circles meet without crossing internal arcs.
      const cx = a.x + along * dx / distance, cy = a.y + along * dy / distance;
      const tx = -dy / distance, ty = dx / distance;
      const half = Math.sqrt(Math.max(0, a.radius ** 2 - along ** 2));
      let low = -half, high = half;
      for (let k = 0; k < circles.length; k++) {
        if (k === i || k === j) continue;
        const c = circles[k];
        const slope = 2 * ((c.x - a.x) * tx + (c.y - a.y) * ty);
        const value = power(a, cx, cy) - power(c, cx, cy);
        if (Math.abs(slope) < EPS) {
          if (value > EPS) { high = low; break; }
        } else if (slope > 0) high = Math.min(high, -value / slope);
        else low = Math.max(low, -value / slope);
      }
      if (high - low > EPS) edges.push({
        from: [cx + low * tx, cy + low * ty], to: [cx + high * tx, cy + high * ty],
        opacity: Math.min(a.opacity ?? 1, b.opacity ?? 1), pair: [i, j],
      });
    }
    angles.sort((a, b) => a - b);
    for (let n = 1; n < angles.length; n++) {
      const start = angles[n - 1], end = angles[n];
      if (end - start < EPS) continue;
      const mid = (start + end) / 2;
      const x = a.x + a.radius * Math.cos(mid), y = a.y + a.radius * Math.sin(mid);
      const hidden = circles.some((b, j) => {
        if (i === j) return false;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const same = distance < EPS && Math.abs(a.radius - b.radius) < EPS;
        if (same) return j < i;
        if (distance + a.radius <= b.radius + EPS) return true;
        const value = power(b, x, y);
        return value < -EPS;
      });
      if (!hidden) arcs.push({ x: a.x, y: a.y, radius: a.radius, start, end, opacity: a.opacity ?? 1 });
    }
  }
  return { arcs, edges };
}

function rasterizeLayer(width, height, circles) {
  // Render softly feathered strokes before converting their coverage to ASCII.
  // Sample physical square pixels so tall terminal cells preserve circle shape.
  const samples = Math.max(1, Math.min(6, Math.floor(Math.sqrt(450_000 / (width * height * 2)))));
  const w = width * samples, h = height * samples * 2;
  const pixels = new Float32Array(w * h);
  const glyphs = new Uint8Array(width * height).fill(32);
  const shades = new Uint8Array(width * height).fill(255);
  const opaque = new Uint8Array(width * height);
  // Fill the union of this layer's discs with opaque black before its outline.
  // A black interior must hide older glyphs just as an outline does.
  for (const circle of circles) {
    if (!Number.isFinite(circle.x + circle.y + circle.radius) || circle.radius <= EPS) continue;
    const firstRow = Math.max(0, Math.ceil((circle.y - circle.radius - 1) / 2));
    const lastRow = Math.min(height - 1, Math.floor((circle.y + circle.radius - 1) / 2));
    for (let row = firstRow; row <= lastRow; row++) {
      const dy = row * 2 + 1 - circle.y;
      const reach = Math.sqrt(Math.max(0, circle.radius ** 2 - dy * dy));
      const left = Math.max(0, Math.ceil(circle.x - reach - 0.5));
      const right = Math.min(width - 1, Math.floor(circle.x + reach - 0.5));
      if (left <= right) opaque.fill(1, row * width + left, row * width + right + 1);
    }
  }
  const core = samples * 0.45, feather = samples * 0.6, reach = core + feather;
  const segment = (ax, ay, bx, by, opacity) => {
    ax *= samples; ay *= samples; bx *= samples; by *= samples;
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    const left = Math.max(0, Math.floor(Math.min(ax, bx) - reach));
    const right = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + reach));
    const top = Math.max(0, Math.floor(Math.min(ay, by) - reach));
    const bottom = Math.min(h - 1, Math.ceil(Math.max(ay, by) + reach));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const along = length ? Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / length)) : 0;
      const distance = Math.hypot(x + 0.5 - ax - along * dx, y + 0.5 - ay - along * dy);
      const amount = Math.max(0, Math.min(1, (reach - distance) / feather)) * opacity;
      const index = y * w + x;
      pixels[index] = Math.max(pixels[index], amount);
    }
  };
  const { arcs, edges } = circleBoundaries(circles);
  for (const arc of arcs) {
    const steps = Math.max(1, Math.ceil((arc.end - arc.start) * arc.radius * samples / 2));
    let x = arc.x + arc.radius * Math.cos(arc.start), y = arc.y + arc.radius * Math.sin(arc.start);
    for (let step = 1; step <= steps; step++) {
      const angle = arc.start + (arc.end - arc.start) * step / steps;
      const nextX = arc.x + arc.radius * Math.cos(angle), nextY = arc.y + arc.radius * Math.sin(angle);
      segment(x, y, nextX, nextY, arc.opacity);
      x = nextX; y = nextY;
    }
  }
  for (const edge of edges) segment(...edge.from, ...edge.to, edge.opacity);
  const cellSamples = samples * samples * 2;
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    let coverage = 0;
    for (let y = row * samples * 2; y < (row + 1) * samples * 2; y++) {
      for (let x = col * samples; x < (col + 1) * samples; x++) coverage += pixels[y * w + x];
    }
    coverage /= cellSamples;
    if (coverage < 0.015) continue;
    const light = Math.sqrt(coverage), index = row * width + col;
    const glyph = Math.min(GLYPHS.length - 1, 1 + Math.floor(light * (GLYPHS.length - 1)));
    glyphs[index] = GLYPHS.charCodeAt(glyph);
    shades[index] = 232 + Math.round(light * 23);
    opaque[index] = 1;
  }
  return { glyphs, shades, opaque };
}

function asField(width, height, glyphs, shades) {
  return Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, col) => ({
    char: String.fromCharCode(glyphs[row * width + col]),
    color: shades[row * width + col], gray: shades[row * width + col],
  })));
}

export function rasterizeCircles(width, height, circles) {
  const image = rasterizeLayer(width, height, circles);
  return asField(width, height, image.glyphs, image.shades);
}

// Layers arrive bottom-to-top. Process newest first so the first opaque pixel
// wins; geometry is never intersected across layers. No old-layer state is kept.
export function composeLayers(width, height, layers) {
  const size = width * height;
  const glyphs = new Uint8Array(size).fill(32), shades = new Uint8Array(size).fill(255), covered = new Uint8Array(size);
  const visibleLayerIds = [];
  let coveredCount = 0;
  for (let n = layers.length - 1; n >= 0; n--) {
    if (coveredCount === size) break;
    const layer = layers[n], image = rasterizeLayer(width, height, layer.circles);
    let visible = false;
    for (let i = 0; i < size; i++) {
      if (!image.opaque[i] || covered[i]) continue;
      covered[i] = 1; coveredCount++;
      glyphs[i] = image.glyphs[i]; shades[i] = image.shades[i]; visible = true;
    }
    if (visible) visibleLayerIds.push(layer.id);
  }
  return { field: asField(width, height, glyphs, shades), visibleLayerIds: visibleLayerIds.reverse() };
}

export function background(width, height, frame = 0, seed = 0) {
  width = Math.max(1, Math.min(1024, Math.floor(Number(width)) || 80));
  height = Math.max(1, Math.min(256, Math.floor(Number(height)) || 24));
  return composeLayers(width, height, layersAt(width, height, frame / TERMINAL_FPS, seed)).field;
}
