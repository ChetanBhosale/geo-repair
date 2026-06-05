-- CreateEnum
CREATE TYPE "FixRunState" AS ENUM ('QUEUED', 'SCANNING', 'CLONING', 'FIXING', 'VERIFYING', 'PUSHING', 'PR_OPENED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SandboxStatus" AS ENUM ('NONE', 'CREATING', 'RUNNING', 'KILLED');

-- CreateEnum
CREATE TYPE "FixCheckStatus" AS ENUM ('PENDING', 'FIXING', 'FIXED', 'SKIPPED', 'FLAGGED', 'FAILED');

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "githubRepoId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "htmlUrl" TEXT NOT NULL,
    "cloneUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fix_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "temporalWorkflowId" TEXT NOT NULL,
    "temporalRunId" TEXT,
    "sandboxId" TEXT,
    "sandboxStatus" "SandboxStatus" NOT NULL DEFAULT 'NONE',
    "state" "FixRunState" NOT NULL DEFAULT 'QUEUED',
    "branch" TEXT,
    "prUrl" TEXT,
    "prNumber" INTEGER,
    "totalChecks" INTEGER NOT NULL DEFAULT 0,
    "fixedChecks" INTEGER NOT NULL DEFAULT 0,
    "pendingChecks" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "sandboxSeconds" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fix_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fix_checks" (
    "id" TEXT NOT NULL,
    "fixRunId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "FixCheckStatus" NOT NULL DEFAULT 'PENDING',
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fix_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_events" (
    "id" TEXT NOT NULL,
    "fixRunId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "phase" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repositories_userId_idx" ON "repositories"("userId");

-- CreateIndex
CREATE INDEX "repositories_accountId_idx" ON "repositories"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_userId_githubRepoId_key" ON "repositories"("userId", "githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "fix_runs_temporalWorkflowId_key" ON "fix_runs"("temporalWorkflowId");

-- CreateIndex
CREATE INDEX "fix_runs_userId_idx" ON "fix_runs"("userId");

-- CreateIndex
CREATE INDEX "fix_runs_repositoryId_idx" ON "fix_runs"("repositoryId");

-- CreateIndex
CREATE INDEX "fix_runs_state_idx" ON "fix_runs"("state");

-- CreateIndex
CREATE INDEX "fix_checks_fixRunId_idx" ON "fix_checks"("fixRunId");

-- CreateIndex
CREATE UNIQUE INDEX "fix_checks_fixRunId_rubricId_key" ON "fix_checks"("fixRunId", "rubricId");

-- CreateIndex
CREATE INDEX "run_events_fixRunId_idx" ON "run_events"("fixRunId");

-- CreateIndex
CREATE UNIQUE INDEX "run_events_fixRunId_seq_key" ON "run_events"("fixRunId", "seq");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fix_runs" ADD CONSTRAINT "fix_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fix_runs" ADD CONSTRAINT "fix_runs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fix_checks" ADD CONSTRAINT "fix_checks_fixRunId_fkey" FOREIGN KEY ("fixRunId") REFERENCES "fix_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_fixRunId_fkey" FOREIGN KEY ("fixRunId") REFERENCES "fix_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
