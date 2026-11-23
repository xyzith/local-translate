import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom } from './helpers/dom.js';
import { attachTranslation, removeTranslation } from '../src/content/render.js';

test('the translation goes inside the block, so flex rows keep their layout', () => {
  const doc = domFrom('<div style="display:flex"><p>One <a href="/x">link</a>.</p></div>');
  const p = doc.querySelector('p');
  attachTranslation(p).update('一個連結。');
  assert.equal(p.lastElementChild.textContent, '一個連結。');
  assert.equal(p.lastElementChild.getAttribute('lang'), 'zh-Hant');
  assert.equal(p.parentElement.children.length, 1);
  assert.equal(p.dataset.rlt, '1');
});

test('attaching twice keeps a single translation', () => {
  const doc = domFrom('<p>Text</p>');
  const p = doc.querySelector('p');
  attachTranslation(p).update('a');
  attachTranslation(p).update('b');
  assert.equal(doc.querySelectorAll('.rlt-tr').length, 1);
  assert.equal(doc.querySelector('.rlt-tr').textContent, 'b');
});

test('a list item with a nested list gets its translation before the sub-list', () => {
  const doc = domFrom('<ul><li>parent item<ul><li>child</li></ul></li></ul>');
  const li = doc.querySelector('li');
  attachTranslation(li).update('父項目');
  assert.equal(li.querySelector(':scope > ul').previousElementSibling.textContent, '父項目');
});

test('pending, truncated and failed states are visible', () => {
  const doc = domFrom('<p>Text</p>');
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

test('remove() and removeTranslation() restore the original markup', () => {
  const doc = domFrom('<p id="a">A <b>b</b></p><p id="b">B</p><p id="c">C</p>');
  const before = doc.body.innerHTML;
  const [a, b, c] = ['a', 'b', 'c'].map((id) => doc.getElementById(id));
  attachTranslation(a).remove();
  attachTranslation(b).update('乙');
  attachTranslation(c).update('丙');
  assert.equal(removeTranslation(b), true);
  assert.equal(removeTranslation(c.querySelector('.rlt-tr')), true);
  assert.equal(removeTranslation(a), false);
  assert.equal(doc.body.innerHTML, before);
});
