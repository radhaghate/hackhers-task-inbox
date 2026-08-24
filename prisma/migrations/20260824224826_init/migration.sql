-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'WAITING_FOR_REPLY', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DueDateSource" AS ENUM ('EXPLICIT', 'INFERRED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'NOTIFIED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('IN_APP', 'EMAIL', 'CALENDAR');

-- CreateEnum
CREATE TYPE "ScanTriggerSource" AS ENUM ('CRON', 'MANUAL_UI', 'CLI');

-- CreateEnum
CREATE TYPE "ScanMode" AS ENUM ('LIVE', 'DRY_RUN');

-- CreateEnum
CREATE TYPE "ScanRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('SCAN_STARTED', 'SCAN_COMPLETED', 'SCAN_FAILED', 'TASK_CLASSIFIED', 'TASK_FIELD_EDITED', 'TASK_STATUS_CHANGED', 'TASK_DISMISSED', 'TASK_RESTORED', 'TASK_COMPLETED', 'REPLY_EDITED', 'DRAFT_CREATED', 'DRAFT_CREATION_FAILED', 'REMINDER_SCHEDULED', 'REMINDER_DISMISSED', 'OAUTH_CONNECTED', 'OAUTH_TOKEN_REFRESHED', 'LOGIN_SUCCEEDED');

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_accounts" (
    "id" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "lastHistoryId" TEXT,
    "lastSuccessfulScanAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedByTeamMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "gmailAccountId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "storedSummary" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastClassifiedAt" TIMESTAMP(3),
    "lastClassifiedMessageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "emailThreadId" TEXT NOT NULL,
    "gmailAccountId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "sanitizedBodyText" TEXT NOT NULL,
    "rawSizeBytes" INTEGER NOT NULL,
    "isFromOrgAccount" BOOLEAN NOT NULL DEFAULT false,
    "historyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "emailThreadId" TEXT NOT NULL,
    "sourceEmailMessageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "emailSummary" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "dueDateSource" "DueDateSource",
    "dueDateExplanation" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "assignedOwnerId" TEXT,
    "suggestedOwnerRole" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "privateNotes" TEXT,
    "originalExcerpt" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggested_replies" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "aiGeneratedOriginalSubject" TEXT NOT NULL,
    "aiGeneratedOriginalBody" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedByTeamMemberId" TEXT,
    "gmailDraftId" TEXT,
    "draftCreatedAt" TIMESTAMP(3),
    "draftApprovedByTeamMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggested_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "ReminderChannel" NOT NULL DEFAULT 'IN_APP',
    "createdByTeamMemberId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_runs" (
    "id" TEXT NOT NULL,
    "trigger" "ScanTriggerSource" NOT NULL,
    "mode" "ScanMode" NOT NULL,
    "status" "ScanRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "gmailAccountsScanned" TEXT[],
    "threadsSeen" INTEGER NOT NULL DEFAULT 0,
    "messagesSeen" INTEGER NOT NULL DEFAULT 0,
    "newMessages" INTEGER NOT NULL DEFAULT 0,
    "threadsClassified" INTEGER NOT NULL DEFAULT 0,
    "tasksCreated" INTEGER NOT NULL DEFAULT 0,
    "tasksUpdated" INTEGER NOT NULL DEFAULT 0,
    "modelCallsCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorTeamMemberId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_members_email_key" ON "team_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_accounts_emailAddress_key" ON "gmail_accounts"("emailAddress");

-- CreateIndex
CREATE INDEX "email_threads_gmailAccountId_lastMessageAt_idx" ON "email_threads"("gmailAccountId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_gmailAccountId_gmailThreadId_key" ON "email_threads"("gmailAccountId", "gmailThreadId");

-- CreateIndex
CREATE INDEX "email_messages_emailThreadId_sentAt_idx" ON "email_messages"("emailThreadId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_gmailAccountId_gmailMessageId_key" ON "email_messages"("gmailAccountId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "tasks_status_priority_dueDate_idx" ON "tasks"("status", "priority", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_emailThreadId_title_idx" ON "tasks"("emailThreadId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "suggested_replies_taskId_key" ON "suggested_replies"("taskId");

-- CreateIndex
CREATE INDEX "reminders_status_remindAt_idx" ON "reminders"("status", "remindAt");

-- CreateIndex
CREATE INDEX "scan_runs_startedAt_idx" ON "scan_runs"("startedAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "gmail_accounts" ADD CONSTRAINT "gmail_accounts_connectedByTeamMemberId_fkey" FOREIGN KEY ("connectedByTeamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_gmailAccountId_fkey" FOREIGN KEY ("gmailAccountId") REFERENCES "gmail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceEmailMessageId_fkey" FOREIGN KEY ("sourceEmailMessageId") REFERENCES "email_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedOwnerId_fkey" FOREIGN KEY ("assignedOwnerId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_replies" ADD CONSTRAINT "suggested_replies_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_replies" ADD CONSTRAINT "suggested_replies_editedByTeamMemberId_fkey" FOREIGN KEY ("editedByTeamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_replies" ADD CONSTRAINT "suggested_replies_draftApprovedByTeamMemberId_fkey" FOREIGN KEY ("draftApprovedByTeamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_createdByTeamMemberId_fkey" FOREIGN KEY ("createdByTeamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorTeamMemberId_fkey" FOREIGN KEY ("actorTeamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
