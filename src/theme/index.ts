import { useColorScheme } from 'react-native';
import { colors, ThemeColors } from './tokens';

export * from './tokens';

/** Current theme colours, following the phone's light/dark setting. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? colors.dark : colors.light;
}
