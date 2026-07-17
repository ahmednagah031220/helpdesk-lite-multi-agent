-- Phase 1: multi-tenant orgs, optional SSO passwords, pgvector embeddings, job ids

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- Default org for existing rows
INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('org_default_acme', 'Acme Corp', 'acme', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- User: org, nullable password, auth provider; replace global email unique
ALTER TABLE "User" ADD COLUMN "orgId" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'credentials';
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

UPDATE "User" SET "orgId" = 'org_default_acme' WHERE "orgId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "orgId" SET NOT NULL;

DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_orgId_email_key" ON "User"("orgId", "email");
CREATE INDEX "User_orgId_idx" ON "User"("orgId");
CREATE INDEX "User_email_idx" ON "User"("email");

ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ticket org
ALTER TABLE "Ticket" ADD COLUMN "orgId" TEXT;
UPDATE "Ticket" SET "orgId" = 'org_default_acme' WHERE "orgId" IS NULL;
ALTER TABLE "Ticket" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Ticket_orgId_idx" ON "Ticket"("orgId");
CREATE INDEX "Ticket_orgId_status_idx" ON "Ticket"("orgId", "status");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Knowledge org + vector embeddings
ALTER TABLE "KnowledgeDocument" ADD COLUMN "orgId" TEXT;
UPDATE "KnowledgeDocument" SET "orgId" = 'org_default_acme' WHERE "orgId" IS NULL;
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "KnowledgeDocument_orgId_idx" ON "KnowledgeDocument"("orgId");
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChunk" ADD COLUMN "embedding" vector(384);
CREATE INDEX "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);

-- Agent run job id for BullMQ
ALTER TABLE "AgentRun" ADD COLUMN "jobId" TEXT;
CREATE INDEX "AgentRun_jobId_idx" ON "AgentRun"("jobId");

-- Notification org
ALTER TABLE "NotificationLog" ADD COLUMN "orgId" TEXT;
CREATE INDEX "NotificationLog_orgId_idx" ON "NotificationLog"("orgId");
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
