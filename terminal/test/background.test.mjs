import test from 'node:test';
import assert from 'node:assert/strict';
import { background, layersAt, composeLayers, circleBoundaries, rasterizeCircles, GLYPHS, TERMINAL_FPS } from '../src/background.mjs';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const circle = (x, y, radius) => ({ x, y, radius, opacity: 1 });
const power = (c, x, y) => (x - c.x) ** 2 + (y - c.y) ** 2 - c.radius ** 2;

test('separate circles remain round; overlapping equal and unequal circles share one straight chord', () => {
  const separate = circleBoundaries([circle(0, 0, 2), circle(6, 0, 2)]);
  assert.equal(separate.edges.length, 0); assert.equal(separate.arcs.length, 2);
  for (const [r1, r2] of [[5, 5], [6, 4]]) {
    const circles = [circle(0, 0, r1), circle(6, 0, r2)];
    const { arcs, edges } = circleBoundaries(circles);
    assert.equal(edges.length, 1);
    const edge = edges[0], expectedX = (r1 * r1 - r2 * r2 + 36) / 12;
    near(edge.from[0], expectedX); near(edge.to[0], expectedX);
    for (const endpoint of [edge.from, edge.to]) {
      near(power(circles[0], ...endpoint), 0);
      near(power(circles[1], ...endpoint), 0);
    }
    for (const arc of arcs) for (let n = 0; n <= 20; n++) {
      const angle = arc.start + (arc.end - arc.start) * n / 20;
      const x = arc.x + arc.radius * Math.cos(angle), y = arc.y + arc.radius * Math.sin(angle);
      assert.ok(circles.every(c => power(c, x, y) >= -1e-6), 'overlapping inner arcs are removed');
    }
  }
});

test('three-way intersections meet at one junction; additional circles clip every shared edge', () => {
  const circles = [circle(0, 0, 5), circle(6, 0, 5), circle(3, Math.sqrt(27), 5)];
  const { edges } = circleBoundaries(circles);
  assert.equal(edges.length, 3);
  const junction = [3, Math.sqrt(3)];
  for (const edge of edges) {
    assert.ok([edge.from, edge.to].some(point => Math.hypot(point[0] - junction[0], point[1] - junction[1]) < 1e-6));
  }
  circles.push(circle(2, 1, 3), circle(8, 4, 4), circle(-2, 4, 4));
  for (const edge of circleBoundaries(circles).edges) for (let n = 0; n <= 20; n++) {
    const x = edge.from[0] + (edge.to[0] - edge.from[0]) * n / 20;
    const y = edge.from[1] + (edge.to[1] - edge.from[1]) * n / 20;
    const p = power(circles[edge.pair[0]], x, y);
    near(p, power(circles[edge.pair[1]], x, y));
    assert.ok(p <= 1e-6 && circles.every(c => power(c, x, y) >= p - 1e-6));
  }
});

test('tangent, contained, coincident, empty, and invalid circles have no spurious edges', () => {
  assert.equal(circleBoundaries([circle(0, 0, 2), circle(4, 0, 2)]).arcs.length, 2);
  for (const circles of [
    [circle(0, 0, 5), circle(1, 0, 2)],
    [circle(0, 0, 5), circle(3, 0, 2)],
    [circle(0, 0, 5), circle(0, 0, 5)],
  ]) {
    const result = circleBoundaries(circles);
    assert.equal(result.arcs.length, 1); assert.equal(result.edges.length, 0);
  }
  assert.deepEqual(circleBoundaries([circle(NaN, 0, 2), circle(0, 0, -1)]), { arcs: [], edges: [] });
  assert.deepEqual(circleBoundaries([]), { arcs: [], edges: [] });
});

