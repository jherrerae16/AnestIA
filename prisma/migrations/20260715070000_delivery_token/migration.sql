-- Add tokenized download link to DeliveryRecord
ALTER TABLE "DeliveryRecord" ADD COLUMN "token" TEXT;
CREATE UNIQUE INDEX "DeliveryRecord_token_key" ON "DeliveryRecord"("token");
