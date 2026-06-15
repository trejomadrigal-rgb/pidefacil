-- Migration: add_repartidores_schema
-- Applied via `prisma db push` during the repartidores refactor.
-- This file was generated post-hoc to close the migration history gap.

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "LiquidationStatus" AS ENUM ('OPEN', 'CLOSED');

-- DropForeignKey (old Liquidation foreign keys)
ALTER TABLE "Liquidation" DROP CONSTRAINT IF EXISTS "Liquidation_branchId_fkey";
ALTER TABLE "Liquidation" DROP CONSTRAINT IF EXISTS "Liquidation_deliveryUserId_fkey";
ALTER TABLE "Liquidation" DROP CONSTRAINT IF EXISTS "Liquidation_receivedById_fkey";

-- DropIndex (old Liquidation indexes)
DROP INDEX IF EXISTS "Liquidation_businessId_branchId_idx";
DROP INDEX IF EXISTS "Liquidation_deliveryUserId_idx";

-- AlterTable: drop old columns, add new columns to Liquidation
ALTER TABLE "Liquidation"
  DROP COLUMN IF EXISTS "branchId",
  DROP COLUMN IF EXISTS "deliveryUserId",
  DROP COLUMN IF EXISTS "receivedById",
  DROP COLUMN IF EXISTS "amount",
  DROP COLUMN IF EXISTS "settledAt",
  ADD COLUMN "shiftId" TEXT,
  ADD COLUMN "status" "LiquidationStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedById" TEXT,
  ADD COLUMN "cashTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cardTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "transferTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: rename settledAt → createdAt was handled above; ensure notes stays
-- (notes column already existed, no action needed)

-- CreateTable: Shift
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "deliveryUserId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Shift
CREATE INDEX "Shift_businessId_idx" ON "Shift"("businessId");
CREATE INDEX "Shift_businessId_status_idx" ON "Shift"("businessId", "status");

-- AlterEnum: add DELIVERY to Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DELIVERY';

-- AlterEnum: add DELIVERY_RETURN to NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DELIVERY_RETURN';

-- AlterTable: add delivery columns to Order
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT,
  ADD COLUMN IF NOT EXISTS "liquidationId" TEXT,
  ADD COLUMN IF NOT EXISTS "transferConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Order delivery columns
CREATE INDEX IF NOT EXISTS "Order_assignedToId_idx" ON "Order"("assignedToId");
CREATE INDEX IF NOT EXISTS "Order_liquidationId_idx" ON "Order"("liquidationId");

-- CreateIndex: new Liquidation indexes
CREATE INDEX "Liquidation_businessId_idx" ON "Liquidation"("businessId");
CREATE INDEX "Liquidation_shiftId_idx" ON "Liquidation"("shiftId");

-- AddForeignKey: Shift → Business
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Shift → Branch
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Shift → User (deliveryUser)
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_deliveryUserId_fkey" FOREIGN KEY ("deliveryUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Shift → User (openedBy)
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Shift → User (closedBy)
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Liquidation.shiftId → Shift
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Liquidation.confirmedById → User
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Order.assignedToId → User
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Order.liquidationId → Liquidation
ALTER TABLE "Order" ADD CONSTRAINT "Order_liquidationId_fkey" FOREIGN KEY ("liquidationId") REFERENCES "Liquidation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Business → Shift
-- (Business.shifts relation is implicit, handled above via Shift_businessId_fkey)
