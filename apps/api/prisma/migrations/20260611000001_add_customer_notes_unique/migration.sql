-- DropIndex
DROP INDEX "Customer_businessId_phone_idx";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_phone_key" ON "Customer"("businessId", "phone");