test('layers keep growing linearly, spawn over older layers, and vary by session seed', () => {
  const first = layersAt(80, 24, 0, 123), next = layersAt(80, 24, 1, 123);
  const later = layersAt(80, 24, 2, 123);
  const a = first[0].circles[0], b = next[0].circles[0], c = later[0].circles[0];
  assert.equal(a.x, b.x); assert.equal(a.y, b.y);
  assert.ok(b.radius > a.radius); near(b.radius - a.radius, c.radius - b.radius);
  assert.ok(layersAt(80, 24, 3, 123).some(layer => layer.id === 1 && layer.circles.length));
  assert.deepEqual(first, layersAt(80, 24, 0, 123));
  assert.notDeepEqual(first, layersAt(80, 24, 0, 456));
  assert.deepEqual(first, layersAt(80, 24, NaN, 123));
  assert.equal(GLYPHS, ' +*#%@');
  // Motion continues long after the old single layer would have settled.
  for (const time of [60, 600, 3600]) {
    assert.notDeepEqual(background(80, 24, time * TERMINAL_FPS, 123), background(80, 24, (time + 1) * TERMINAL_FPS, 123));
  }
});

test('long sessions retain at most three layers and only discard layers covered by newer circles', () => {
  for (const time of [0, 8, 16, 30, 100, 3600, 1e6]) for (const [width, height] of [[80, 24], [240, 8], [16, 80]]) {
    const layers = layersAt(width, height, time, 123);
    assert.ok(layers.length > 0 && layers.length <= 3);
    assert.ok(layers.every(layer => layer.circles.length <= 18));
    assert.ok(layers.flatMap(layer => layer.circles).every(c => Number.isFinite(c.x + c.y + c.radius)));
    if (layers[0].id > 0) {
      const old = { id: -1, circles: [circle(width / 2, height, Math.hypot(width, height * 2))] };
      const withOld = composeLayers(width, height, [old, ...layers]);
      assert.ok(!withOld.visibleLayerIds.includes(-1), 'discarded history is completely covered');
      assert.deepEqual(withOld.field, composeLayers(width, height, layers).field);
    }
  }
});

test('black interiors cover lower layers and intersections happen only within the same layer', () => {
  const a = { ...circle(20, 30, 15), id: 1 };
  const b = { ...circle(40, 30, 15), id: 2 };
  const separate = composeLayers(60, 30, [{ id: 0, circles: [a] }, { id: 1, circles: [b] }]);
  assert.deepEqual(separate.visibleLayerIds, [0, 1]);
  assert.equal(separate.field[15][30].char, ' ', 'no cross-layer chord');
  assert.equal(separate.field[15][35].char, ' ', 'upper black interior erases the lower outline');
  const upper = rasterizeCircles(60, 30, [b]);
  upper.forEach((row, y) => row.forEach((cell, x) => {
    if (cell.char !== ' ') assert.deepEqual(separate.field[y][x], cell, 'front outline and shading stay whole');
  }));
  const same = composeLayers(60, 30, [{ id: 0, circles: [a, b] }]);
  assert.notEqual(same.field[15][30].char, ' ', 'same-layer circles share their chord');
  const hidden = { id: 0, circles: [circle(40, 30, 3)] };
  const top = { id: 1, circles: [b] };
  assert.deepEqual(composeLayers(60, 30, [hidden, top]).visibleLayerIds, [1]);
  const cover = { id: 2, circles: [circle(30, 30, 100)] };
  const covered = composeLayers(60, 30, [hidden, top, cover]);
  assert.deepEqual(covered.visibleLayerIds, [2]);
  assert.deepEqual(covered.field, composeLayers(60, 30, [cover]).field);
});

test('soft outlines vary glyph density and brightness, including sub-cell motion', () => {
  const a = { ...circle(20, 30, 15), id: 10 };
  const b = { ...circle(40, 30, 15), id: 20 };
  const solo = rasterizeCircles(60, 30, [a]).flat().filter(cell => cell.char !== ' ');
  assert.ok(new Set(solo.map(cell => cell.char)).size >= 3);
  assert.ok(new Set(solo.map(cell => cell.gray)).size >= 3);
  assert.ok(solo.some(cell => cell.gray < 245) && solo.some(cell => cell.gray > 245));
  assert.ok(solo.every(cell => '+*#%@'.includes(cell.char) && cell.color === cell.gray));
  const pair = rasterizeCircles(60, 30, [a, b]);
  assert.deepEqual(pair, rasterizeCircles(60, 30, [b, a]));
  const third = { ...circle(30, 44, 15), id: 30 };
  assert.deepEqual(rasterizeCircles(60, 30, [a, b, third]), rasterizeCircles(60, 30, [third, b, a]));
  assert.notDeepEqual(rasterizeCircles(60, 30, [a]), rasterizeCircles(60, 30, [{ ...a, x: a.x + 0.125 }]));
});

