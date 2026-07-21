-- AlterTable
ALTER TABLE "ExtractedLabResult" ADD COLUMN     "manualAt" TIMESTAMP(3),
ADD COLUMN     "manualBy" TEXT,
ADD COLUMN     "manualFlag" "LabFlag",
ADD COLUMN     "manualSource" TEXT;
