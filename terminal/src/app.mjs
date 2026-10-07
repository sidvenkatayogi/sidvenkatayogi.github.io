import { clean, safeURL } from './text.mjs';
import { labelLinks } from './links.mjs';

export const SECTIONS = ['home', 'about', 'projects', 'art', 'blog', 'contact'];
export const READING_SECTIONS = ['projects', 'blog'];
export const COMMANDS = [...SECTIONS, 'help', 'read', 'links', 'references', 'search', 'back', 'forward', 'color', 'motion', 'clear', 'quit'];
const ALIASES = { programming: 'projects', whoami: 'about', ls: 'projects', exit: 'quit', references: 'links', refs: 'links' };

export class App {
  constructor(site) {
    this.site = site;
    this.page = 'home'; this.detail = null; this.selected = 0; this.offset = 0; this.listOffset = 0;
    this.filter = ''; this.stack = []; this.future = [];
    this.input = ''; this.cursor = 0; this.history = []; this.historyIndex = 0;
    this.draft = ''; this.pasting = false; this.color = false; this.motion = true;
    this.frame = 0; this.closed = false; this.status = 'Welcome in. Type help, or press a section number.';
  }

  items() {
    if (this.detail) return [];
    return this.options();
  }

  options() {
    if (this.page === 'links') return this.linkItems || [];
    if (this.page === 'contact') return labelLinks([{ label: 'Email', url: `mailto:${this.site.email}` },
      ...this.site.socials]).map(link => ({ ...link, title: link.label, summary: link.url }));
    const items = this.site[this.page];
    return Array.isArray(items) ? items.filter(item => !this.filter ||
      `${item.title} ${item.tags.join(' ')} ${item.body}`.toLowerCase().includes(this.filter.toLowerCase())) : [];
  }

  entry() {
    return this.detail || (this.page === 'about' ? this.site.about : this.options()[this.selected]);
  }

  references() {
    if (this.page === 'links') return this.linkItems || [];
    if (this.page === 'contact') return this.options();
    const entry = this.entry();
    if (entry?.links) return entry.links;
    return labelLinks([{ label: 'Website', url: this.site.base }, ...this.site.socials]);
  }

  snapshot() {
    return Object.fromEntries(['page', 'detail', 'selected', 'offset', 'listOffset', 'filter', 'linkItems'].map(key => [key, this[key]]));
  }

  remember() {
    this.stack.push(this.snapshot()); this.future = [];
    if (this.stack.length > 50) this.stack.shift();
  }

  navigate(page, detail = null) {
    this.remember();
    this.page = page; this.detail = detail; this.selected = 0; this.offset = 0; this.listOffset = 0;
    this.filter = '';
    this.status = READING_SECTIONS.includes(page) ? ''
      : detail ? 'Read here. links: references.'
      : ['projects', 'art', 'blog', 'contact', 'links'].includes(page) ? 'Up/Down: select. PgUp/PgDn: scroll. Enter: read.'
      : 'Type a command, or use the number shortcuts.';
  }

  currentURL() {
    if (this.detail) return this.detail.url;
    if (this.options().length) return this.options()[this.selected]?.url || this.site.base;
    return this.page === 'about' ? this.site.about.url : this.site.base;
  }

  resolve(target) {
    if (/^\d+$/.test(target)) return this.options()[Number(target) - 1];
    for (const page of ['projects', 'art', 'blog']) {
      const item = this.site[page].find(item => item.slug === target.toLowerCase() || item.title.toLowerCase() === target.toLowerCase());
      if (item) return { ...item, page };
    }
    const page = ALIASES[target] || target;
    if (page === 'contact') return { url: `mailto:${this.site.email}` };
    if (SECTIONS.includes(page)) return { url: page === 'home' ? this.site.base : `${this.site.base}/${page === 'projects' ? 'programming' : page}.html` };
    return this.site.socials.find(link => link.label.toLowerCase() === target.toLowerCase());
  }

  showReferences(url) {
    let links = this.references();
    if (url !== undefined) {
      url = safeURL(url);
      if (!url) { this.status = 'No link found. Type links for references.'; return false; }
      if (!links.some(link => link.url === url)) {
        const label = this.site.socials.find(link => safeURL(link.url) === url)?.label || 'Website';
        links = labelLinks([...links, { label, url }]);
      }
    }
    if (this.page !== 'links') this.navigate('links');
    this.linkItems = links.map(link => ({ ...link, title: link.label, summary: link.url }));
    if (url) { this.selected = this.linkItems.findIndex(link => link.url === url); this.offset = 0; }
    this.status = '';
    return true;
  }

