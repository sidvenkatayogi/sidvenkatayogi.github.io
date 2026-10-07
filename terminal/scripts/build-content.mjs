import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';
import { execFileSync } from 'node:child_process';
import { clean, safeURL } from '../src/text.mjs';
import { labelLinks } from '../src/links.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const base = 'https://s9v10.dev';

export function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('Expected YAML front matter');
  return { meta: parse(match[1]), body: match[2] };
}

export function plainMarkdown(source) {
  return clean(source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"'))
    .replace(/^[ \t]+|[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractLinks(source) {
  source = source.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const links = [];
  for (const match of source.matchAll(/(?<!!)\[([^\]]+)\]\(([^)]+)\)|<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>|<iframe\b[^>]*src=["']([^"']+)["']/gs)) {
    const url = safeURL(match[2] || match[3] || match[5], base);
    if (url && !links.some(link => link.url === url)) {
      links.push({ label: plainMarkdown(match[1] || match[4] || 'Video demo'), url });
    }
  }
  for (const match of plainMarkdown(source).matchAll(/https?:\/\/[^\s<>]+/g)) {
    const url = safeURL(match[0].replace(/[.,;!?]+$/, ''));
    if (url && !links.some(link => link.url === url)) links.push({ label: url, url });
  }
  return links;
}

export function linkedMarkdown(source, links) {
  const tag = (label, target) => {
    const link = links.find(item => item.url === safeURL(target, base));
    return `${plainMarkdown(label)}${link ? ` [${link.id}]` : ''}`;
  };
  // Preserve link identity before stripping Markdown and HTML formatting.
  const annotated = source.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => tag(label, url))
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gs, (_, url, label) => tag(label, url))
    .replace(/<iframe\b[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi, (_, url) => tag('Video demo', url));
  return plainMarkdown(annotated).replace(/https?:\/\/[^\s<>]+/g, (value, offset, text) => {
    const url = value.replace(/[.,;!?]+$/, '');
    const ref = links.find(item => item.url === safeURL(url));
    if (!ref || text.slice(offset + value.length).startsWith(` [${ref.id}]`)) return value;
    return `${url} [${ref.id}]${value.slice(url.length)}`;
  });
}

async function collection(directory, section) {
  const files = (await readdir(path.join(root, directory))).filter(file => file.endsWith('.md'));
  const entries = await Promise.all(files.map(async file => {
    const { meta, body } = frontmatter(await readFile(path.join(root, directory, file), 'utf8'));
    const slug = clean(meta.slug || file.replace(/\.md$/, '')).toLowerCase();
    const date = String(meta.date || '').slice(0, 10);
    const route = section === 'blog' ? `/blog/${date.replaceAll('-', '/')}/${slug}/` : `/${section}/${slug}/`;
    const text = plainMarkdown(body);
    return {
      slug, title: clean(meta.title), date, order: Number(meta.order || 0),
      tags: (meta.tags || []).map(clean), url: `${base}${route}`,
      body: text || 'An artwork by Elph. Open the website to see the full piece.',
      summary: text.split('\n').find(line => line.trim()) || 'From the Elph portfolio.',
      links: extractLinks(body), sourceBody: body,
      ...(section === 'art' ? { imageSource: body.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1] } : {}),
    };
  }));
  return entries.sort((a, b) => section === 'blog' ? b.date.localeCompare(a.date) : b.order - a.order || a.slug.localeCompare(b.slug));
}

export async function build() {
  const config = parse(await readFile(path.join(root, '_config.yml'), 'utf8'));
  const { body: about } = frontmatter(await readFile(path.join(root, '_pages/about.md'), 'utf8'));
  const layout = await readFile(path.join(root, '_layouts/default.html'), 'utf8');
  const email = config.email.replace(/\s*\[at\]\s*/g, '@').replace(/\s*\(dot\)\s*/g, '.');
  const socials = extractLinks(layout).filter(link => /github\.com|linkedin\.com|twitter\.com|tiktok\.com/.test(link.url));
  const home = await readFile(path.join(root, 'index.html'), 'utf8');
  const quote = home.match(/var quotes\s*=\s*\[[\s\S]*?\n\s*"([^"]+)"/)?.[1] || 'Do you see how infinite you are?';
  const [projects, art, blog] = await Promise.all([
    collection('_projects', 'programming'), collection('_art', 'art'), collection('_posts', 'blog'),
  ]);
  if (art.some(item => !item.imageSource)) throw new Error('An artwork is missing its source image');
  const images = JSON.parse(execFileSync('python3', [fileURLToPath(new URL('prepare-art.py', import.meta.url))], {
    input: JSON.stringify(art.map(item => item.imageSource)), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  }));
  art.forEach((item, index) => {
    item.image = images[index]; delete item.imageSource;
    item.links.unshift({ label: 'Original artwork', url: item.image.source });
    if (item.body.startsWith('An artwork by Elph.')) item.body = 'An artwork by Elph.';
  });
  const aboutEnd = about.match(/always looking for new opportunities!*/i);
  if (!aboutEnd) throw new Error('The terminal About cutoff was not found');
  const terminalAbout = about.slice(0, aboutEnd.index + aboutEnd[0].length);
  for (const item of [...projects, ...art, ...blog]) {
    item.links = labelLinks([...item.links, { label: 'Website', url: item.url }]);
    item.body = linkedMarkdown(item.sourceBody, item.links) || 'An artwork by Elph.';
    delete item.sourceBody;
  }
  const aboutLinks = labelLinks([...extractLinks(terminalAbout), { label: 'Website', url: `${base}/about.html` }]);
  const data = {
    schemaVersion: 1, sourceRevision: process.env.GITHUB_SHA || null,
    name: clean(config.title), base, quote: clean(quote), email,
    about: { title: 'About me', body: linkedMarkdown(terminalAbout, aboutLinks), url: `${base}/about.html`, links: aboutLinks },
    socials, projects, art, blog,
  };
  const target = new URL('../content/site.json', import.meta.url);
  await mkdir(new URL('../content/', import.meta.url), { recursive: true });
  await writeFile(target, JSON.stringify(data, null, 2) + '\n');
  console.log(`Synced ${projects.length} projects, ${art.length} artworks, ${blog.length} posts from Jekyll.`);
  return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
