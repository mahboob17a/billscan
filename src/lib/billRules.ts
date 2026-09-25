/**
 * Bill rules (Blueprint §3–§5): turn the AI's reading of a bill into a report row
 * and list anything the supervisor must check before saving.
 *
 * Every report row follows one formula: Shop Rate + VAT − Disc. = Grand Total.
 * - Discount before VAT: Shop Rate is the amount before the discount (taxable + discount).
 * - Discount after VAT (round-off): Shop Rate is the taxable amount.
 * - VAT is copied as printed. It is only worked out when a VAT-registered vendor prints just a total.
 */
import type { Section } from '@/db/schema';
import { Baisa, formatOmr, splitInclusiveTotal, toBaisa, vatOn } from './money';
import { monthIdOfIsoDate, monthLabel, MonthId } from './months';

export type DiscountType = 'before_vat' | 'after_vat' | 'none';
export type Confidence = 'high' | 'medium' | 'low';

/** What the extract-bill server returns (prompt v0.2). */
export interface Extraction {
  vendor_name: string | null;
  vendor_vat_no: string | null;
  vendor_vat_registered: boolean;
  bill_no: string | null;
  bill_date: string | null;
  taxable_amount: number | null;
  vat_amount: number | null;
  discount: number;
  discount_type: DiscountType;
  grand_total: number | null;
  total_only: boolean;
  description: string;
  section: Section;
  remarks: string;
  payment_mode: 'cash' | 'credit' | 'card' | 'unknown';
  confidence: { amounts: Confidence; bill_date: Confidence; bill_no: Confidence };
  notes: string;
}

/** Where the VAT figure came from. */
export type VatSource = 'printed' | 'calculated' | 'none';

/** Editable fields on the review screen; amounts in baisa. */
export interface DraftBill {
  billDate: string | null; // YYYY-MM-DD
  billNo: string | null;
  noBillNo: boolean;
  vendorName: string | null;
  vendorVatNo: string | null;
  vendorVatRegistered: boolean;
  description: string;
  section: Section;
  shopRate: Baisa | null;
  vat: Baisa | null;
  discount: Baisa;
  discountType: DiscountType;
  grandTotal: Baisa | null;
  vatSource: VatSource;
  paymentMode: string;
  remarks: string;
}

export type FlagLevel = 'error' | 'warn' | 'info';
export type DraftField = 'billDate' | 'billNo' | 'description' | 'shopRate' | 'vat' | 'discount' | 'grandTotal' | 'remarks' | 'section';

export interface Flag {
  code: string;
  level: FlagLevel;
  field?: DraftField;
  message: string;
}

export const MAX_REMARKS = 60;
/** 0.010 OMR: allowed rounding difference between printed figures. */
export const TOLERANCE: Baisa = 10;

const DISCOUNT_NOTES: Record<Exclude<DiscountType, 'none'>, string> = {
  before_vat: 'Disc. before VAT',
  after_vat: 'Round-off disc. after VAT',
};

/** Add the discount-type note to remarks (Blueprint §5) and keep within 60 characters. */
export function withDiscountNote(remarks: string, type: DiscountType, discount: Baisa): string {
  const r = remarks.trim();
  if (type !== 'none' && discount !== 0) {
    const note = DISCOUNT_NOTES[type];
    if (!r.toLowerCase().includes(note.toLowerCase())) {
      // Keep the whole discount note; shorten the rest if needed.
      const room = MAX_REMARKS - note.length - 3;
      const head = r.length > room ? r.slice(0, room).trimEnd() : r;
      return head ? `${head} · ${note}` : note;
    }
  }
  return r.length > MAX_REMARKS ? r.slice(0, MAX_REMARKS).trimEnd() : r;
}

/** Build the editable draft (report row) from the AI's reading. */
export function draftFromExtraction(e: Extraction): DraftBill {
  let taxable = toBaisa(e.taxable_amount);
  let vat = toBaisa(e.vat_amount);
  const grand = toBaisa(e.grand_total);
  const discount = toBaisa(e.discount) ?? 0;
  let discountType: DiscountType = discount === 0 ? 'none' : e.discount_type;

  // A discount with no type: decide from the arithmetic.
  if (discount !== 0 && discountType === 'none') {
    discountType = taxable !== null && vat !== null && grand !== null && Math.abs(taxable + vat - discount - grand) <= TOLERANCE ? 'after_vat' : 'before_vat';
  }

  let vatSource: VatSource = 'printed';
  if (taxable === null && vat === null && grand !== null) {
    const beforeRoundOff = grand + (discountType === 'after_vat' ? discount : 0);
    if (e.vendor_vat_registered) {
      const split = splitInclusiveTotal(beforeRoundOff);
      taxable = split.net;
      vat = split.vat;
      vatSource = 'calculated';
    } else {
      taxable = beforeRoundOff;
      vat = 0;
      vatSource = 'none';
    }
  } else if (taxable !== null && vat === null && !e.vendor_vat_registered) {
    vat = 0;
    vatSource = 'none';
  } else if (vat === 0) {
    vatSource = 'none';
  }

  const shopRate = taxable === null ? null : taxable + (discountType === 'before_vat' ? discount : 0);
  const billNo = e.bill_no?.trim() || null;

  return {
    billDate: e.bill_date && /^\d{4}-\d{2}-\d{2}$/.test(e.bill_date) ? e.bill_date : null,
    billNo,
    noBillNo: false,
    vendorName: e.vendor_name?.trim() || null,
    vendorVatNo: e.vendor_vat_no?.trim() || null,
    vendorVatRegistered: e.vendor_vat_registered,
    description: e.description?.trim() ?? '',
    section: e.section,
    shopRate,
    vat,
    discount,
    discountType,
    grandTotal: grand,
    vatSource,
    paymentMode: e.payment_mode,
    remarks: withDiscountNote(e.remarks ?? '', discountType, discount),
  };
}

