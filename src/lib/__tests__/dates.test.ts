import { parseDmy, todayDmy } from '../dates';

describe('dates', () => {
  it('parses day-month-year as used in Oman', () => {
    expect(parseDmy('02-09-2026')).toBe('2026-09-02');
    expect(parseDmy('2/9/2026')).toBe('2026-09-02');
    expect(parseDmy('18.09.2026')).toBe('2026-09-18');
  });
  it('rejects impossible dates', () => {
    expect(parseDmy('31-09-2026')).toBeNull();
    expect(parseDmy('2026-09-02')).toBeNull();
  });
  it('formats today', () => {
    expect(todayDmy(new Date(2026, 8, 5))).toBe('05-09-2026');
  });
});
