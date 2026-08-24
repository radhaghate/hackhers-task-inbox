import type { AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type WriteAuditEventInput = {
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  /** null = system/cron actor (no logged-in team member initiated this). */
  actorTeamMemberId?: string | null;
  /**
   * Structural facts only (ids, old/new enum values, counts). NEVER pass
   * email bodies, OAuth tokens, or any other secret here — this table is
   * the audit trail and is expected to be readable by any team member.
   */
  metadata?: Record<string, unknown>;
};

/**
 * Appends one immutable audit trail row. Call this from every mutation
 * (scans, classifications, field edits, dismissals, draft creation,
 * reminders) so the dashboard can show a full history of who changed what.
 */
export async function writeAuditEvent(
  input: WriteAuditEventInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await client.auditEvent.create({
    data: {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      actorTeamMemberId: input.actorTeamMemberId ?? null,
      metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