  focusEntry(item = this.entry()) {
    const page = item?.page || this.page;
    if (!item?.body || !READING_SECTIONS.includes(page)) { this.status = 'Choose an entry first. Type search to clear your filter.'; return false; }
    if (this.page !== page) this.navigate(page);
    const same = this.entry()?.url === item.url;
    if (!this.options().some(option => option.url === item.url)) this.filter = '';
    this.selected = Math.max(0, this.options().findIndex(option => option.url === item.url));
    this.detail = item;
    if (!same) this.offset = 0;
    this.status = `${page === 'blog' ? 'Post' : 'Project'} focused.`;
    return true;
  }

  blurEntry() {
    this.detail = null;
    this.status = `${this.page === 'blog' ? 'Post' : 'Project'} list focused.`;
  }

  read(item = READING_SECTIONS.includes(this.page) ? this.entry() : this.items()[this.selected]) {
    if (!item) { this.status = 'Choose an entry first. Try projects, then read 1.'; return false; }
    if (!item.body) {
      if (['links', 'contact'].includes(this.page)) {
        const selected = this.options().findIndex(option => option.url === item.url);
        if (selected >= 0) { this.selected = selected; this.offset = 0; this.status = ''; return true; }
      }
      return this.showReferences(item.url);
    }
    const page = item.page || this.page;
    if (READING_SECTIONS.includes(page)) return this.focusEntry(item);
    const filter = page === this.page ? this.filter : '';
    const listOffset = page === this.page ? this.listOffset : 0;
    this.navigate(page, item);
    this.filter = filter; this.listOffset = listOffset;
    this.selected = Math.max(0, this.options().findIndex(option => option.url === item.url));
    return true;
  }

  back() {
    if (READING_SECTIONS.includes(this.page) && this.detail) { this.blurEntry(); return; }
    if (!this.stack.length) { this.status = 'No earlier page.'; return; }
    this.future.push(this.snapshot());
    Object.assign(this, this.stack.pop());
    this.status = 'Back.';
  }

  forward() {
    if (!this.future.length) { this.status = 'No forward page.'; return; }
    this.stack.push(this.snapshot());
    Object.assign(this, this.future.pop());
    this.status = 'Forward.';
  }

  execute(raw) {
    raw = clean(raw).trim().slice(0, 256);
    const [verb = '', ...args] = raw.split(/\s+/);
    const command = ALIASES[verb.toLowerCase()] || verb.toLowerCase();
    const target = args.join(' ');
    if (!raw) return this.read();
    if (SECTIONS.includes(command)) { this.navigate(command); return true; }
    if (command === 'cd') return this.execute(target === '..' ? 'back' : target || 'home');
    if (['quit', 'q'].includes(command)) { this.closed = true; return true; }
    if (command === 'back') { this.back(); return true; }
    if (command === 'forward') { this.forward(); return true; }
    if (command === 'help' || command === '?') { this.navigate('help'); return true; }
    if (command === 'clear') { this.navigate('home'); return true; }
    if (command === 'read') return this.read(target ? this.resolve(target) || null : undefined);
    if (command === 'color' || command === 'motion') {
      if (target && !['on', 'off'].includes(target)) { this.status = `Usage: ${command} [on|off]`; return false; }
      this[command] = target ? target === 'on' : !this[command];
      this.status = `${command === 'color' ? 'Website colors' : 'ASCII animation'} ${this[command] ? 'on' : 'off'}.`;
      return true;
    }
    if (command === 'links') return this.showReferences();
    if (command === 'search' || command === 'filter') {
      if (!['projects', 'art', 'blog'].includes(this.page)) this.navigate('projects');
      else if (this.detail) {
        if (READING_SECTIONS.includes(this.page)) this.blurEntry();
        else this.navigate(this.page);
      }
      this.filter = target; this.selected = 0; this.offset = 0; this.listOffset = 0;
      this.status = target ? `Filtering for "${target}". Type search to reset.` : 'Showing all entries.';
      return true;
    }
    const item = this.resolve(raw);
    if (item?.body) return this.read(item);
    if (item?.url) return this.showReferences(item.url);
    this.status = `Unknown command: ${raw}. Type help for commands.`;
    return false;
  }

