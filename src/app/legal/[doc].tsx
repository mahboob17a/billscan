import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ui';
import { LEGAL_DOCS, LEGAL_UPDATED, LegalDocId, OPERATOR } from '@/legal/documents';
import { fonts, spacing, useThemeColors } from '@/theme';

/** Full text of the User Guide, Privacy Policy or Disclaimer. */
export default function LegalDoc() {
  const c = useThemeColors();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = LEGAL_DOCS[(doc as LegalDocId) in LEGAL_DOCS ? (doc as LegalDocId) : 'guide'];
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        eyebrow={`${OPERATOR} · BillScan`}
        title={d.title}
        right={
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={c.onBar} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.updated, { color: c.textMuted }]}>Last updated {LEGAL_UPDATED}</Text>
        {d.sections.map((s) => (
          <View key={s.heading} style={{ gap: 6 }}>
            <Text style={[styles.h, { color: c.text }]}>{s.heading}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={[styles.p, { color: c.text }]}>
                {p}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  updated: { fontFamily: fonts.regular, fontSize: 13 },
  h: { fontFamily: fonts.semibold, fontSize: 17 },
  p: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
});
