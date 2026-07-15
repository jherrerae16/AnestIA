-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MASCULINO', 'FEMENINO', 'OTRO');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXTO_CORTO', 'TEXTO_LARGO', 'SELECCION_UNICA', 'SELECCION_MULTIPLE', 'FECHA', 'NUMERO', 'SI_NO', 'ARCHIVO');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('BORRADOR', 'ENVIADO_AL_PACIENTE', 'RESPONDIENDO', 'RESPUESTAS_RECIBIDAS', 'LABS_ANALIZADOS', 'BORRADOR_GENERADO', 'PENDIENTE_REVISION', 'APROBADO', 'ENTREGADO');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('HEMOGRAMA', 'COAGULACION', 'ECG', 'ECOCARDIOGRAMA', 'OTRO');

-- CreateEnum
CREATE TYPE "LabFlag" AS ENUM ('NORMAL', 'ALERTA', 'CRITICO');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('MEDICO', 'CLINICA', 'ASEGURADORA', 'PACIENTE', 'OTRO');

-- CreateTable
CREATE TABLE "Anesthesiologist" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "specialty" TEXT,
    "medicalRegistry" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "clinicLogoUrl" TEXT,
    "signatureUrl" TEXT,
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anesthesiologist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "anesthesiologistId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "sex" "Sex",
    "phone" TEXT,
    "insurer" TEXT,
    "bloodType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnairePreset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnairePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "conditional" JSONB,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "anesthesiologistId" TEXT NOT NULL,
    "patientId" TEXT,
    "presetId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'BORRADOR',
    "linkToken" TEXT NOT NULL,
    "linkExpiresAt" TIMESTAMP(3),
    "procedure" TEXT,
    "procedureDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "partial" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "url" TEXT NOT NULL,
    "fileHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedLabResult" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "analyte" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "refRange" TEXT,
    "flag" "LabFlag" NOT NULL DEFAULT 'NORMAL',
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedLabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedAssessment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "modelUsed" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedPdfUrl" TEXT,
    "edits" JSONB,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectoryContact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectoryContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRecord" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Anesthesiologist_email_key" ON "Anesthesiologist"("email");

-- CreateIndex
CREATE INDEX "Patient_documentId_idx" ON "Patient"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_anesthesiologistId_documentId_key" ON "Patient"("anesthesiologistId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Case_linkToken_key" ON "Case"("linkToken");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FormResponse_caseId_key" ON "FormResponse"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedAssessment_caseId_key" ON "GeneratedAssessment"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRecord_caseId_key" ON "ApprovalRecord"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_caseId_key" ON "Consent"("caseId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_anesthesiologistId_fkey" FOREIGN KEY ("anesthesiologistId") REFERENCES "Anesthesiologist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnairePreset" ADD CONSTRAINT "QuestionnairePreset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Anesthesiologist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "QuestionnairePreset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_anesthesiologistId_fkey" FOREIGN KEY ("anesthesiologistId") REFERENCES "Anesthesiologist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "QuestionnairePreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedLabResult" ADD CONSTRAINT "ExtractedLabResult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAssessment" ADD CONSTRAINT "GeneratedAssessment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectoryContact" ADD CONSTRAINT "DirectoryContact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Anesthesiologist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRecord" ADD CONSTRAINT "DeliveryRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRecord" ADD CONSTRAINT "DeliveryRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "DirectoryContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
