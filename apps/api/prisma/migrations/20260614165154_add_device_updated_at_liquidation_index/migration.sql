-- AlterTable: Add updatedAt to Device
ALTER TABLE "Device" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: Add index on Liquidation.deliveryUserId
CREATE INDEX "Liquidation_deliveryUserId_idx" ON "Liquidation"("deliveryUserId");
