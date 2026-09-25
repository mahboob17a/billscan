import { create } from 'zustand';
import { MonthId, monthIdOf, shiftMonth } from '@/lib/months';

interface MonthState {
  /** Report month shown across the app (defaults to the current month). */
  month: MonthId;
  /** Bumped after any change to bills or cash entries, so screens reload. */
  version: number;
  setMonth: (m: MonthId) => void;
  step: (delta: number) => void;
  touch: () => void;
}

export const useMonthStore = create<MonthState>((set) => ({
  month: monthIdOf(),
  version: 0,
  setMonth: (month) => set({ month }),
  step: (delta) => set((s) => ({ month: shiftMonth(s.month, delta) })),
  touch: () => set((s) => ({ version: s.version + 1 })),
}));
