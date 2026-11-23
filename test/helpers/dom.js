import { JSDOM } from 'jsdom';
import fs from 'node:fs';

export function domFrom(html) {
  return new JSDOM(html).window.document;
}

export function realFixtures() {
  const dir = new URL('../../fixtures/real/', import.meta.url);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => ({
    name: f,
    load: () => new JSDOM(fs.readFileSync(new URL(f, dir), 'utf8')).window.document,
  }));
}