  submit() {
    const value = this.input;
    if (value.trim()) {
      this.history.push(value); this.history = this.history.slice(-50);
    }
    this.historyIndex = this.history.length; this.draft = '';
    this.input = ''; this.cursor = 0;
    this.execute(value);
  }

  recall(direction) {
    if (this.historyIndex === this.history.length) this.draft = this.input;
    this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + direction));
    this.input = this.history[this.historyIndex] ?? this.draft;
    this.cursor = this.input.length;
  }

  key(str, key = {}) {
    const name = key.name;
    if (key.sequence === '\x1b[200~') { this.pasting = true; return; }
    if (key.sequence === '\x1b[201~') { this.pasting = false; return; }
    if (key.ctrl && ['c', 'd'].includes(name)) { this.closed = true; return; }
    if (this.pasting && ['return', 'enter'].includes(name)) str = ' ';
    else if (name === 'return' || name === 'enter') { this.submit(); return; }
    if (name === 'escape' || name === 'left') {
      if (READING_SECTIONS.includes(this.page) && this.detail) { this.input = ''; this.cursor = 0; this.blurEntry(); }
      else if (this.input) { this.input = ''; this.cursor = 0; }
      else this.back();
      return;
    }
    if (name === 'right') {
      this.input = ''; this.cursor = 0;
      if (READING_SECTIONS.includes(this.page)) this.focusEntry(); else this.forward();
      return;
    }
    if (key.ctrl && name === 'u') { this.input = ''; this.cursor = 0; return; }
    if (key.ctrl && name === 'a') { this.cursor = 0; return; }
    if (key.ctrl && name === 'e') { this.cursor = this.input.length; return; }
    if (key.ctrl && name === 'b') { this.cursor = Math.max(0, this.cursor - 1); return; }
    if (key.ctrl && name === 'f') { this.cursor = Math.min(this.input.length, this.cursor + 1); return; }
    if (key.ctrl && ['p', 'n'].includes(name)) { this.recall(name === 'p' ? -1 : 1); return; }
    if (['up', 'down', 'pageup', 'pagedown'].includes(name)) {
      if (this.input && ['up', 'down'].includes(name)) { this.recall(name === 'up' ? -1 : 1); return; }
      const direction = ['up', 'pageup'].includes(name) ? -1 : 1;
      const amount = name.startsWith('page') ? 6 : 1;
      const items = this.items();
      if (items.length && !name.startsWith('page')) {
        this.selected = Math.max(0, Math.min(items.length - 1, this.selected + direction));
        this.offset = 0;
      }
      else this.offset = Math.max(0, this.offset + direction * amount);
      return;
    }
    if (name === 'home') { this.cursor = 0; return; }
    if (name === 'end') { this.cursor = this.input.length; return; }
    if (name === 'backspace') {
      if (this.cursor) { this.input = this.input.slice(0, this.cursor - 1) + this.input.slice(this.cursor); this.cursor--; }
      return;
    }
    if (name === 'delete') { this.input = this.input.slice(0, this.cursor) + this.input.slice(this.cursor + 1); return; }
    if (name === 'tab') {
      const candidates = [...COMMANDS, ...this.site.projects.map(item => item.slug), ...this.site.art.map(item => item.slug), ...this.site.blog.map(item => item.slug)];
      const prefix = this.input.split(' ').at(-1);
      const matches = candidates.filter(command => command.startsWith(prefix));
      if (matches.length === 1) { this.input = this.input.slice(0, this.input.length - prefix.length) + matches[0]; this.cursor = this.input.length; }
      else this.status = matches.length ? matches.slice(0, 8).join(' / ') : 'No matching commands or entries.';
      return;
    }
    if (key.ctrl || key.meta) return;
    if (!this.input && !this.pasting && /^[0-9]$/.test(str || '')) {
      const index = Number(str);
      if (index <= 5) this.navigate(SECTIONS[index]);
      else this.showReferences(this.site.socials[index - 6]?.url);
      return;
    }
    if (!this.input && !this.pasting && str === '?') { this.navigate('help'); return; }
    if (str && !str.includes('\x1b')) {
      str = clean(str).replaceAll('\n', ' ').slice(0, 256 - this.input.length);
      this.input = this.input.slice(0, this.cursor) + str + this.input.slice(this.cursor);
      this.cursor += str.length;
    }
  }
}
