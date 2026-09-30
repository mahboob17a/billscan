/**
 * BillScan design tokens — OpsNest theme (matches opsnest.tools and the splash):
 * deep navy bars, teal→blue actions, cool light background.
 * The exported Excel report never uses these; it keeps the DTR template's navy and sand.
 */

export const palette = {
  navy: '#0B1B34',
  navyMid: '#0D2443',
  navyLow: '#0F344E',
  teal: '#19D3C5',
  tealDeep: '#0E9F95',
  blue: '#3B82F6',
  blueDeep: '#2563EB',
  bluePressed: '#1D4FD8',
  blueSoft: '#E6EFFE',
  mint: '#10B981',
  mintSoft: '#E3F5EE',
  verified: '#0E8A5F',
  amber: '#B45309',
  amberSoft: '#FDF1E1',
  red: '#B42318',
  redSoft: '#FDE8E6',
  mist: '#F2F5FA',
  white: '#FFFFFF',
  ink: '#0B1B34',
  muted: '#5B6B82',
  line: '#DCE3EE',
  // Kept for older components.
  slate: '#0B1B34',
} as const;

/** Teal → blue, the OpsNest action gradient (primary buttons, highlights). */
export const brandGradient = [palette.teal, palette.blue] as const;

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  bar: string;
  onBar: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primarySoft: string;
  highlight: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
}

export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: palette.mist,
    surface: palette.white,
    text: palette.ink,
    textMuted: palette.muted,
    border: palette.line,
    bar: palette.navy,
    onBar: palette.white,
    primary: palette.blueDeep,
    primaryPressed: palette.bluePressed,
    onPrimary: palette.white,
    primarySoft: palette.blueSoft,
    highlight: palette.tealDeep,
    success: palette.verified,
    successSoft: palette.mintSoft,
    warning: palette.amber,
    warningSoft: palette.amberSoft,
    danger: palette.red,
    dangerSoft: palette.redSoft,
  },
  dark: {
    background: palette.navy,
    surface: palette.navyMid,
    text: '#EAF1FA',
    textMuted: '#8FA3BF',
    border: '#1C3A5E',
    bar: '#071427',
    onBar: '#FFFFFF',
    primary: palette.blue,
    primaryPressed: palette.blueDeep,
    onPrimary: '#FFFFFF',
    primarySoft: '#12305A',
    highlight: palette.teal,
    success: '#34D399',
    successSoft: '#0E3326',
    warning: '#F0A65A',
    warningSoft: '#3A2812',
    danger: '#F2877B',
    dangerSoft: '#3C1C19',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

/** Font family names registered in src/theme/fonts.ts */
export const fonts = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  amount: { fontFamily: fonts.monoMedium, fontSize: 16, lineHeight: 22 },
} as const;
