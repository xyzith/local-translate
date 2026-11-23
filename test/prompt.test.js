import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom } from './helpers/dom.js';
import { buildPageContext, buildMessages, stripThink, DESCRIPTION_CHARS } from '../src/shared/prompt.js';

test('page context uses the document title and a capped meta description', () => {
  const d = domFrom(`<head><title>Rust 1.90 released</title><meta name="description" content="${'x'.repeat(500)}"></head>`);
  const ctx = buildPageContext(d);
  assert.equal(ctx.pageTitle, 'Rust 1.90 released');
  assert.equal(ctx.description.length, DESCRIPTION_CHARS);
  assert.deepEqual(buildPageContext(domFrom('<p>no head</p>')), {});
});

test('messages fence the page context and end with the text to translate', () => {
  const [system, user] = buildMessages({ text: 'Hi there.', context: { pageTitle: 'T', description: 'D' } });
  assert.equal(system.role, 'system');
  assert.match(system.content, /台灣/);
  assert.match(user.content, /<page>T — D<\/page>/);
  assert.ok(user.content.trimEnd().endsWith('Hi there.'));
  assert.ok(!buildMessages({ text: 'x', context: {} })[1].content.includes('<page>'));
});

test('stripThink removes finished and still-streaming think blocks', () => {
  assert.equal(stripThink('<think>\nhmm\n</think>\n\n你好'), '你好');
  assert.equal(stripThink('<think>still going'), '');
  assert.equal(stripThink('<thi'), '');
  assert.equal(stripThink('直接翻譯'), '直接翻譯');
});
