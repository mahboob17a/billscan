import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Checkbox, GradientButton, ON, OnbScreen, StepHeader } from '@/components/onboarding';
import { LEGAL_DOCS, LEGAL_ORDER, LEGAL_UPDATED, LegalDocId } from '@/legal/documents';
import { useOnboarding } from '@/state/onboarding';
import { fonts, spacing } from '@/theme';

const ICONS = { guide: 'book-open-page-variant-outline', privacy: 'shield-lock-outline', disclaimer: 'alert-decagram-outline' } as const;

/** Onboarding step 2: read and accept the User Guide, Privacy Policy and Disclaimer. */
export default function Consent() {
  const accept = useOnboarding((s) => s.accept);
  const [checked, setChecked] = useState<Record<LegalDocId, boolean>>({ guide: false, privacy: false, disclaimer: false });
  const [busy, setBusy] = useState(false);
  const all = LEGAL_ORDER.every((d) => checked[d]);

  async function onAgree() {
    setBusy(true);
    await accept();
    setBusy(false);
    router.replace('/onboarding/permissions');
  }

  return (
    <OnbScreen footer={<GradientButton label="Agree and continue" icon="arrow-right" onPress={onAgree} disabled={!all} busy={busy} />}>
      <ScrollView contentContainerStyle={styles.body}>
        <StepHeader step={1} of={2} title="Before you start" subtitle="Please read these three short documents and tick each box to use BillScan." />
        {LEGAL_ORDER.map((id) => {
          const d = LEGAL_DOCS[id];
          return (
            <Card key={id}>
              <View style={styles.docHead}>
                <MaterialCommunityIcons name={ICONS[id]} size={22} color={ON.teal} />
                <Text style={styles.docTitle}>{d.title}</Text>
                <Pressable onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: id } })} accessibilityRole="button" accessibilityLabel={`Read the ${d.title}`} hitSlop={8}>
                  <Text style={styles.read}>Read</Text>
                </Pressable>
              </View>
              <Text style={styles.summary}>{d.summary}</Text>
              <Checkbox checked={checked[id]} onToggle={() => setChecked((c) => ({ ...c, [id]: !c[id] }))} label={d.consentLabel} />
            </Card>
          );
        })}
        <Pressable
          onPress={() => setChecked({ guide: !all, privacy: !all, disclaimer: !all })}
          accessibilityRole="button"
          style={{ alignSelf: 'flex-start' }}
          hitSlop={8}
        >
          <Text style={styles.read}>{all ? 'Untick all' : 'I have read all three — tick all'}</Text>
        </Pressable>
        <Text style={styles.small}>Version of {LEGAL_UPDATED}. You can read these documents again any time in Settings → Legal and permissions.</Text>
      </ScrollView>
    </OnbScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingTop: spacing.xl },
  docHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docTitle: { flex: 1, color: ON.text, fontFamily: fonts.semibold, fontSize: 17 },
  read: { color: ON.teal, fontFamily: fonts.semibold, fontSize: 14 },
  summary: { color: ON.sub, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginTop: -4 },
  small: { color: ON.sub, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, opacity: 0.8 },
});
