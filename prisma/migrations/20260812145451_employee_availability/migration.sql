-- CreateTable
CREATE TABLE "employee_availability" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_hour" INTEGER NOT NULL,
    "end_hour" INTEGER NOT NULL,

    CONSTRAINT "employee_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_availability_employee_id_day_of_week_key" ON "employee_availability"("employee_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "employee_availability" ADD CONSTRAINT "employee_availability_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

