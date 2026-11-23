import { CreateMLCEngine } from '@mlc-ai/web-llm';

const MAX_TOKENS = 2048;

export async function createWebLLMEngine(modelId, onProgress) {
  if (!navigator.gpu) throw new Error('這個瀏覽器沒有 WebGPU');
  if (!(await navigator.gpu.requestAdapter())) throw new Error('找不到可用的 GPU（WebGPU adapter）');
  const engine = await CreateMLCEngine(modelId, { initProgressCallback: onProgress });
  let interrupted = false;
  return {
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
