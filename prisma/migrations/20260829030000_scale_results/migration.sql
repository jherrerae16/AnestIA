-- CreateEnum
CREATE TYPE "ScaleKey" AS ENUM ('DASI', 'STOP_BANG', 'APFEL', 'FRAIL', 'CAPRINI', 'RCRI', 'ARISCAT', 'POVOC');

-- CreateEnum
CREATE TYPE "EstadoEscala" AS ENUM ('NO_INDICADA', 'PENDIENTE', 'CALCULADA', 'REVISION_CLINICA');

-- CreateTable
CREATE TABLE "ScaleResult" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "escala" "ScaleKey" NOT NULL,
    "version" TEXT NOT NULL,
    "cortesVersion" TEXT,
    "estado" "EstadoEscala" NOT NULL,
    "puntaje" DOUBLE PRECISION,
    "categoria" TEXT,
    "variables" JSONB NOT NULL,
    "faltantes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "motivo" TEXT,
    "resueltoPor" TEXT,
    "resueltoAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScaleResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScaleResult_caseId_escala_key" ON "ScaleResult"("caseId", "escala");

-- AddForeignKey
ALTER TABLE "ScaleResult" ADD CONSTRAINT "ScaleResult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

