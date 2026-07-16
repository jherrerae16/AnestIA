-- AlterTable
ALTER TABLE "GeneratedAssessment" ADD COLUMN     "auditReport" JSONB,
ADD COLUMN     "auditedAt" TIMESTAMP(3);
