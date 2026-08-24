// Approximate list pricing (USD per 1M tokens) for cost *visibility* in
// ScanRun logs — not billing-accurate, and intentionally conservative
// (unknown models return null rather than guessing).
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-opus-4-5": { input: 15, output: 75 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number | null {
  const pricing = PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return null;
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
}

export type UsageAccumulator = {
  modelCallsCount: number;
  promptTokens: number;
  completionTokens: number;
};

export function newUsageAccumulator(): UsageAccumulator {
  return { modelCallsCount: 0, promptTokens: 0, completionTokens: 0 };
}

export function addUsage(acc: UsageAccumulator, usage: { promptTokens: number; completionTokens: number }): void {
  acc.modelCallsCount += 1;
  acc.promptTokens += usage.promptTokens;
  acc.completionTokens += usage.completionTokens;
}
