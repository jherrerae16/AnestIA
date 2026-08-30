-- CreateEnum
CREATE TYPE "EstadoExtraccion" AS ENUM ('AUTOMATICO', 'PENDIENTE_CONFIRMACION', 'CONFIRMADO');

-- CreateEnum
CREATE TYPE "IdentityMatch" AS ENUM ('COINCIDE', 'NO_COINCIDE', 'NO_VERIFICABLE');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "filename" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "sizeBytes" INTEGER;

-- AlterTable
ALTER TABLE "ExtractedLabResult" ADD COLUMN     "analyteRaw" TEXT,
ADD COLUMN     "attachmentId" TEXT,
ADD COLUMN     "collectedAt" TIMESTAMP(3),
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "conversionRule" TEXT,
ADD COLUMN     "estadoExtraccion" "EstadoExtraccion" NOT NULL DEFAULT 'AUTOMATICO',
ADD COLUMN     "identityMatch" "IdentityMatch" NOT NULL DEFAULT 'NO_VERIFICABLE',
ADD COLUMN     "institucion" TEXT,
ADD COLUMN     "page" INTEGER,
ADD COLUMN     "unitRaw" TEXT,
ADD COLUMN     "valueRaw" TEXT;

-- AddForeignKey
ALTER TABLE "ExtractedLabResult" ADD CONSTRAINT "ExtractedLabResult_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

