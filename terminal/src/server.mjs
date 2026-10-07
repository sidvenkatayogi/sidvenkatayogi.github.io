import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ssh2 from 'ssh2';
import { App } from './app.mjs';
import { plain } from './render.mjs';
import { attach } from './session.mjs';
import { createContentStore } from './content.mjs';

export const site = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));

export function hostKey(filename) {
  try { return readFileSync(filename); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const { private: key } = ssh2.utils.generateKeyPairSync('ed25519');
  try { writeFileSync(filename, key, { mode: 0o600, flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return readFileSync(filename);
}

export function createServer({ key, data = site, getData = () => data, maxConnections = 64, maxPerIP = 8, idleMs = 600_000 } = {}) {
  const clients = new Set();
  const counts = new Map();
  const server = new ssh2.Server({ hostKeys: [key], ident: 's9v10-portfolio' }, (client, info) => {
    client.on('error', () => {}); // A malformed or dropped connection must not kill the server.
    if (clients.size >= maxConnections || (counts.get(info.ip) || 0) >= maxPerIP) { client.end(); return; }
    clients.add(client); counts.set(info.ip, (counts.get(info.ip) || 0) + 1);
    const authDeadline = setTimeout(() => client.end(), 10_000);
    const lifetime = setTimeout(() => client.end(), 3_600_000);
    authDeadline.unref(); lifetime.unref();
    let active = false, ui;
    client.on('authentication', ctx => ctx.method === 'none' ? ctx.accept() : ctx.reject(['none']));
    client.on('ready', () => clearTimeout(authDeadline));
    client.on('close', () => {
      clearTimeout(authDeadline); clearTimeout(lifetime); ui?.finish();
      clients.delete(client);
      const count = (counts.get(info.ip) || 1) - 1;
      if (count) counts.set(info.ip, count); else counts.delete(info.ip);
    });
    // The public connection is a portfolio viewer. No OS shell, forwarding or files.
    client.on('tcpip', (_accept, reject) => reject());
    client.on('openssh.streamlocal', (_accept, reject) => reject());
    client.on('request', (_accept, reject) => reject?.());
    client.on('session', (accept, reject) => {
      if (active) { reject(); return; }
      active = true;
      const data = getData();
      const session = accept();
      let pty = null, started = false;
      session.on('pty', (accept, reject, info) => {
        if (started) { reject?.(); return; }
        pty = { cols: info.cols || 80, rows: info.rows || 24, term: info.term };
        accept?.();
      });
      session.on('window-change', (accept, _reject, info) => { ui?.resize(info.cols, info.rows); accept?.(); });
      for (const event of ['env', 'auth-agent', 'x11', 'subsystem']) session.on(event, (_accept, reject) => reject?.());
      session.on('signal', (accept) => { ui?.finish(); accept?.(); });
      session.on('shell', (accept, reject) => {
        if (started) { reject?.(); return; }
        started = true;
        const stream = accept();
        stream.on('error', () => {});
        if (!pty || pty.term === 'dumb') {
          stream.exit(0);
          stream.end(plain(new App(data)) + '\nFor interactive navigation: ssh -t sh.s9v10.dev\n');
          return;
        }
        ui = attach(stream, stream, data, { ...pty, idleMs, onExit: () => { stream.exit(0); stream.end(); } });
      });
      session.on('exec', (accept, reject, info) => {
        if (started) { reject?.(); return; }
        started = true;
        const stream = accept();
        stream.on('error', () => {});
        const app = new App(data);
        const ok = info.command.length <= 256 && app.execute(info.command);
        stream.exit(ok ? 0 : 1);
        stream.end(ok ? plain(app) : app.status + '\nUse portfolio commands such as about, projects, or help.\n');
      });
    });
  });
  server.maxConnections = maxConnections;
  server.shutdown = () => { for (const client of clients) client.end(); server.close(); };
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 2222);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const host = process.env.HOST || '127.0.0.1';
  const keyPath = resolve(process.env.HOST_KEY_PATH || fileURLToPath(new URL('../.state/host_ed25519', import.meta.url)));
  const content = await createContentStore({
    initial: site,
    url: process.env.CONTENT_URL,
    cachePath: process.env.CONTENT_URL ? resolve(dirname(keyPath), 'content.json') : undefined,
  });
  const server = createServer({ key: hostKey(keyPath), getData: content.get });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, host, () => {
    console.log(`S9V10 terminal listening on ${host}:${port}`);
    console.log(`Connect: ssh -p ${port} ${host === '0.0.0.0' ? 'localhost' : host}`);
    content.start();
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    content.stop();
    server.shutdown();
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