/** Checks from Blueprint §5. Errors block saving; warnings are shown in amber; info is shown in grey. */
export function checkDraft(
  d: DraftBill,
  opts: { targetMonth?: MonthId; confidence?: Extraction['confidence'] } = {},
): Flag[] {
  const flags: Flag[] = [];
  const add = (f: Flag) => flags.push(f);

  // Required fields
  if (!d.billDate) add({ code: 'MISSING_DATE', level: 'error', field: 'billDate', message: 'Bill date is missing. Type it from the bill.' });
  if (!d.billNo && !d.noBillNo)
    add({ code: 'MISSING_BILL_NO', level: 'error', field: 'billNo', message: 'Bill number is missing. Type it, or tick “No bill number”.' });
  if (!d.description.trim()) add({ code: 'MISSING_DESCRIPTION', level: 'error', field: 'description', message: 'Choose a description.' });
  if (d.grandTotal === null) add({ code: 'MISSING_TOTAL', level: 'error', field: 'grandTotal', message: 'Grand total is missing. Type it from the bill.' });
  if (d.shopRate === null) add({ code: 'MISSING_SHOP_RATE', level: 'error', field: 'shopRate', message: 'Shop rate (amount before VAT) is missing.' });
  if (d.vat === null) add({ code: 'MISSING_VAT', level: 'error', field: 'vat', message: 'VAT is missing. Type 0.000 if the bill has no VAT.' });

  // Arithmetic: Shop Rate + VAT − Disc. = Grand Total
  if (d.shopRate !== null && d.vat !== null && d.grandTotal !== null) {
    const computed = d.shopRate + d.vat - d.discount;
    if (Math.abs(computed - d.grandTotal) > TOLERANCE) {
      add({
        code: 'SUM_MISMATCH',
        level: 'warn',
        field: 'grandTotal',
        message: `Shop rate + VAT − Disc. = ${formatOmr(computed)}, but grand total is ${formatOmr(d.grandTotal)}. Check the amounts on the photo.`,
      });
    }
  }

  // VAT rate: 5% of the taxable value
  if (d.shopRate !== null && d.vat !== null && d.vat !== 0) {
    const base = d.shopRate - (d.discountType === 'before_vat' ? d.discount : 0);
    const expected = vatOn(base);
    if (Math.abs(d.vat - expected) > TOLERANCE) {
      add({ code: 'VAT_NOT_5', level: 'warn', field: 'vat', message: `VAT should be about ${formatOmr(expected)} (5% of ${formatOmr(base)}). Check the VAT figure.` });
    }
  }

  if (d.vatSource === 'calculated') {
    add({
      code: 'VAT_CALCULATED',
      level: 'warn',
      field: 'vat',
      message: 'Only the total is printed, so VAT was worked out (total ÷ 1.05). If this vendor does not charge VAT, set VAT to 0.000.',
    });
  } else if (d.vatSource === 'none' && d.vendorVatRegistered) {
    add({ code: 'NO_VAT_REGISTERED', level: 'warn', field: 'vat', message: 'This vendor has a VAT number but no VAT is shown. Check the bill.' });
  } else if (d.vatSource === 'none') {
    add({ code: 'NO_VAT', level: 'info', field: 'vat', message: 'No VAT on this bill (vendor has no VAT number).' });
  }

  if (d.discount < 0) {
    add({ code: 'ROUND_UP', level: 'warn', field: 'discount', message: `The bill rounds up by ${formatOmr(-d.discount)}. Recorded as a negative discount; confirm.` });
  }

  if (d.remarks.length > MAX_REMARKS) {
    add({ code: 'REMARKS_LONG', level: 'error', field: 'remarks', message: `Remarks can be at most ${MAX_REMARKS} characters.` });
  }
  if (!d.remarks.trim()) add({ code: 'MISSING_REMARKS', level: 'error', field: 'remarks', message: 'Add a short remark, for example the vendor name.' });

  // AI confidence
  const c = opts.confidence;
  if (c?.amounts === 'low') add({ code: 'LOW_CONF_AMOUNTS', level: 'warn', field: 'grandTotal', message: 'Amounts were hard to read. Compare them with the photo.' });
  if (c?.bill_date === 'low' && d.billDate) add({ code: 'LOW_CONF_DATE', level: 'warn', field: 'billDate', message: 'The date was hard to read. Check it.' });
  if (c?.bill_no === 'low' && d.billNo) add({ code: 'LOW_CONF_BILL_NO', level: 'warn', field: 'billNo', message: 'The bill number was hard to read. Check it.' });

  // Month
  const billMonth = monthIdOfIsoDate(d.billDate);
  if (opts.targetMonth && billMonth && billMonth !== opts.targetMonth) {
    add({
      code: 'OTHER_MONTH',
      level: 'warn',
      field: 'billDate',
      message: `This bill is dated ${monthLabel(billMonth)}. Choose which month's report it goes in.`,
    });
  }

  return flags;
}

export const hasErrors = (flags: Flag[]) => flags.some((f) => f.level === 'error');
