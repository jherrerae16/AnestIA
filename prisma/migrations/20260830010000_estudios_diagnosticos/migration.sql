-- Informes diagnósticos que no son de laboratorio (Especificación §16).
CREATE TYPE "TipoEstudio" AS ENUM ('ECG', 'ECOCARDIOGRAMA', 'RADIOGRAFIA_TORAX', 'ESPIROMETRIA', 'OTRO');

CREATE TABLE "ExtractedStudy" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "attachmentId" TEXT,
    "page" INTEGER,
    "tipo" "TipoEstudio" NOT NULL,
    "tipoRaw" TEXT,
    "ritmo" TEXT,
    "frecuencia" TEXT,
    "intervalos" TEXT,
    "conclusion" TEXT,
    "hallazgos" TEXT,
    "institucion" TEXT,
    "collectedAt" TIMESTAMP(3),
    "reportDate" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "estadoExtraccion" "EstadoExtraccion" NOT NULL DEFAULT 'AUTOMATICO',
    "identityMatch" "IdentityMatch" NOT NULL DEFAULT 'NO_VERIFICABLE',
    "sourceRef" TEXT NOT NULL,
    "extractionMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedStudy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExtractedStudy_caseId_idx" ON "ExtractedStudy"("caseId");

ALTER TABLE "ExtractedStudy" ADD CONSTRAINT "ExtractedStudy_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExtractedStudy" ADD CONSTRAINT "ExtractedStudy_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
