-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "manage_token" TEXT NOT NULL,
ALTER COLUMN "customer_email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_manage_token_key" ON "bookings"("manage_token");

