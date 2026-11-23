import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom } from './helpers/dom.js';
import { attachTranslation, detachAll } from '../src/content/render.js';

const HTML = `<shreddit-post><h1 slot="title">Title</h1></shreddit-post>
<div slot="comment"><p>One <a href="/x">link</a>.</p><ul><li>item</li></ul></div>`;

test('paragraph gets a sibling translation; slotted title and li get it inside', () => {
  const doc = domFrom(HTML);
  const p = doc.querySelector('p'), h1 = doc.querySelector('h1'), li = doc.querySelector('li');
  attachTranslation(p).update('一個連結。');
  attachTranslation(h1).update('標題');
  attachTranslation(li).update('項目');
  assert.ok(p.nextElementSibling.classList.contains('rlt-tr'));
  assert.equal(p.nextElementSibling.textContent, '一個連結。');
  assert.equal(p.nextElementSibling.getAttribute('lang'), 'zh-Hant');
  assert.equal(h1.lastElementChild.textContent, '標題');
  assert.equal(li.lastElementChild.textContent, '項目');
  assert.equal(p.dataset.rlt, '1');
});

test('attaching twice, or after reddit swaps the node, keeps a single translation', () => {
  const doc = domFrom(HTML);
  const p = doc.querySelector('p');
  attachTranslation(p).update('a');
  attachTranslation(p).update('b');
  const fresh = p.cloneNode(true);
  delete fresh.dataset.rlt;
  p.replaceWith(fresh);
  attachTranslation(fresh).update('c');
  assert.equal(doc.querySelectorAll('.rlt-tr').length, 1);
  assert.equal(doc.querySelector('.rlt-tr').textContent, 'c');
});

test('pending, truncated and failed states are visible', () => {
  const doc = domFrom(HTML);
  const h = attachTranslation(doc.querySelector('p'));
  const node = doc.querySelector('.rlt-tr');
  assert.ok(node.classList.contains('rlt-pending'));
  h.update('部分');
  h.done({ truncated: true });
  assert.ok(!node.classList.contains('rlt-pending'));
  assert.equal(node.textContent, '部分（後略）');
  h.fail('WebGPU 不可用');
  assert.ok(node.classList.contains('rlt-error'));
  assert.match(node.textContent, /WebGPU 不可用/);
});

test('detachAll restores the original markup', () => {
  const doc = domFrom(HTML);
  const before = doc.body.innerHTML;
  for (const el of doc.querySelectorAll('p, h1, li')) attachTranslation(el).update('x');
  detachAll(doc);
  assert.equal(doc.body.innerHTML, before);
});

test('remove() clears a cancelled translation so the paragraph can be picked up again', () => {
  const doc = domFrom(HTML);
  const p = doc.querySelector('p');
  attachTranslation(p).remove();
  assert.equal(doc.querySelectorAll('.rlt-tr').length, 0);
  assert.equal(p.dataset.rlt, undefined);
});

test('a list item with a nested list gets its translation before the sub-list', () => {
  const doc = domFrom('<div slot="comment"><ul><li>parent item<ul><li>child</li></ul></li></ul></div>');
  const li = doc.querySelector('li');
  attachTranslation(li).update('父項目');
  assert.equal(li.querySelector(':scope > ul').previousElementSibling.textContent, '父項目');
  attachTranslation(li).update('再一次');
  assert.equal(li.querySelectorAll(':scope > .rlt-tr').length, 1);
});
