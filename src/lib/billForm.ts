/**
 * Review-screen form: the supervisor edits text; the app keeps amounts as baisa.
 * Pure functions so they can be unit-tested.
 */
import type { DiscountType, DraftBill } from './billRules';
import { parseDmy } from './dates';
import { formatOmr, splitInclusiveTotal, toBaisa } from './money';

export interface BillForm {
  billDate: string; // DD-MM-YYYY
  billNo: string;
  noBillNo: boolean;
  vendorName: string;
  description: string;
  section: DraftBill['section'];
  shopRate: string;
  vat: string;
  discount: string;
  discountType: DiscountType;
  grandTotal: string;
  remarks: string;
  /** VAT was worked out from the total (not printed on the bill). */
  vatCalculated: boolean;
}

export function isoToDmy(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

const amt = (b: number | null) => (b === null ? '' : formatOmr(b));

export function formFromDraft(d: DraftBill): BillForm {
  return {
    billDate: isoToDmy(d.billDate),
    billNo: d.billNo ?? '',
    noBillNo: d.noBillNo,
    vendorName: d.vendorName ?? '',
    description: d.description,
    section: d.section,
    shopRate: amt(d.shopRate),
    vat: amt(d.vat),
    discount: d.discount === 0 ? '' : formatOmr(d.discount),
    discountType: d.discountType,
    grandTotal: amt(d.grandTotal),
    remarks: d.remarks,
    vatCalculated: d.vatSource === 'calculated',
  };
}

/**
 * Apply the form on top of the stored draft. Fields the form does not show
 * (VAT number, payment mode) are kept. VAT is "calculated" only while the
 * worked-out figure is untouched; a typed VAT counts as printed.
 */
export function draftFromForm(f: BillForm, base: DraftBill): DraftBill {
  const vat = toBaisa(f.vat);
  const discount = toBaisa(f.discount) ?? 0;
  let vatSource: DraftBill['vatSource'];
  if (vat === 0) vatSource = 'none';
  else if (f.vatCalculated) vatSource = 'calculated';
  else vatSource = 'printed';
  return {
    ...base,
    billDate: parseDmy(f.billDate),
    billNo: f.noBillNo ? null : f.billNo.trim() || null,
    noBillNo: f.noBillNo,
    vendorName: f.vendorName.trim() || null,
    description: f.description,
    section: f.section,
    shopRate: toBaisa(f.shopRate),
    vat,
    discount,
    discountType: discount === 0 ? 'none' : f.discountType === 'none' ? 'after_vat' : f.discountType,
    grandTotal: toBaisa(f.grandTotal),
    vatSource,
    remarks: f.remarks,
  };
}

/** "Work out from total": fill Shop Rate and VAT from the grand total (VAT-inclusive, 5%). */
export function splitFromTotal(f: BillForm, withVat: boolean): BillForm {
  const total = toBaisa(f.grandTotal);
  if (total === null) return f;
  const discount = toBaisa(f.discount) ?? 0;
  // Round-off discount after VAT is added back before splitting; a before-VAT discount is part of Shop Rate.
  const gross = total + (f.discountType === 'after_vat' ? discount : 0);
  if (!withVat) {
    return { ...f, shopRate: formatOmr(gross + (f.discountType === 'before_vat' ? discount : 0)), vat: formatOmr(0), vatCalculated: false };
  }
  const { net, vat } = splitInclusiveTotal(gross);
  return { ...f, shopRate: formatOmr(net + (f.discountType === 'before_vat' ? discount : 0)), vat: formatOmr(vat), vatCalculated: true };
}
