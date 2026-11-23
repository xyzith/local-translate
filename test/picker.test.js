import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom } from './helpers/dom.js';
import { createPicker } from '../src/content/picker.js';

function setup() {
  const doc = domFrom('<p id="a">First <b id="b">para</b>.</p><p id="c">Second.</p><pre><code id="code">x</code></pre>');
  const queued = [];
  const cancelled = [];
  const picker = createPicker({ doc, translate: (el) => queued.push(el), cancel: (el) => cancelled.push(el) });
  const rightClick = (id) => doc.getElementById(id).dispatchEvent(new doc.defaultView.MouseEvent('contextmenu', { bubbles: true }));
  return { doc, queued, cancelled, picker, rightClick };
}

test('menu command translates the block that was right-clicked', () => {
  const { doc, queued, picker, rightClick } = setup();
  rightClick('b');
  assert.equal(picker.command(), 'translate');
  assert.deepEqual(queued, [doc.getElementById('a')]);
});

test('the same command on an already translated block removes the translation and cancels its job', () => {
  const { doc, queued, cancelled, picker, rightClick } = setup();
  const a = doc.getElementById('a');
  rightClick('b');
  picker.command();
  a.dataset.rlt = '1';
  a.insertAdjacentHTML('beforeend', '<span class="rlt-tr">譯文</span>');
  rightClick('b');
  assert.equal(picker.command(), 'removed');
  assert.equal(a.querySelector('.rlt-tr'), null);
  assert.equal(queued.length, 1);
  assert.deepEqual(cancelled, [a]);
});

test('right-clicking on code or with no prior right-click does nothing', () => {
  const { queued, picker, rightClick } = setup();
  assert.equal(picker.command(), 'none');
  rightClick('code');
  assert.equal(picker.command(), 'none');
  assert.equal(queued.length, 0);
});

function selectFromTo(doc, startId, endId) {
  const range = doc.createRange();
  range.setStart(doc.getElementById(startId).firstChild, 0);
  range.setEnd(doc.getElementById(endId).firstChild, 1);
  const sel = doc.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

test('with a selection, every block in it is translated', () => {
  const { doc, queued, picker, rightClick } = setup();
  selectFromTo(doc, 'a', 'c');
  rightClick('c');
  assert.equal(picker.command(), 'translate');
  assert.deepEqual(queued.map((el) => el.id), ['a', 'c']);
});

test('with a selection, already translated blocks are skipped; all translated means remove all', () => {
  const { doc, queued, cancelled, picker, rightClick } = setup();
  const a = doc.getElementById('a');
  a.dataset.rlt = '1';
  a.insertAdjacentHTML('beforeend', '<span class="rlt-tr">譯文</span>');
  selectFromTo(doc, 'a', 'c');
  rightClick('c');
  picker.command();
  assert.deepEqual(queued.map((el) => el.id), ['c']);
  doc.getElementById('c').dataset.rlt = '1';
  rightClick('c');
  assert.equal(picker.command(), 'removed');
  assert.deepEqual(cancelled.map((el) => el.id), ['a', 'c']);
  assert.equal(doc.querySelectorAll('[data-rlt]').length, 0);
});
