import { EMPTY_DRAFT } from '@/db/bills';
import { draftFromExtraction, Extraction } from '../billRules';
import { draftFromForm, formFromDraft, isoToDmy, splitFromTotal } from '../billForm';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'x' }));
jest.mock('@/db/index', () => ({ getDb: jest.fn() }));

const base: Extraction = {
  vendor_name: 'Shop',
  vendor_vat_no: 'OM1100999999',
  vendor_vat_registered: true,
  bill_no: '4286',
  bill_date: '2026-09-17',
  taxable_amount: 6.4,
  vat_amount: 0.32,
  discount: 0.22,
  discount_type: 'after_vat',
  grand_total: 6.5,
  total_only: false,
  description: 'Paint',
  section: 'MATERIAL',
  remarks: 'Shop · Cash',
  payment_mode: 'cash',
  confidence: { amounts: 'high', bill_date: 'high', bill_no: 'high' },
  notes: '',
};

describe('billForm', () => {
  it('round-trips a draft through the form unchanged', () => {
    const d = draftFromExtraction(base);
    expect(draftFromForm(formFromDraft(d), d)).toEqual(d);
  });

  it('formats dates DD-MM-YYYY', () => {
    expect(isoToDmy('2026-09-07')).toBe('07-09-2026');
    expect(isoToDmy(null)).toBe('');
  });

  it('parses typed amounts into baisa', () => {
    const f = { ...formFromDraft(EMPTY_DRAFT), shopRate: '10.5', vat: '0.525', grandTotal: '11.025', billDate: '1-9-2026' };
    const d = draftFromForm(f, EMPTY_DRAFT);
    expect([d.shopRate, d.vat, d.grandTotal, d.billDate, d.vatSource]).toEqual([10500, 525, 11025, '2026-09-01', 'printed']);
  });

  it('splits a VAT-inclusive total and marks VAT as calculated', () => {
    const f = splitFromTotal({ ...formFromDraft(EMPTY_DRAFT), grandTotal: '21.000' }, true);
    expect([f.shopRate, f.vat]).toEqual(['20.000', '1.000']);
    expect(draftFromForm(f, EMPTY_DRAFT).vatSource).toBe('calculated');
    const typed = draftFromForm({ ...f, vatCalculated: false }, EMPTY_DRAFT);
    expect(typed.vatSource).toBe('printed');
  });

  it('adds a before-VAT discount back into Shop Rate when splitting', () => {
    const f = splitFromTotal({ ...formFromDraft(EMPTY_DRAFT), grandTotal: '10.500', discount: '1.000', discountType: 'before_vat' }, true);
    expect([f.shopRate, f.vat]).toEqual(['11.000', '0.500']);
  });

  it('no-VAT split puts the whole total in Shop Rate', () => {
    const f = splitFromTotal({ ...formFromDraft(EMPTY_DRAFT), grandTotal: '46.000' }, false);
    expect([f.shopRate, f.vat]).toEqual(['46.000', '0.000']);
    expect(draftFromForm(f, EMPTY_DRAFT).vatSource).toBe('none');
  });

  it('a discount with no type is treated as round-off after VAT', () => {
    const d = draftFromForm({ ...formFromDraft(EMPTY_DRAFT), discount: '0.100', discountType: 'none' }, EMPTY_DRAFT);
    expect(d.discountType).toBe('after_vat');
  });
});
