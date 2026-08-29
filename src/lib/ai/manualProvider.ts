import type { ClassifyThreadInput, ClassifyThreadOutput, LLMProvider } from "./types";

/**
 * Placeholder provider for LLM_PROVIDER=manual. The scan orchestrator never
 * calls classify() in manual mode — it short-circuits after material-change
 * detection and writes candidate threads to a batch file instead (see
 * src/lib/scan/manualBatch.ts) for a human to classify through a Claude Code
 * session, then apply back via scripts/apply-classifications.ts. This class
 * exists only so getLLMProvider() stays total; classify() throws if some
 * other code path ever calls it, rather than silently doing nothing.
 */
export class ManualLLMProvider implements LLMProvider {
  async classify(input: ClassifyThreadInput): Promise<ClassifyThreadOutput> {
    void input;
    throw new Error(
      "ManualLLMProvider.classify() should never be called directly — LLM_PROVIDER=manual routes through the batch export/apply flow instead.",
    );
  }
}
