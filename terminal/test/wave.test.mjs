import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SETTINGS, createWaves, controlPoints, randomSource } from '../src/wave.mjs';

test('one main wave with no thin waves retains the website motion settings and curve equations', () => {
  const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  const start = source.indexOf('(function () {\n    var pi = Math.PI;');
  const end = source.indexOf('// Save state on hard navigation', start);
  assert.ok(start >= 0 && end > start);
  const math = Object.create(Math); math.random = randomSource(910);
  const holder = { offsetWidth: 960, offsetHeight: 640, appendChild() {} };
  const context = vm.createContext({ Math: math,
    document: { querySelector: () => holder, createElement: () => ({ getContext: () => ({}), style: {} }) },
    window: { innerWidth: 1200, devicePixelRatio: 1, addEventListener() {}, requestAnimationFrame() {} },
    sessionStorage: { getItem: () => null }, performance: { now: () => 0 },
    isScrolling: false, proximityAnimating: false,
  });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(SETTINGS.waves, 1); assert.equal(SETTINGS.thinWaves, 0);
  for (const [key, value] of Object.entries(SETTINGS)) {
    if (key !== 'waves' && key !== 'thinWaves') {
      assert.deepEqual(JSON.parse(JSON.stringify(context.waves.options[key])), value, key);
    }
  }
  math.random = randomSource(910);
  const site = new context.Waves('#holder', { ...context.waves.options, waves: 1, thinWaves: 0 });
  const terminal = createWaves(randomSource(910));
  const website = [...site.waves, ...site.thinWaves];
  assert.equal(website.length, terminal.length);
  for (let i = 0; i < website.length; i++) {
    const ribbon = website[i];
    for (const elapsed of [0, 60]) {
      for (let tick = 0; tick < (elapsed ? 60 : 1); tick++) ribbon.update();
      const curves = []; let from;
      ribbon.drawToOffscreen({ beginPath() {}, moveTo: (x, y) => { from = [x, y]; },
        bezierCurveTo: (...points) => curves.push([from, points.slice(0, 2), points.slice(2, 4), points.slice(4, 6)]), stroke() {} });
      assert.equal(curves.length, SETTINGS.width);
      for (const trail of [0, 50, 199]) {
        const expected = controlPoints(terminal[i], elapsed + trail + 2, site.width, site.height);
        for (let point = 0; point < 4; point++) for (let axis = 0; axis < 2; axis++) {
          assert.ok(Math.abs(expected[point][axis] - curves[trail][point][axis]) < 1e-8);
        }
      }
    }
  }
});
