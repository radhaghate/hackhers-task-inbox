/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once
 * — the MVP's "batching": bounded-concurrency per-thread classification
 * calls rather than merging unrelated threads into one prompt (which
 * would blur classification boundaries and isn't needed at this
 * mailbox volume/frequency).
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function runNext(): Promise<void> {
    const current = cursor++;
    if (current >= items.length) return;
    await worker(items[current], current);
    return runNext();
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
}
