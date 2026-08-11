-- AlterTable
ALTER TABLE "extras" ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "variant_options" ADD COLUMN     "extraPremiumPrice" INTEGER;
