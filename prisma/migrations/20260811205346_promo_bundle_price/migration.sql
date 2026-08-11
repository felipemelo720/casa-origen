-- AlterEnum
ALTER TYPE "DiscountType" ADD VALUE 'BUNDLE_PRICE';

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "bundleSize" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bundleSizeLabel" TEXT,
ADD COLUMN     "bundleVariantName" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;
