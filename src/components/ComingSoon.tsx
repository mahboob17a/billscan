import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

/** Placeholder body for screens that arrive in a later phase. */
export function ComingSoon({
  icon,
  title,
  body,
  phase,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
  phase: string;
}) {
  const c = useThemeColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: c.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={36} color={c.primary} />
      </View>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.body, { color: c.textMuted }]}>{body}</Text>
      <Text style={[styles.phase, { color: c.primary, backgroundColor: c.primarySoft }]}>{phase}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 18, textAlign: 'center' },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  phase: { fontFamily: fonts.medium, fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
});
