/**
 * Returns true if the given due date is strictly past — i.e. the entire
 * day of the due date has already ended.
 *
 * Rule: a task with due_date = 2025-04-28 is still ON TIME during the whole
 * 28th. It only becomes LATE when 2025-04-29 00:00 starts.
 */
/** Parses "YYYY-MM-DD" as a local date (avoids the UTC shift that shows the previous day). */
export function parseDueDate(value: string | Date): Date {
  if (typeof value !== "string") return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
}

export function isOverdue(dueDate: string | Date | null | undefined): boolean {
  if (!dueDate) return false;
  const d = parseDueDate(dueDate);
  if (isNaN(d.getTime())) return false;
  // End of the due day (local timezone)
  const endOfDueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return Date.now() > endOfDueDay.getTime();
}
