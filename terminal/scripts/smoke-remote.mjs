import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ssh2 from 'ssh2';
import { strip } from '../src/render.mjs';

const config = JSON.parse(readFileSync(new URL('../deploy/state.json', import.meta.url)));
const host = process.argv[2] || config.hostname;
const clients = [];
const deadline = setTimeout(() => { console.error('Live SSH test timed out'); process.exit(1); }, 20_000);
async function connect() {
  const client = new ssh2.Client(); clients.push(client);
  client.connect({ host, port: 22, username: 'visitor', authHandler: ['none'], readyTimeout: 8000,
    hostVerifier: key => `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}` === config.hostFingerprint });
  await once(client, 'ready');
  return client;
}
function watch(stream) {
  let output = '';
  stream.on('data', data => output += data);
  return async pattern => {
    const end = Date.now() + 4000;
    while (!pattern.test(output) && !pattern.test(strip(output))) {
      if (Date.now() > end) throw new Error(`Missing ${pattern}: ${strip(output).slice(-400)}`);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    output = '';
  };
}
try {
  const visitor = await connect();
  const stream = await new Promise((resolve, reject) => visitor.shell({ term: 'xterm-256color', cols: 100, rows: 32 },
    (error, channel) => error ? reject(error) : resolve(channel)));
  const wait = watch(stream);
  await wait(/\x1b\[48;5;0m[\s\S]*Do you see how infinite you are\?/);
  await wait(/\[0\] home/);
  stream.write('2'); await wait(/retrieval module/);
  stream.write('\x1b[B'); await wait(/External Sort/);
  stream.write('\x1b[C'); await wait(/Project focused/);
  stream.write('\x1b[B'); await wait(/2-\d+\/\d+/);
  stream.write('\x1b[D'); await wait(/Project list focused/);
  stream.write('\r'); await wait(/Project focused/);
  stream.write('\x1b[D'); await wait(/Project list focused/);
  stream.write('pixie\r'); await wait(/PIcture eXploration/);
  stream.write('links\r'); await wait(/\[b\] Github repository!/);
  stream.write('\x1b[B'); await wait(/https:\/\/github.com\/sidvenkatayogi\/pixie/);
  stream.write('\x1b[D'); await wait(/PIcture eXploration/);
  stream.write('forward\r'); await wait(/https:\/\/github.com\/sidvenkatayogi\/pixie/);
  stream.setWindow(6, 12, 0, 0); await wait(/A little/);
  stream.setWindow(32, 100, 0, 0); await wait(/https:\/\/github.com\/sidvenkatayogi\/pixie/);
  stream.write('open\r'); await wait(/Unknown command: open/);
  stream.write('3'); await wait(/EXTERMINATION[\s\S]*\x1b\[38;5;(?:[1-9]\d|1\d\d|2[01]\d)m/);
  stream.write('\x1b[B'); await wait(/CORNERSTORE CHAOS/);
  stream.write('\r'); await wait(/Read here/);
  stream.setWindow(90, 240, 0, 0); await wait(/\x1b\[87;/);
  stream.setWindow(24, 40, 0, 0); await wait(/\x1b\[21;/);
  stream.write('4'); await wait(/Relevance Ranking/);
  stream.write('\x1b[C'); await wait(/Post focused/);
  stream.write('\x1b[B'); await wait(/2-\d+\/\d+/);
  stream.write('\x1b[D'); await wait(/Post list focused/);
  stream.write('\r'); await wait(/Post focused/);
  stream.write('\x1b'); await wait(/Post list focused/);
  const closed = once(stream, 'close'); stream.write('quit\r'); await closed;
  console.log('PASS live project/blog focus/scroll/unfocus, direct references, removed open command, colored artwork, history, hyperlinks, resizing, quit');

  const restricted = await connect();
  assert.ok(await new Promise(resolve => restricted.forwardOut('127.0.0.1', 5000, '127.0.0.1', 22222, error => resolve(error))));
  assert.ok(await new Promise(resolve => restricted.forwardIn('127.0.0.1', 0, error => resolve(error))));
  assert.ok(await new Promise(resolve => restricted.sftp(error => resolve(error))));
  const command = await connect();
  const result = await new Promise((resolve, reject) => command.exec('cat /etc/passwd', (error, channel) => {
    if (error) return reject(error);
    let output = ''; channel.on('data', data => output += data);
    channel.on('close', code => resolve({ code, output }));
  }));
  assert.equal(result.code, 1); assert.match(result.output, /Unknown command/);
  console.log('PASS live shell, SFTP and forwarding restrictions');
} finally {
  clearTimeout(deadline);
  for (const client of clients) client.destroy();
}
