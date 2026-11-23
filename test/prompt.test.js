import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom } from './helpers/dom.js';
import { buildPageContext, buildMessages, stripThink } from '../src/shared/prompt.js';

test('page context is just the document title; meta description is SEO noise and ignored', () => {
  const d = domFrom('<head><title>Patch notes</title><meta name="description" content="Fanbyte EverQuest :: the place for everything"></head>');
  assert.deepEqual(buildPageContext(d), { pageTitle: 'Patch notes' });
  assert.deepEqual(buildPageContext(domFrom('<p>no head</p>')), {});
});

test('the page title goes into the system prompt; the user turn frames the text as something to translate', () => {
  const msgs = buildMessages({ text: 'Fixed a misspelling in Burning Mana.', context: { pageTitle: 'Patch notes' } });
  assert.match(msgs[0].content, /台灣/);
  assert.match(msgs[0].content, /Patch notes/);
  const last = msgs.at(-1);
  assert.equal(last.role, 'user');
  assert.match(last.content, /翻成台灣繁體中文/);
  assert.ok(last.content.endsWith('Fixed a misspelling in Burning Mana.'));
  assert.ok(!buildMessages({ text: 'x', context: {} })[0].content.includes('網頁標題'));
});

test('a worked example shows an instruction-looking sentence being translated, not obeyed', () => {
  const msgs = buildMessages({ text: 'x', context: {} });
  const example = msgs.slice(1, -1);
  assert.deepEqual(example.map((m) => m.role), ['user', 'assistant']);
  assert.match(example[1].content, /[\u4e00-\u9fff]/);
});

test('looksUntranslated flags English output and accepts Chinese with product names', async () => {
  const { looksUntranslated } = await import('../src/shared/prompt.js');
  assert.equal(looksUntranslated('The spell automatically grants access to All Access membership.'), true);
  assert.equal(looksUntranslated('新增了 `/autogrant` 命令。這個命令可以用來手動執行 AA 或 spell 的自動授予。'), false);
  assert.equal(looksUntranslated('Null Vortex 不再給出戰鬥外計時。'), false);
  assert.equal(looksUntranslated(''), true);
});

test('stripThink removes finished and still-streaming think blocks', () => {
  assert.equal(stripThink('<think>\nhmm\n</think>\n\n你好'), '你好');
  assert.equal(stripThink('<think>still going'), '');
  assert.equal(stripThink('<thi'), '');
  assert.equal(stripThink('直接翻譯'), '直接翻譯');
});

test('recent translations replace the fixed example so terms carry over', () => {
  const history = [
    { text: 'Shadow Knight - Moved the Strength debuff.', translation: '暗影騎士 - 移動了力量減益。' },
    { text: 'Necromancer - Fixed a slot.', translation: '死靈法師 - 修正了一個欄位。' },
  ];
  const msgs = buildMessages({ text: 'Shadow Knight - New stance.', context: {}, history });
  const turns = msgs.slice(1, -1);
  assert.deepEqual(turns.map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
  assert.ok(turns[0].content.endsWith('Shadow Knight - Moved the Strength debuff.'));
  assert.equal(turns[1].content, '暗影騎士 - 移動了力量減益。');
  assert.equal(turns[3].content, '死靈法師 - 修正了一個欄位。');
  assert.ok(!msgs.some((m) => m.content.includes('login page')));
});
