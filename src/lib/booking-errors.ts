export class BookingConflictError extends Error {
  /** A concrete alternative to offer the guest, if one was found nearby. */
  suggestion?: { startTime: Date; endTime: Date };

  constructor(message: string, suggestion?: { startTime: Date; endTime: Date }) {
    super(message);
    this.name = "BookingConflictError";
    this.suggestion = suggestion;
  }
}

export class EmployeeNotQualifiedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeNotQualifiedError";
  }
}

export class InvalidBookingRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBookingRequestError";
  }
}

export class CancellationWindowPassedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CancellationWindowPassedError";
  }
}

/**
 * Detects a PostgreSQL exclusion-constraint violation (23P01) bubbling up
 * through Prisma's driver-adapter error wrapping. Prisma does not have a
 * dedicated error code for EXCLUDE constraints (unlike P2002 for UNIQUE), so
 * the real Postgres error is nested inside `meta.driverAdapterError`. We
 * check every layer we've observed plus a message fallback so this keeps
 * working across Prisma versions.
 */
export function isExclusionViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: string;
    message?: string;
    meta?: { driverAdapterError?: { cause?: { code?: string; originalCode?: string } } };
  };
  const nestedCode =
    e.meta?.driverAdapterError?.cause?.code ?? e.meta?.driverAdapterError?.cause?.originalCode;
  if (nestedCode === "23P01") return true;
  if (e.code === "23P01") return true;
  return typeof e.message === "string" && e.message.includes("booking_segments_employee_no_overlap");
}
