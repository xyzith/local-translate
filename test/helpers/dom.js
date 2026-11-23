import { JSDOM } from 'jsdom';

export function domFrom(html) {
  return new JSDOM(html).window.document;
}
