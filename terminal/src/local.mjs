import { readFileSync } from 'node:fs';
import { attach } from './session.mjs';
import { App } from './app.mjs';
import { plain } from './render.mjs';

const site = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.log(plain(new App(site)));
} else {
  process.stdin.setRawMode(true);
  const session = attach(process.stdin, process.stdout, site, {
    cols: process.stdout.columns, rows: process.stdout.rows,
    onExit() { process.stdin.setRawMode(false); process.stdin.pause(); process.exitCode = 0; },
  });
  process.stdout.on('resize', () => session.resize(process.stdout.columns, process.stdout.rows));
  process.once('SIGTERM', session.finish);
}
