/*
  Warnings:

  - Added the required column `customerName` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerPhone` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."DeliveryType" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "customerPhone" TEXT NOT NULL,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryType" "public"."DeliveryType" NOT NULL DEFAULT 'PICKUP';
