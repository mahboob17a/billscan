/**
 * BillScan design tokens — palette approved in Blueprint v0.8:
 * Slate bars, Royal Violet actions, Mint highlight, Lavender Mist background.
 * The exported Excel report never uses these; it keeps the DTR template's navy and sand.
 */

export const palette = {
  slate: '#1B2230',
  slate2: '#2A3446',
  violet: '#6D4AFF',
  violetPressed: '#5A38EE',
  violetSoft: '#EFEBFF',
  mint: '#10B981',
  mintSoft: '#E3F5EE',
  verified: '#0E8A5F',
  amber: '#B45309',
  amberSoft: '#FDF1E1',
  red: '#B42318',
  redSoft: '#FDE8E6',
  lavenderMist: '#F4F2FB',
  white: '#FFFFFF',
  ink: '#141221',
  muted: '#5E5A72',
  line: '#E4E1F0',
} as const;

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
    background: palette.lavenderMist,
    surface: palette.white,
    text: palette.ink,
    textMuted: palette.muted,
    border: palette.line,
    bar: palette.slate,
    onBar: palette.white,
    primary: palette.violet,
    primaryPressed: palette.violetPressed,
    onPrimary: palette.white,
    primarySoft: palette.violetSoft,
    highlight: palette.mint,
    success: palette.verified,
    successSoft: palette.mintSoft,
    warning: palette.amber,
    warningSoft: palette.amberSoft,
    danger: palette.red,
    dangerSoft: palette.redSoft,
  },
  dark: {
    background: '#0E0C16',
    surface: '#181526',
    text: '#ECEAF5',
    textMuted: '#A29EB8',
    border: '#2C2842',
    bar: '#1F1B30',
    onBar: '#FFFFFF',
    primary: '#8F74FF',
    primaryPressed: '#7C5FFF',
    onPrimary: '#FFFFFF',
    primarySoft: '#2A2350',
    highlight: '#34D399',
    success: '#34D399',
    successSoft: '#10301F',
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
