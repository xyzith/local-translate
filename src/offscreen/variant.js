export function resolveVariant(modelId, hasShaderF16) {
  return hasShaderF16 ? modelId : modelId.replace('-q4f16_1-', '-q4f32_1-');
}
