-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "photo_url" TEXT,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "processing_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_services" (
    "employee_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,

    CONSTRAINT "employee_services_pkey" PRIMARY KEY ("employee_id","service_id")
);

-- CreateTable
CREATE TABLE "service_combos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "popularity_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_combos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_combo_items" (
    "combo_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "sequence_order" INTEGER NOT NULL,

    CONSTRAINT "service_combo_items_pkey" PRIMARY KEY ("combo_id","service_id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "reminder_sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_segments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "start_time" TIMESTAMPTZ(3) NOT NULL,
    "end_time" TIMESTAMPTZ(3) NOT NULL,
    "sequence_order" INTEGER NOT NULL,

    CONSTRAINT "booking_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "employee_services_service_id_idx" ON "employee_services"("service_id");

-- CreateIndex
CREATE INDEX "service_combo_items_service_id_idx" ON "service_combo_items"("service_id");

-- CreateIndex
CREATE INDEX "bookings_customer_email_idx" ON "bookings"("customer_email");

-- CreateIndex
CREATE INDEX "booking_segments_booking_id_idx" ON "booking_segments"("booking_id");

-- CreateIndex
CREATE INDEX "booking_segments_service_id_idx" ON "booking_segments"("service_id");

-- AddForeignKey
ALTER TABLE "employee_services" ADD CONSTRAINT "employee_services_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_services" ADD CONSTRAINT "employee_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_combo_items" ADD CONSTRAINT "service_combo_items_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "service_combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_combo_items" ADD CONSTRAINT "service_combo_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_segments" ADD CONSTRAINT "booking_segments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_segments" ADD CONSTRAINT "booking_segments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_segments" ADD CONSTRAINT "booking_segments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Double-booking prevention (database-enforced, not just application logic)
-- ============================================================================
-- btree_gist lets a GiST index use plain equality (employee_id) alongside a
-- range operator (&&) in the same exclusion constraint.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- A time range must be non-empty and ordered the right way round.
ALTER TABLE "booking_segments"
    ADD CONSTRAINT "booking_segments_time_order_check"
    CHECK ("end_time" > "start_time");

-- The actual guarantee: for a given employee, no two segments may occupy
-- overlapping time. tstzrange(...) defaults to '[)' — an appointment ending
-- at 15:00 does not conflict with one starting at 15:00. This is enforced by
-- PostgreSQL itself at INSERT/UPDATE time inside the same transaction as the
-- write, so two concurrent transactions racing for the same slot cannot both
-- commit: the second one to reach the constraint check is rejected with a
-- 23P01 (exclusion_violation) error, which application code maps to a
-- friendly "someone just booked this" message. See src/lib/booking.ts.
ALTER TABLE "booking_segments"
    ADD CONSTRAINT "booking_segments_employee_no_overlap"
    EXCLUDE USING gist (
        "employee_id" WITH =,
        tstzrange("start_time", "end_time") WITH &&
    );
