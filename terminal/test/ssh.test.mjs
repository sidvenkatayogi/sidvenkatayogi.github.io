import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ssh2 from 'ssh2';
import { createServer, hostKey, site } from '../src/server.mjs';
import { strip } from '../src/render.mjs';

const key = ssh2.utils.generateKeyPairSync('ed25519').private;
async function setup(t, options = {}) {
  const server = createServer({ key, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.shutdown());
  const connect = async () => {
    const client = new ssh2.Client();
    t.after(() => client.destroy());
    client.connect({ host: '127.0.0.1', port: server.address().port, username: 'any-visitor', readyTimeout: 3000,
      hostVerifier: () => true, authHandler: ['none'] });
    await once(client, 'ready');
    return client;
  };
  return { server, connect };
}
const exec = (client, command) => new Promise((resolve, reject) => client.exec(command, (error, stream) => {
  if (error) return reject(error);
  let output = ''; stream.on('data', data => output += data);
  stream.on('close', code => resolve({ code, output })); stream.on('error', reject);
}));
const shell = client => new Promise((resolve, reject) => client.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (error, stream) => error ? reject(error) : resolve(stream)));
function observer(stream) {
  let output = '';
  const checks = new Set();
  stream.on('data', data => { output += data; for (const check of checks) check(); });
  return {
    clear() { output = ''; },
    wait(pattern) { return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { checks.delete(check); reject(new Error(`Missing ${pattern}: ${strip(output).slice(-700)}`)); }, 3000);
      function check() { if (pattern.test(output) || pattern.test(strip(output))) { clearTimeout(timer); checks.delete(check); resolve(output); } }
      checks.add(check); check();
    }); },
  };
}

test('real SSH: password-free handshake, typing, arrows, details, links, resize and clean exit', { timeout: 15_000 }, async t => {
  const { connect } = await setup(t);
  const client = await connect(); const stream = await shell(client); const output = observer(stream);
  await output.wait(/\x1b\[48;5;0m[\s\S]*Do you see how infinite you are\?/);
  await output.wait(/\[0\] home/);
  output.clear(); stream.write('2'); await output.wait(/Qwen-QRec/);
  output.clear(); stream.write('\x1b[B'); await output.wait(/External Sort/);
  output.clear(); stream.write('\r'); await output.wait(/Project focused/);
  stream.write('\x1b');
  // Escape is a standalone key; readline disambiguates it from escape sequences.
  await new Promise(resolve => setTimeout(resolve, 550));
  output.clear(); stream.write('\x1b[B\x1b[B\r'); await output.wait(/PIcture eXploration/);
  output.clear(); stream.write('links\r'); await output.wait(/\x1b\]8;;https:\/\/s9v10.dev\/programming\/pixie\//);
  output.clear(); stream.write('b\r'); await output.wait(/> \[b\] Github/);
  output.clear(); stream.setWindow(6, 12, 0, 0); await output.wait(/A little/);
  output.clear(); stream.setWindow(24, 80, 0, 0); await output.wait(/https:\/\/github.com\/sidvenkatayogi\/pixie/);
  const closed = once(stream, 'close'); stream.write('\x03'); await closed;
});

test('SSH sessions stay independent and remote commands cannot run OS commands', { timeout: 10_000 }, async t => {
  const { connect } = await setup(t);
  const one = await connect(); const two = await connect();
  const streamOne = await shell(one); const streamTwo = await shell(two);
  const first = observer(streamOne); const second = observer(streamTwo);
  await first.wait(/\[0\] home/); await second.wait(/\[0\] home/);
  streamOne.write('3'); await first.wait(/EXTERMINATION/);
  second.clear(); streamTwo.write('motion off\r'); await second.wait(/ASCII animation off/);
  const three = await connect();
  const result = await exec(three, 'cat /etc/passwd');
  assert.equal(result.code, 1); assert.match(result.output, /Unknown command/);
  const four = await connect();
  const portfolio = await exec(four, 'projects');
  assert.equal(portfolio.code, 0); assert.match(portfolio.output, /Qwen-QRec/);
});

test('public SSH refuses SFTP and local/remote port forwarding', { timeout: 10_000 }, async t => {
  const { connect } = await setup(t);
  const client = await connect();
  const forwarding = await new Promise(resolve => client.forwardOut('127.0.0.1', 5000, '127.0.0.1', 80, error => resolve(error)));
  assert.ok(forwarding);
  const remote = await new Promise(resolve => client.forwardIn('127.0.0.1', 0, error => resolve(error)));
  assert.ok(remote);
  const sftp = await new Promise(resolve => client.sftp(error => resolve(error)));
  assert.ok(sftp);
});

test('new SSH visitors get refreshed content while active visitors keep their current page', { timeout: 10_000 }, async t => {
  let current = { ...site, about: { ...site.about, body: 'Original content snapshot' } };
  const { connect } = await setup(t, { getData: () => current });
  const stream = await shell(await connect()), output = observer(stream);
  stream.write('about\r'); await output.wait(/Original content snapshot/);
  current = { ...site, about: { ...site.about, body: 'Updated content snapshot' } };
  const fresh = await exec(await connect(), 'about');
  assert.match(fresh.output, /Updated content snapshot/);
  output.clear(); stream.write('home\rabout\r');
  await output.wait(/Original content snapshot/);
});

test('idle sessions close and persistent host keys keep the same identity', { timeout: 5000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 's9v10-hostkey-'));
  const path = join(dir, 'key'); const first = hostKey(path); const second = hostKey(path);
  assert.deepEqual(first, second); assert.deepEqual(first, readFileSync(path));
  assert.equal(statSync(path).mode & 0o777, 0o600);
  const { connect } = await setup(t, { idleMs: 180 });
  const stream = await shell(await connect()); stream.resume();
  await once(stream, 'close');
});
