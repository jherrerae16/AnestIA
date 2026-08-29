-- CreateEnum
CREATE TYPE "Obligacion" AS ENUM ('OBLIGATORIA', 'CONDICIONAL', 'SISTEMA', 'VERIFICA');

-- CreateEnum
CREATE TYPE "SexoNacimiento" AS ENUM ('MUJER', 'HOMBRE', 'INTERSEXUAL', 'NO_SABE', 'PREFIERE_NO_RESPONDER');

-- CreateEnum
CREATE TYPE "RutaClinica" AS ENUM ('PEDIATRICA', 'ADULTO', 'ADULTO_MAYOR', 'OBSTETRICA_GINECOLOGICA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionType" ADD VALUE 'SI_NO_NOSABE';
ALTER TYPE "QuestionType" ADD VALUE 'ACORDEON_MULTIPLE';
ALTER TYPE "QuestionType" ADD VALUE 'REPETIDOR';
ALTER TYPE "QuestionType" ADD VALUE 'FECHA_HORA';
ALTER TYPE "QuestionType" ADD VALUE 'TELEFONO';
ALTER TYPE "QuestionType" ADD VALUE 'CORREO';
ALTER TYPE "QuestionType" ADD VALUE 'DOCUMENTO_ID';

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "requiereAcudiente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ruta" "RutaClinica";

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "sex",
ADD COLUMN     "sexAtBirth" "SexoNacimiento";

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "alimenta" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ayuda" TEXT,
ADD COLUMN     "campos" JSONB,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "grupo" TEXT,
ADD COLUMN     "modulo" TEXT,
ADD COLUMN     "obligacion" "Obligacion" NOT NULL DEFAULT 'CONDICIONAL',
ADD COLUMN     "repiteSobre" TEXT,
ADD COLUMN     "seccion" TEXT,
ADD COLUMN     "validacion" JSONB;

-- DropEnum
DROP TYPE "Sex";

-- CreateIndex
CREATE UNIQUE INDEX "Question_presetId_code_key" ON "Question"("presetId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Question_presetId_order_key" ON "Question"("presetId", "order");

