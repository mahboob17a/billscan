import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { monthIdOf } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { useThemeColors } from '@/theme';

/** Previous / next month arrows for the header. Cannot go past the current month. */
export function MonthSwitcher() {
  const c = useThemeColors();
  const { month, step } = useMonthStore();
  const atCurrent = month >= monthIdOf();
  return (
    <View style={styles.row}>
      <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} style={styles.btn}>
        <MaterialCommunityIcons name="chevron-left" size={26} color={c.onBar} />
      </Pressable>
      <Pressable
        onPress={() => !atCurrent && step(1)}
        disabled={atCurrent}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: atCurrent }}
        hitSlop={10}
        style={[styles.btn, { opacity: atCurrent ? 0.3 : 1 }]}
      >
        <MaterialCommunityIcons name="chevron-right" size={26} color={c.onBar} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  btn: { padding: 4 },
});
