-- CreateTable
CREATE TABLE "TokenUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "provider" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "rejectedCalls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmCallLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "dailyBudget" INTEGER NOT NULL,
    "softCapMult" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenUsage_day_provider_idx" ON "TokenUsage"("day", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "TokenUsage_userId_day_provider_key" ON "TokenUsage"("userId", "day", "provider");

-- CreateIndex
CREATE INDEX "LlmCallLog_userId_createdAt_idx" ON "LlmCallLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmCallLog_route_createdAt_idx" ON "LlmCallLog"("route", "createdAt");

-- CreateIndex
CREATE INDEX "LlmCallLog_status_createdAt_idx" ON "LlmCallLog"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaConfig_provider_key" ON "QuotaConfig"("provider");

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmCallLog" ADD CONSTRAINT "LlmCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
