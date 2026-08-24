import { getEnv } from "@/lib/config/env";
import { AnthropicLLMProvider } from "./anthropicProvider";
import { MockLLMProvider } from "./mockProvider";
import type { LLMProvider } from "./types";

let cached: LLMProvider | undefined;

export function getLLMProvider(): LLMProvider {
  if (cached) return cached;
  cached = getEnv().LLM_PROVIDER === "anthropic" ? new AnthropicLLMProvider() : new MockLLMProvider();
  return cached;
}
