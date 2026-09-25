/** Parse a date typed as DD-MM-YYYY (also accepts / or .) into ISO YYYY-MM-DD; null if not a real date. */
export function parseDmy(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number) as unknown as [number, number, number, number];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Today as DD-MM-YYYY for form defaults. */
export function todayDmy(now: Date = new Date()): string {
  return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
}
