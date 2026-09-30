import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { goBack, ScreenHeader, useBottomPad } from '@/components/ui';
import { LEGAL_DOCS, LEGAL_UPDATED, LEGAL_VERSION, LegalDocId, OPERATOR } from '@/legal/documents';
import { needsOnboarding, useOnboarding } from '@/state/onboarding';
import { fonts, spacing, useThemeColors } from '@/theme';

/** Full text of the User Guide, Privacy Policy or Disclaimer. */
export default function LegalDoc() {
  const c = useThemeColors();
  const bottom = useBottomPad();
  const onboarding = useOnboarding((s) => needsOnboarding(s));
  const consentCurrent = useOnboarding((s) => s.consent?.version === LEGAL_VERSION);
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = LEGAL_DOCS[(doc as LegalDocId) in LEGAL_DOCS ? (doc as LegalDocId) : 'guide'];
  // Opened from the consent step or from Settings — return there even if the history is empty.
  const close = () => goBack(!onboarding ? '/legal' : consentCurrent ? '/onboarding/permissions' : '/onboarding/consent');
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        eyebrow={`${OPERATOR} · BillScan`}
        title={d.title}
        right={
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={16} style={styles.close}>
            <MaterialCommunityIcons name="close" size={26} color={c.onBar} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: bottom }]}>
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
  body: { padding: spacing.lg, gap: spacing.lg },
  close: { padding: 4 },
  updated: { fontFamily: fonts.regular, fontSize: 13 },
  h: { fontFamily: fonts.semibold, fontSize: 17 },
  p: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
});
