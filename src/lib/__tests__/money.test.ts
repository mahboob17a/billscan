import { formatOmr, splitInclusiveTotal, sum, toBaisa, vatOn, within } from '../money';

describe('toBaisa', () => {
  it('parses plain amounts', () => {
    expect(toBaisa('44.625')).toBe(44625);
    expect(toBaisa('42.5')).toBe(42500);
    expect(toBaisa('7')).toBe(7000);
    expect(toBaisa(2.125)).toBe(2125);
  });
  it('handles thousands separators and currency labels', () => {
    expect(toBaisa('1,234.500')).toBe(1234500);
    expect(toBaisa('OMR 18.900')).toBe(18900);
    expect(toBaisa('18.900 RO')).toBe(18900);
  });
  it('reads Arabic-Indic digits', () => {
    expect(toBaisa('٤٤٫٦٢٥')).toBe(44625);
  });
  it('rounds a 4th decimal half away from zero', () => {
    expect(toBaisa('6.6665')).toBe(6667);
    expect(toBaisa('6.6664')).toBe(6666);
  });
  it('returns null for unreadable input', () => {
    expect(toBaisa('')).toBeNull();
    expect(toBaisa('abc')).toBeNull();
    expect(toBaisa(null)).toBeNull();
  });
});

describe('formatOmr', () => {
  it('always shows 3 decimals', () => {
    expect(formatOmr(44625)).toBe('44.625');
    expect(formatOmr(18900)).toBe('18.900');
    expect(formatOmr(0)).toBe('0.000');
    expect(formatOmr(-125)).toBe('-0.125');
    expect(formatOmr(1234500, { thousands: true })).toBe('1,234.500');
  });
});

describe('VAT maths (Blueprint §5)', () => {
  it('adds exactly: 42.500 + 2.125 = 44.625', () => {
    expect(sum([42500, 2125])).toBe(44625);
    expect(vatOn(42500)).toBe(2125);
  });
  it('splits a total-only receipt: 10.500 → 10.000 + 0.500', () => {
    expect(splitInclusiveTotal(10500)).toEqual({ net: 10000, vat: 500 });
  });
  it('split always adds back to the printed total: 7.000 → 6.667 + 0.333', () => {
    const { net, vat } = splitInclusiveTotal(7000);
    expect(net).toBe(6667);
    expect(vat).toBe(333);
    expect(net + vat).toBe(7000);
  });
  it('before-VAT discount row: 100.000 + 4.750 − 5.000 = 99.750', () => {
    expect(vatOn(100000 - 5000)).toBe(4750);
    expect(100000 + 4750 - 5000).toBe(99750);
  });
  it('after-VAT round-off row: 42.500 + 2.125 − 0.625 = 44.000', () => {
    expect(42500 + 2125 - 625).toBe(44000);
  });
  it('tolerance check of 0.010', () => {
    expect(within(44625, 44635)).toBe(true);
    expect(within(44625, 44715)).toBe(false);
  });
});
