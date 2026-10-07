import { emitKeypressEvents } from 'node:readline';
import { App } from './app.mjs';
import { render, openingFrame, draw, ENTER, LEAVE } from './render.mjs';
import { TERMINAL_FPS } from './wave.mjs';

// The same UI runs on a local TTY and each independent SSH channel.
export function attach(input, output, site, { cols = 80, rows = 24, onExit = () => {}, idleMs = 600_000 } = {}) {
  const app = new App(site);
  let previous, blocked = false, stopped = false, lastInput = Date.now();
  let bytes = 0, windowStart = Date.now();
  const openedAt = performance.now();
  let opening = true, timer, lastTick = performance.now();
  output.write(ENTER);

  function endOpening() {
    if (!opening) return;
    opening = false;
    lastTick = performance.now();
    clearInterval(timer);
    timer = setInterval(tick, 1000 / TERMINAL_FPS);
    timer.unref();
  }
  function refresh(force = false) {
    if (stopped || blocked) return;
    let screen = opening ? openingFrame(cols, rows, performance.now() - openedAt) : null;
    if (!screen) { endOpening(); screen = render(app, cols, rows); }
    blocked = !output.write(draw(screen, force ? null : previous));
    previous = screen;
  }
  function finish() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    input.off('keypress', keypress); input.off('data', traffic);
    input.off('close', finish); input.off('end', finish); input.off('error', finish);
    output.off('drain', drain);
    if (!output.destroyed && !output.writableEnded) output.write(LEAVE + 'See you on https://s9v10.dev\r\n');
    onExit();
  }
  function keypress(str, key) {
    if (stopped) return;
    lastInput = Date.now();
    endOpening(); // An early keystroke skips the opening without losing the command.
    app.key(str, key);
    if (app.closed) finish(); else refresh();
  }
  function traffic(chunk) {
    const now = Date.now();
    if (now - windowStart > 1000) { bytes = 0; windowStart = now; }
    bytes += chunk.length;
    if (bytes > 32768) finish();
  }
  function drain() { blocked = false; refresh(true); }
  // Count traffic before parsing potentially large pasted input.
  input.on('data', traffic);
  emitKeypressEvents(input);
  input.on('keypress', keypress);
  input.on('close', finish); input.on('end', finish); input.on('error', finish);
  output.on('drain', drain);
  function tick() {
    const now = performance.now(), delta = now - lastTick;
    lastTick = now;
    if (Date.now() - lastInput > idleMs) { finish(); return; }
    if (opening) refresh();
    else if (app.motion && !blocked) { app.frame += delta * TERMINAL_FPS / 1000; refresh(); }
  }
  timer = setInterval(tick, 32);
  timer.unref();
  refresh(true);
  return {
    app, finish,
    resize(nextCols, nextRows) { cols = nextCols; rows = nextRows; previous = null; refresh(true); },
  };
}