test('ASCII rings have neutral shaded outlines, empty black centers, and straight shared dividers', () => {
  const solo = rasterizeCircles(60, 30, [circle(30, 30, 15)]);
  assert.equal(solo[15][30].char, ' ');
  assert.equal(solo[0][0].char, ' ');
  const active = [];
  solo.forEach((row, y) => row.forEach((cell, x) => {
    if (cell.char !== ' ') active.push([x, y]);
    assert.equal(cell.color, cell.gray); assert.ok(cell.gray >= 232 && cell.gray <= 255);
  }));
  assert.ok(active.length > 30);
  for (const [x, y] of active) assert.ok(Math.abs(Math.hypot(x + 0.5 - 30, (y + 0.5) * 2 - 30) - 15) < 3.5);
  const pair = rasterizeCircles(60, 30, [circle(20, 30, 15), circle(40, 30, 15)]);
  assert.ok(pair[15].slice(29, 31).some(cell => cell.char !== ' '));
  assert.equal(pair[15][25].char, ' '); assert.equal(pair[15][35].char, ' ');
});

test('soft outlines stay connected and shared dividers have feathered edges', () => {
  for (const radius of [3, 5, 10, 15, 20, 30]) {
    const field = rasterizeCircles(90, 45, [circle(45.3, 44.7, radius)]);
    const occupied = [];
    for (let y = 0; y < field.length; y++) for (let x = 0; x < field[y].length; x++) {
      assert.ok(GLYPHS.includes(field[y][x].char));
      if (field[y][x].char === ' ') continue;
      occupied.push([x, y]);

    }
    // All pixels must belong to the same eight-connected outline.
    const remaining = new Set(occupied.map(([x, y]) => `${x},${y}`));
    const queue = [occupied[0]]; remaining.delete(occupied[0].join(','));
    for (let n = 0; n < queue.length; n++) {
      const [x, y] = queue[n];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (remaining.delete(`${x + dx},${y + dy}`)) queue.push([x + dx, y + dy]);
      }
    }
    assert.equal(remaining.size, 0, `closed connected circle at radius ${radius}`);
  }
  // Large circles put their outside arcs off-screen, isolating the stroke's
  // intensity profile. A slight sub-cell offset reveals its feathered edge.
  const vertical = rasterizeCircles(60, 30, [circle(0.3, 30, 100), circle(60.3, 30, 100)]);
  const verticalShades = vertical[15].filter(cell => cell.char !== ' ').map(cell => cell.gray);
  assert.ok(new Set(verticalShades).size > 1);
  assert.ok(vertical.every(row => row[30].char !== ' '));
  const horizontal = rasterizeCircles(60, 30, [circle(30, 0.3, 100), circle(30, 60.3, 100)]);
  const horizontalShades = horizontal.map(row => row[30]).filter(cell => cell.char !== ' ').map(cell => cell.gray);
  assert.ok(new Set(horizontalShades).size > 1);
  assert.ok(horizontal[15].every(cell => cell.char !== ' '));
});

test('animation fits small, wide, tall and bounded large windows', () => {
  for (const [width, height] of [[16, 8], [36, 50], [80, 24], [240, 30], [160, 90], [1024, 256]]) {
    const frame = background(width, height);
    assert.equal(frame.length, height);
    assert.ok(frame.every(row => row.length === width && row.every(cell => GLYPHS.includes(cell.char))));
    assert.ok(frame.flat().filter(cell => cell.char !== ' ').length > 5);
  }
  assert.notDeepEqual(background(80, 24), background(80, 24, 2 * TERMINAL_FPS));
  assert.deepEqual(background(0, -1), background(80, 1));
});
