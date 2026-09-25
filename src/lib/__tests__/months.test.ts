import { formatReportDate, isMonthId, monthIdOf, monthIdOfIsoDate, monthLabel, shiftMonth, statementRef } from '../months';

describe('months', () => {
  it('builds month ids and labels', () => {
    expect(monthIdOf(new Date(2026, 8, 25))).toBe('2026-09');
    expect(monthLabel('2026-09')).toBe('September 2026');
    expect(isMonthId('2026-13')).toBe(false);
  });
  it('reads the month of a bill date', () => {
    expect(monthIdOfIsoDate('2026-10-03')).toBe('2026-10');
    expect(monthIdOfIsoDate('03/10/2026')).toBeNull();
  });
  it('moves across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('builds the statement reference used in cell B7', () => {
    expect(statementRef('2026-09')).toBe('DTR-PUR-UTAS-NIZWA-2026-09');
  });
  it('formats report dates', () => {
    expect(formatReportDate('2026-09-14')).toBe('14-09-2026');
  });
});
