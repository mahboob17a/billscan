import groundTruth from '../../../eval/ground-truth.json';
import { checkDraft, draftFromExtraction, Extraction, hasErrors } from '../billRules';
import { toBaisa } from '../money';

type GT = (typeof groundTruth.bills)[number];

/** The ideal AI answer for a ground-truth bill. */
function perfectExtraction(b: GT): Extraction {
  return {
    vendor_name: b.vendor,
    vendor_vat_no: null,
    vendor_vat_registered: b.vendor_vat_registered,
    bill_no: b.bill_no,
    bill_date: b.bill_date,
    taxable_amount: b.taxable_amount,
    vat_amount: b.vat_amount,
    discount: b.discount,
    discount_type: b.discount_type as Extraction['discount_type'],
    grand_total: b.grand_total,
    total_only: b.total_only,
    description: b.description[0],
    section: b.section as Extraction['section'],
    remarks: `${b.vendor} · Cash`,
    payment_mode: 'cash',
    confidence: { amounts: 'high', bill_date: 'high', bill_no: 'high' },
    notes: '',
  };
}

const base = (over: Partial<Extraction>): Extraction => ({ ...perfectExtraction(groundTruth.bills[1]), ...over });

describe('sample bills (Sep 2026) become the right report rows', () => {
  it.each(groundTruth.bills.map((b) => [b.id, b] as const))('%s', (_id, b) => {
    const d = draftFromExtraction(perfectExtraction(b));
    expect(d.shopRate).toBe(toBaisa(b.row.shop_rate));
    expect(d.vat).toBe(toBaisa(b.row.vat));
    expect(d.discount).toBe(toBaisa(b.row.disc));
    expect(d.grandTotal).toBe(toBaisa(b.row.grand));
    // Every row satisfies Shop Rate + VAT − Disc. = Grand Total
    expect(d.shopRate! + d.vat! - d.discount).toBe(d.grandTotal);

    const flags = checkDraft(d, { targetMonth: '2026-09' });
    const codes = flags.map((f) => f.code);
    expect(codes).not.toContain('SUM_MISMATCH');
    expect(codes).not.toContain('VAT_NOT_5');
    if (b.bill_date === null) expect(codes).toContain('MISSING_DATE');
    else expect(hasErrors(flags)).toBe(false);
    if (b.bill_date?.startsWith('2026-08')) expect(codes).toContain('OTHER_MONTH');
  });

  it('adds the round-off note to remarks (Khairat 4286)', () => {
    const d = draftFromExtraction(perfectExtraction(groundTruth.bills[3]));
    expect(d.discountType).toBe('after_vat');
    expect(d.remarks).toContain('Round-off disc. after VAT');
    expect(d.remarks.length).toBeLessThanOrEqual(60);
  });

  it('marks cash memos from vendors without a VAT number as “no VAT” (info only)', () => {
    const d = draftFromExtraction(perfectExtraction(groundTruth.bills[4]));
    expect(d.vatSource).toBe('none');
    expect(checkDraft(d).find((f) => f.code === 'NO_VAT')?.level).toBe('info');
  });
});

describe('discount rules (Blueprint §5)', () => {
  it('before VAT: shop rate is the amount before discount (100.000 / 4.750 / 5.000 / 99.750)', () => {
    const d = draftFromExtraction(base({ taxable_amount: 95, vat_amount: 4.75, discount: 5, discount_type: 'before_vat', grand_total: 99.75 }));
    expect([d.shopRate, d.vat, d.discount, d.grandTotal]).toEqual([100000, 4750, 5000, 99750]);
    expect(checkDraft(d).map((f) => f.code)).not.toContain('VAT_NOT_5');
    expect(d.remarks).toContain('Disc. before VAT');
  });
  it('after VAT: round-off (42.500 / 2.125 / 0.625 / 44.000)', () => {
    const d = draftFromExtraction(base({ taxable_amount: 42.5, vat_amount: 2.125, discount: 0.625, discount_type: 'after_vat', grand_total: 44 }));
    expect([d.shopRate, d.vat, d.discount, d.grandTotal]).toEqual([42500, 2125, 625, 44000]);
    expect(checkDraft(d).filter((f) => f.level !== 'info')).toEqual([]);
  });
  it('infers the type when the AI leaves it as none', () => {
    const d = draftFromExtraction(base({ taxable_amount: 6.4, vat_amount: 0.32, discount: 0.22, discount_type: 'none', grand_total: 6.5 }));
    expect(d.discountType).toBe('after_vat');
  });
  it('rounding up is a negative discount, flagged amber', () => {
    const d = draftFromExtraction(base({ taxable_amount: 41.786, vat_amount: 2.089, discount: -0.125, discount_type: 'after_vat', grand_total: 44 }));
    expect(checkDraft(d).find((f) => f.code === 'ROUND_UP')?.level).toBe('warn');
  });
});

describe('total-only bills', () => {
  it('VAT-registered vendor: splits total ÷ 1.05 and flags “calculated”', () => {
    const d = draftFromExtraction(base({ taxable_amount: null, vat_amount: null, grand_total: 10.5, total_only: true, vendor_vat_registered: true }));
    expect([d.shopRate, d.vat]).toEqual([10000, 500]);
    expect(checkDraft(d).find((f) => f.code === 'VAT_CALCULATED')?.level).toBe('warn');
  });
  it('vendor without VAT number: VAT 0, shop rate = total', () => {
    const d = draftFromExtraction(base({ taxable_amount: null, vat_amount: null, grand_total: 7, total_only: true, vendor_vat_registered: false }));
    expect([d.shopRate, d.vat]).toEqual([7000, 0]);
  });
});

describe('checks that catch misreads', () => {
  it('flags a misread VAT (2.215 instead of 2.125)', () => {
    const d = draftFromExtraction(base({ taxable_amount: 42.5, vat_amount: 2.215, grand_total: 44.625 }));
    const codes = checkDraft(d).map((f) => f.code);
    expect(codes).toContain('SUM_MISMATCH');
    expect(codes).toContain('VAT_NOT_5');
  });
  it('accepts 2-decimal bills within 0.010 (Al Ras 5.33 + 0.27 = 5.60)', () => {
    const d = draftFromExtraction(perfectExtraction(groundTruth.bills[11]));
    expect(checkDraft(d, { targetMonth: '2026-09' })).toEqual([]);
  });
  it('blocks saving when amounts are unreadable', () => {
    const d = draftFromExtraction(base({ grand_total: null, taxable_amount: null, vat_amount: null }));
    expect(hasErrors(checkDraft(d))).toBe(true);
  });
  it('requires a bill number unless “No bill number” is ticked', () => {
    const d = draftFromExtraction(base({ bill_no: null }));
    expect(checkDraft(d).map((f) => f.code)).toContain('MISSING_BILL_NO');
    expect(checkDraft({ ...d, noBillNo: true }).map((f) => f.code)).not.toContain('MISSING_BILL_NO');
  });
  it('warns on low-confidence readings', () => {
    const d = draftFromExtraction(base({}));
    const flags = checkDraft(d, { confidence: { amounts: 'low', bill_date: 'high', bill_no: 'low' } });
    expect(flags.map((f) => f.code)).toEqual(expect.arrayContaining(['LOW_CONF_AMOUNTS', 'LOW_CONF_BILL_NO']));
  });
});
