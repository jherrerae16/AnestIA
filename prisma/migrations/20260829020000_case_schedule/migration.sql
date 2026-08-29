-- CreateEnum
CREATE TYPE "Especialidad" AS ENUM ('ORL', 'PLASTICA', 'GENERAL', 'BARIATRICA', 'GINECOLOGIA', 'ORTOPEDIA', 'COLUMNA', 'CARDIOVASCULAR', 'UROLOGIA', 'MAXILOFACIAL', 'ENDOSCOPIA', 'OTRA');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('AMBULATORIA', 'HOSPITALIZACION', 'NO_DEFINIDA');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('ELECTIVA', 'URGENTE', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "SitioAriscat" AS ENUM ('PERIFERICO', 'ABDOMINAL_SUPERIOR', 'INTRATORACICO');

-- CreateEnum
CREATE TYPE "DuracionEstimada" AS ENUM ('MENOR_2H', 'ENTRE_2_Y_3H', 'MAYOR_3H', 'NO_DEFINIDA');

-- CreateEnum
CREATE TYPE "AnestesiaProbable" AS ENUM ('GENERAL', 'REGIONAL', 'SEDACION', 'LOCAL', 'COMBINADA', 'POR_DEFINIR');

-- CreateEnum
CREATE TYPE "FuenteAgenda" AS ENUM ('AGENDA', 'ANESTESIOLOGO');

-- CreateTable
CREATE TABLE "CaseSchedule" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "procedimiento" TEXT NOT NULL,
    "diagnosticoPreop" TEXT,
    "fechaHora" TIMESTAMP(3),
    "especialidad" "Especialidad",
    "modalidad" "Modalidad",
    "prioridad" "Prioridad",
    "sitioQuirurgico" "SitioAriscat",
    "duracionEstimada" "DuracionEstimada",
    "altoRiesgoRcri" BOOLEAN,
    "anestesiaProbable" "AnestesiaProbable",
    "opioidesPostop" BOOLEAN,
    "fuente" "FuenteAgenda" NOT NULL DEFAULT 'ANESTESIOLOGO',
    "registradoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseSchedule_caseId_key" ON "CaseSchedule"("caseId");

-- AddForeignKey
ALTER TABLE "CaseSchedule" ADD CONSTRAINT "CaseSchedule_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

