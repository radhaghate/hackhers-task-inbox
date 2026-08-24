import type { ClassificationResult } from "@/lib/schemas/classification";

export type ClassifyThreadInput = {
  accountLabel: string;
  subject: string;
  /** Compact rolling summary of everything classified on this thread before now — never full history. */
  storedSummary: string | null;
  /** Only the genuinely new, sanitized messages since the last classification. */
  newMessages: { fromAddress: string; sentAt: string; isFromOrgAccount: boolean; sanitizedBodyText: string }[];
};

export type ClassifyThreadUsage = {
  promptTokens: number;
  completionTokens: number;
};

export type ClassifyThreadOutput = {
  result: ClassificationResult;
  usage: ClassifyThreadUsage;
};

/**
 * Swappable model-provider boundary. Concrete implementations must return
 * output that already validates against classificationResultSchema — the
 * scan orchestrator re-validates regardless, so a provider bug degrades to
 * "skip this thread," never a crash.
 */
export interface LLMProvider {
  classify(input: ClassifyThreadInput): Promise<ClassifyThreadOutput>;
}
