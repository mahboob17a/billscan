/** Report months are identified as "YYYY-MM" (e.g. "2026-09"). */
export type MonthId = string;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DEFAULT_REF_PATTERN = 'DTR-PUR-UTAS-NIZWA-{YYYY}-{MM}';

export function isMonthId(id: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(id);
}

/** Month containing the given date (local time). */
export function monthIdOf(date: Date = new Date()): MonthId {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Month of an ISO date string "YYYY-MM-DD"; null if invalid. */
export function monthIdOfIsoDate(iso: string | null | undefined): MonthId | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const id = iso.slice(0, 7);
  return isMonthId(id) ? id : null;
}

/** "2026-09" → "September 2026" */
export function monthLabel(id: MonthId): string {
  const [y, m] = id.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function shiftMonth(id: MonthId, delta: number): MonthId {
  const [y, m] = id.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Statement reference from a pattern with {YYYY} and {MM}: "DTR-PUR-UTAS-NIZWA-2026-09". */
export function statementRef(id: MonthId, pattern: string = DEFAULT_REF_PATTERN): string {
  const [y, m] = id.split('-');
  return pattern.replace(/\{YYYY\}/g, y).replace(/\{MM\}/g, m);
}

/** "2026-09-14" → "14-09-2026" (report date format). */
export function formatReportDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}
