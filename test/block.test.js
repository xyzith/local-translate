import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domFrom } from './helpers/dom.js';
import { findBlock } from '../src/content/block.js';

const doc = domFrom(`
<article>
  <p id="p">Some <a id="link" href="#">linked <b id="bold">bold</b></a> text.</p>
  <ul><li id="li">Item <em id="em">one</em></li></ul>
  <div id="textdiv">Just text in a div with a <span id="span">span</span>.</div>
  <div id="wrapper"><p id="inner">Inner paragraph.</p><p>Another.</p></div>
  <table><tr><td id="td">Cell text</td></tr></table>
  <pre id="pre"><code id="code">x = 1</code></pre>
  <nav id="nav"><a id="navlink" href="#">Home</a></nav>
  <p id="empty">   </p>
</article>`);
const $ = (id) => doc.getElementById(id);

test('climbs from inline elements to the nearest paragraph-like block', () => {
  assert.equal(findBlock($('bold')), $('p'));
  assert.equal(findBlock($('link')), $('p'));
  assert.equal(findBlock($('em')), $('li'));
  assert.equal(findBlock($('td')), $('td'));
});

test('a div that only holds inline content counts as a block; a wrapper of blocks does not', () => {
  assert.equal(findBlock($('span')), $('textdiv'));
  assert.equal(findBlock($('wrapper')), null);
  assert.equal(findBlock($('inner')), $('inner'));
});

test('ignores code, navigation and empty blocks', () => {
  assert.equal(findBlock($('code')), null);
  assert.equal(findBlock($('navlink')), null);
  assert.equal(findBlock($('empty')), null);
});

test('text nodes resolve through their parent', () => {
  assert.equal(findBlock($('p').firstChild), $('p'));
});

test('findBlocksInRange returns every block the selection touches, in page order', async () => {
  const { findBlocksInRange } = await import('../src/content/block.js');
  const d = domFrom(`<div id="root"><h2 id="h">Heading</h2><p id="p1">First <b>para</b>.</p>
    <ul><li id="li">Item</li></ul><pre><code>skip()</code></pre><p id="p2">Second para.</p><p id="p3">Not selected.</p></div>`);
  const range = d.createRange();
  range.setStart(d.querySelector('#p1 b').firstChild, 2);
  range.setEnd(d.getElementById('p2').firstChild, 3);
  assert.deepEqual(findBlocksInRange(range).map((b) => b.id), ['p1', 'li', 'p2']);
});

test('a selection inside one paragraph yields just that paragraph', async () => {
  const { findBlocksInRange } = await import('../src/content/block.js');
  const d = domFrom('<p id="p">Hello there world</p>');
  const range = d.createRange();
  range.setStart(d.getElementById('p').firstChild, 1);
  range.setEnd(d.getElementById('p').firstChild, 5);
  assert.deepEqual(findBlocksInRange(range).map((b) => b.id), ['p']);
});
