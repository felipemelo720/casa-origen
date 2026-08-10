-- AlterTable
ALTER TABLE "communes" ADD COLUMN     "deliveryFeeMax" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryFeeMin" INTEGER NOT NULL DEFAULT 0;
