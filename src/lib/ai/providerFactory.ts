import { getEnv } from "@/lib/config/env";
import { AnthropicLLMProvider } from "./anthropicProvider";
import { ManualLLMProvider } from "./manualProvider";
import { MockLLMProvider } from "./mockProvider";
import type { LLMProvider } from "./types";

let cached: LLMProvider | undefined;

export function getLLMProvider(): LLMProvider {
  if (cached) return cached;
  switch (getEnv().LLM_PROVIDER) {
    case "anthropic":
      cached = new AnthropicLLMProvider();
      break;
    case "manual":
      cached = new ManualLLMProvider();
      break;
    default:
      cached = new MockLLMProvider();
  }
  return cached;
}
