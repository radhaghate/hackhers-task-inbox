import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "@/lib/config/env";
import { parseClassificationResult } from "@/lib/schemas/classification";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { ClassifyThreadInput, ClassifyThreadOutput, LLMProvider } from "./types";

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = getEnv().ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
    client = new Anthropic({ apiKey });
  }
  return client;
}

function extractJson(text: string): unknown {
  // Models sometimes wrap JSON in a code fence despite instructions not to;
  // tolerate that rather than failing the whole thread.
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text);
  const jsonText = fenced ? fenced[1] : text;
  return JSON.parse(jsonText);
}

export class AnthropicLLMProvider implements LLMProvider {
  async classify(input: ClassifyThreadInput): Promise<ClassifyThreadOutput> {
    const env = getEnv();
    const response = await getClient().messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Anthropic response contained no text content");
    }

    let raw: unknown;
    try {
      raw = extractJson(textBlock.text);
    } catch (cause) {
      throw new Error(`Anthropic response was not valid JSON: ${(cause as Error).message}`);
    }

    const parsed = parseClassificationResult(raw);
    if (!parsed.success) {
      throw new Error(`Anthropic response failed schema validation: ${parsed.error}`);
    }

    return {
      result: parsed.data,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
    };
  }
}
