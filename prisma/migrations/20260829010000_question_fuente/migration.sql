-- CreateEnum
CREATE TYPE "FuenteDato" AS ENUM ('PACIENTE', 'SISTEMA', 'DOCUMENTO', 'CLINICO');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "fuente" "FuenteDato" NOT NULL DEFAULT 'PACIENTE';

