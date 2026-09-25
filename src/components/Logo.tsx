import { StyleSheet, View } from 'react-native';
import { palette } from '@/theme';

/** BillScan mark: a receipt with a mint scan line. Drawn with Views so it scales crisply. */
export function Logo({ size = 64 }: { size?: number }) {
  const w = size * 0.78;
  const line = Math.max(2, size * 0.05);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.paper, { width: w, height: size, borderRadius: size * 0.06, padding: w * 0.16, gap: size * 0.07 }]}>
        {[0.7, 0.45, 0.7, 0.5].map((f, i) => (
          <View key={i} style={{ height: line, width: `${f * 100}%`, borderRadius: line, backgroundColor: '#CBD5E1' }} />
        ))}
        <View style={{ height: line * 1.3, width: '45%', alignSelf: 'flex-end', borderRadius: line, backgroundColor: palette.slate }} />
      </View>
      <View
        style={[
          styles.scan,
          { top: size * 0.43, height: Math.max(2, size * 0.04), left: (size - w) / 2 - w * 0.12, right: (size - w) / 2 - w * 0.12 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: palette.white },
  scan: {
    position: 'absolute',
    backgroundColor: palette.mint,
    borderRadius: 4,
    shadowColor: palette.mint,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
