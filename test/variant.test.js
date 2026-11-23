import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariant } from '../src/offscreen/variant.js';

test('keeps f16 models when the GPU supports shader-f16', () => {
  assert.equal(resolveVariant('Qwen3-1.7B-q4f16_1-MLC', true), 'Qwen3-1.7B-q4f16_1-MLC');
});

test('falls back to the q4f32 build without shader-f16', () => {
  assert.equal(resolveVariant('Qwen2.5-1.5B-Instruct-q4f16_1-MLC', false), 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC');
});
