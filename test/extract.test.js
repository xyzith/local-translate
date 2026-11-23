import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom, realFixtures } from './helpers/dom.js';
import { findSegments, MAX_CHARS } from '../src/content/extract.js';

const THREAD = `
<shreddit-post>
  <h1 slot="title">Why is my model slow?</h1>
  <div slot="text-body"><p>First paragraph.</p><p>https://example.com/x</p>
    <pre><code>const x = 1;</code></pre><ul><li>bare item</li><li><p>para item</p></li></ul></div>
</shreddit-post>
<shreddit-comment thingid="t1_a" depth="0">
  <div slot="comment"><p>Top level reply.</p><p>這已經是中文了。</p><p>   </p></div>
  <shreddit-comment thingid="t1_b" depth="1" parentid="t1_a">
    <div slot="comment"><p>Nested <code>inline</code> reply.</p></div>
  </shreddit-comment>
</shreddit-comment>`;

const texts = (segs) => segs.map((s) => s.text);

test('finds title, body paragraphs and comments in document order', () => {
  const segs = findSegments(domFrom(THREAD));
  assert.deepEqual(texts(segs), [
    'Why is my model slow?', 'First paragraph.', 'bare item', 'para item',
    'Top level reply.', 'Nested inline reply.',
  ]);
  assert.deepEqual(segs.map((s) => s.kind), ['title', 'body', 'body', 'body', 'comment', 'comment']);
});

test('skips elements already marked as processed', () => {
  const doc = domFrom(THREAD);
  doc.querySelector('[slot="comment"] p').dataset.rlt = '1';
  assert.ok(!texts(findSegments(doc)).includes('Top level reply.'));
});

test('truncates very long paragraphs', () => {
  const long = 'word '.repeat(1000);
  const [seg] = findSegments(domFrom(`<shreddit-comment><div slot="comment"><p>${long}</p></div></shreddit-comment>`));
  assert.equal(seg.text.length, MAX_CHARS);
  assert.equal(seg.truncated, true);
});

test('listing titles inside links are found', () => {
  const doc = domFrom('<shreddit-post><a slot="title" href="/x">A feed title</a></shreddit-post>');
  assert.deepEqual(texts(findSegments(doc)), ['A feed title']);
});

for (const fx of realFixtures()) {
  test(`real fixture ${fx.name}: finds segments, none from code blocks`, () => {
    const segs = findSegments(fx.load());
    assert.ok(segs.length > 5, `only ${segs.length} segments`);
    assert.ok(segs.every((s) => !s.el.closest('pre code, code')));
    assert.equal(new Set(segs.map((s) => s.el)).size, segs.length);
  });
}
