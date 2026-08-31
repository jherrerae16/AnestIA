-- Cambio y restablecimiento de contraseña.
ALTER TABLE "Anesthesiologist" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "anesthesiologistId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");
CREATE INDEX "PasswordReset_anesthesiologistId_idx" ON "PasswordReset"("anesthesiologistId");

ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_anesthesiologistId_fkey" FOREIGN KEY ("anesthesiologistId") REFERENCES "Anesthesiologist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
