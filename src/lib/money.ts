/**
 * Money helpers. All amounts are stored as whole baisa (integers):
 * 1 OMR = 1000 baisa, so 44.625 OMR is stored as 44625.
 * Integers keep totals exact — no floating-point drift across a month of bills.
 */

export type Baisa = number;

const BAISA_PER_OMR = 1000;
/** Oman standard VAT rate in basis points (5% = 500). */
export const VAT_RATE_BP = 500;

function roundHalfAwayFromZero(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/** Parse an OMR amount ("1,234.5", "44.625", 12, "٤٤٫٦٢٥") into baisa. Returns null if unreadable. */
export function toBaisa(input: string | number | null | undefined): Baisa | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? roundHalfAwayFromZero(input * BAISA_PER_OMR) : null;
  }
  const normalised = input
    .trim()
    // Arabic-Indic and Eastern Arabic-Indic digits → ASCII
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/[٬,\s]/g, '') // thousands separators and spaces
    .replace(/^(OMR|RO|R\.O\.|ر\.ع\.?)/i, '')
    .replace(/(OMR|RO|R\.O\.|ر\.ع\.?)$/i, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) return null;
  const [whole, frac = ''] = normalised.replace('-', '').split('.');
  const sign = normalised.startsWith('-') ? -1 : 1;
  // Round to 3 decimals using the 4th digit, without float maths.
  const frac3 = (frac + '000').slice(0, 3);
  let value = Number(whole) * BAISA_PER_OMR + Number(frac3);
  if (frac.length > 3 && Number(frac[3]) >= 5) value += 1;
  return sign * value;
}

/** Format baisa as OMR with exactly 3 decimals, e.g. 44625 → "44.625". */
export function formatOmr(baisa: Baisa, opts: { thousands?: boolean } = {}): string {
  const sign = baisa < 0 ? '-' : '';
  const abs = Math.abs(baisa);
  const whole = Math.floor(abs / BAISA_PER_OMR);
  const frac = String(abs % BAISA_PER_OMR).padStart(3, '0');
  const wholeStr = opts.thousands ? whole.toLocaleString('en-US') : String(whole);
  return `${sign}${wholeStr}.${frac}`;
}

/** VAT charged on a net (taxable) amount. */
export function vatOn(net: Baisa, rateBp: number = VAT_RATE_BP): Baisa {
  return roundHalfAwayFromZero((net * rateBp) / 10000);
}

/**
 * Split a VAT-inclusive total into net and VAT (used when a bill prints only the total).
 * VAT is total − net, so net + VAT always equals the printed total exactly.
 */
export function splitInclusiveTotal(total: Baisa, rateBp: number = VAT_RATE_BP): { net: Baisa; vat: Baisa } {
  const net = roundHalfAwayFromZero((total * 10000) / (10000 + rateBp));
  return { net, vat: total - net };
}

/** Sum a list of baisa amounts. */
export function sum(amounts: readonly Baisa[]): Baisa {
  return amounts.reduce((a, b) => a + b, 0);
}

/** True when two amounts differ by no more than the tolerance (default 10 baisa = 0.010 OMR). */
export function within(a: Baisa, b: Baisa, tolerance: Baisa = 10): boolean {
  return Math.abs(a - b) <= tolerance;
}
