import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.argv[2]) throw new Error('Usage: node terminal/deploy/web/build.mjs <output-directory>');
const output = resolve(process.argv[2]);
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const assets = [
    ['assets/css/terminal.css', 'assets/css/terminal.css'],
    ['terminal/web/terminal.js', 'assets/js/terminal.js'],
    ['assets/fonts/Inter_28pt-Regular.woff2', 'assets/fonts/Inter_28pt-Regular.woff2'],
    ['assets/fonts/Inter-SemiBold.woff2', 'assets/fonts/Inter-SemiBold.woff2'],
];
const hash = createHash('sha256');
for (const [source, target] of assets) {
    const content = await readFile(resolve(repo, source));
    hash.update(content);
    const destination = resolve(output, target);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
}
const html = await readFile(resolve(repo, 'terminal/web/index.html'), 'utf8');
await writeFile(resolve(output, 'index.html'), html.replaceAll('__ASSET_VERSION__', hash.digest('hex').slice(0, 16)));
console.log(`Built terminal landing page at ${output}`);
