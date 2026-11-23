import { CreateMLCEngine } from '@mlc-ai/web-llm';
import { resolveVariant } from './variant.js';

const MAX_TOKENS = 2048;

export async function createWebLLMEngine(modelId, onProgress) {
  if (!navigator.gpu) throw new Error('這個瀏覽器沒有 WebGPU');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('找不到可用的 GPU（WebGPU adapter）');
  const runtimeModelId = resolveVariant(modelId, adapter.features.has('shader-f16'));
  const engine = await CreateMLCEngine(runtimeModelId, { initProgressCallback: onProgress });
  let interrupted = false;
  return {
    runtimeModelId,
    async stream(messages, { onText }) {
      interrupted = false;
      const chunks = await engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.3,
        max_tokens: MAX_TOKENS,
        stream_options: { include_usage: true },
        ...(modelId.startsWith('Qwen3') && { extra_body: { enable_thinking: false } }),
      });
      let raw = '';
      let tps = null;
      for await (const chunk of chunks) {
        raw += chunk.choices[0]?.delta?.content ?? '';
        if (chunk.usage) tps = chunk.usage.extra?.decode_tokens_per_s ?? null;
        onText(raw);
      }
      return { tps, interrupted };
    },
    interrupt() {
      interrupted = true;
      engine.interruptGenerate();
    },
    unload() {
      engine.unload();
    },
  };
}
