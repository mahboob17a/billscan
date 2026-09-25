import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Field, Message, ScreenHeader } from '@/components/ui';
import { DEFAULT_REPORT_SETTINGS, getReportSettings, ReportSettings, saveReportSettings } from '@/db/repo';
import { monthIdOf, statementRef } from '@/lib/months';
import { spacing, useThemeColors } from '@/theme';

/** Header fields printed at the top of the monthly purchase report. */
export default function ReportSettingsScreen() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [s, setS] = useState<ReportSettings>(DEFAULT_REPORT_SETTINGS);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (userId) getReportSettings(userId).then(setS);
  }, [userId]);

  const set = (k: keyof ReportSettings) => (v: string) => setS((prev) => ({ ...prev, [k]: v }));

  async function onSave() {
    if (!s.refPattern.includes('{YYYY}') || !s.refPattern.includes('{MM}')) {
      return setMsg({ tone: 'error', text: 'The reference must contain {YYYY} and {MM}, for example DTR-PUR-UTAS-NIZWA-{YYYY}-{MM}.' });
    }
    setBusy(true);
    await saveReportSettings(userId, s);
    setBusy(false);
    setMsg({ tone: 'success', text: 'Saved. New months use these details.' });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        eyebrow="Settings"
        title="Report header"
        right={
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={c.onBar} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field label="Company (row 1)" value={s.companyName} onChangeText={set('companyName')} />
        <Field label="Contract line (row 2)" value={s.contractLine} onChangeText={set('contractLine')} />
        <Field label="Prepared by" value={s.preparedBy} onChangeText={set('preparedBy')} placeholder="Mahboob — Maintenance Supervisor" />
        <Field label="Submitted to" value={s.submittedTo} onChangeText={set('submittedTo')} />
        <Field
          label="Statement reference"
          value={s.refPattern}
          onChangeText={set('refPattern')}
          autoCapitalize="characters"
          hint={`This month: ${statementRef(monthIdOf(), s.refPattern)}`}
        />
        {msg ? <Message tone={msg.tone} text={msg.text} /> : null}
        <View style={{ gap: spacing.sm }}>
          <Button label="Save" onPress={onSave} busy={busy} />
          <Button label="Reset to template defaults" kind="secondary" onPress={() => setS({ ...DEFAULT_REPORT_SETTINGS, preparedBy: s.preparedBy })} />
        </View>
        <Text style={{ color: c.textMuted, fontSize: 12 }}>Months already started keep their reference. Changes apply to new months.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
