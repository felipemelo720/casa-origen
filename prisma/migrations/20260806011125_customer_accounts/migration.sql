-- DropIndex
DROP INDEX "customers_email_idx";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

