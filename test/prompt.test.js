import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom } from './helpers/dom.js';
import { buildPageContext, buildMessages, stripThink } from '../src/shared/prompt.js';

test('page context is just the document title; meta description is SEO noise and ignored', () => {
  const d = domFrom('<head><title>Patch notes</title><meta name="description" content="Fanbyte EverQuest :: the place for everything"></head>');
  assert.deepEqual(buildPageContext(d), { pageTitle: 'Patch notes' });
  assert.deepEqual(buildPageContext(domFrom('<p>no head</p>')), {});
});

test('the page title goes into the system prompt; the user message is only the text', () => {
  const [system, user] = buildMessages({ text: 'Hi there.', context: { pageTitle: 'Patch notes' } });
  assert.match(system.content, /台灣/);
  assert.match(system.content, /Patch notes/);
  assert.equal(user.content, 'Hi there.');
  assert.ok(!buildMessages({ text: 'x', context: {} })[0].content.includes('網頁標題'));
});

test('stripThink removes finished and still-streaming think blocks', () => {
  assert.equal(stripThink('<think>\nhmm\n</think>\n\n你好'), '你好');
  assert.equal(stripThink('<think>still going'), '');
  assert.equal(stripThink('<thi'), '');
  assert.equal(stripThink('直接翻譯'), '直接翻譯');
});
