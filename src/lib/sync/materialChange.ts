export type ThreadChangeInfo = {
  emailThreadId: string;
  messageCount: number;
  lastClassifiedMessageCount: number;
};

/**
 * A thread is a classification candidate only if it has genuinely new
 * messages since it was last classified — never for label/read-state-only
 * changes, so we don't burn a model call on those.
 */
export function computeCandidateThreadIds(threads: ThreadChangeInfo[]): string[] {
  return threads.filter((t) => t.messageCount > t.lastClassifiedMessageCount).map((t) => t.emailThreadId);
}
