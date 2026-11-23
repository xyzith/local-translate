import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom } from './helpers/dom.js';
import { findSegments } from '../src/content/extract.js';
import { buildContext, buildMessages, stripThink, PARENT_CHARS } from '../src/shared/prompt.js';

const doc = domFrom(`
<shreddit-post post-title="Is Q4 good enough?">
  <h1 slot="title">Is Q4 good enough?</h1>
  <div slot="text-body"><p>Body text.</p></div>
</shreddit-post>
<shreddit-comment thingid="t1_a" depth="0">
  <div slot="comment"><p>${'Parent says hi. '.repeat(40)}</p></div>
  <shreddit-comment thingid="t1_b" depth="1" parentid="t1_a">
    <div slot="comment"><p>Child reply.</p></div>
  </shreddit-comment>
</shreddit-comment>`);
const seg = (t) => findSegments(doc).find((s) => s.text.startsWith(t));

test('body and comments carry the post title; the title itself does not', () => {
  assert.deepEqual(buildContext(seg('Is Q4')), {});
  assert.deepEqual(buildContext(seg('Body')), { postTitle: 'Is Q4 good enough?' });
  assert.deepEqual(buildContext(seg('Parent says')), { postTitle: 'Is Q4 good enough?' });
});

test('a reply carries the start of the comment it answers', () => {
  const ctx = buildContext(seg('Child'));
  assert.equal(ctx.postTitle, 'Is Q4 good enough?');
  assert.ok(ctx.parentText.startsWith('Parent says hi.'));
  assert.equal(ctx.parentText.length, PARENT_CHARS);
});

test('messages include context, text and Taiwan Traditional Chinese instruction', () => {
  const msgs = buildMessages({ text: 'Child reply.', context: { postTitle: 'T', parentText: 'P' }, modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' });
  assert.equal(msgs[0].role, 'system');
  assert.match(msgs[0].content, /台灣/);
  const user = msgs.at(-1).content;
  for (const s of ['T', 'P', 'Child reply.']) assert.ok(user.includes(s));
  assert.ok(!user.includes('/no_think'));
});


test('stripThink removes finished and still-streaming think blocks', () => {
  assert.equal(stripThink('<think>\nhmm\n</think>\n\n你好'), '你好');
  assert.equal(stripThink('<think>still going'), '');
  assert.equal(stripThink('<thi'), '');
  assert.equal(stripThink('直接翻譯'), '直接翻譯');
});

test('parent context excludes our own translation of the parent', () => {
  const d = domFrom(`<shreddit-post post-title="T"></shreddit-post>
<shreddit-comment thingid="t1_a"><div slot="comment"><p>Parent text.</p><div class="rlt-tr">父留言譯文</div></div>
  <shreddit-comment thingid="t1_b" parentid="t1_a"><div slot="comment"><p>Child.</p></div></shreddit-comment>
</shreddit-comment>`);
  const child = findSegments(d).find((s) => s.text === 'Child.');
  assert.equal(buildContext(child).parentText, 'Parent text.');
});

test('context is fenced in tags and the paragraph to translate comes last', () => {
  const [, user] = buildMessages({ text: 'Child.', context: { postTitle: 'T', parentText: 'P' }, modelId: 'Qwen3-1.7B-q4f16_1-MLC' });
  assert.match(user.content, /<title>T<\/title>/);
  assert.match(user.content, /<parent>P<\/parent>/);
  assert.ok(user.content.trimEnd().endsWith('Child.'));
  assert.ok(!user.content.includes('/no_think'));
});
