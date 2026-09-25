import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Button, Card, Field, Message, ScreenHeader } from '@/components/ui';
import { addCashEntry, CashEntry, deleteCashEntry, listCashEntries } from '@/db/repo';
import { parseDmy, todayDmy } from '@/lib/dates';
import { formatOmr, toBaisa } from '@/lib/money';
import { formatReportDate, monthIdOfIsoDate, monthLabel } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { fonts, spacing, useThemeColors } from '@/theme';

/** Section F — cash received from the cashier. Feeds the reconciliation. */
export default function Cash() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { month, touch } = useMonthStore();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [date, setDate] = useState(todayDmy());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (userId) setEntries(await listCashEntries(userId, month));
  }, [userId, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  // Reload when bills or cash entries change on another screen.
  useEffect(
    () =>
      useMonthStore.subscribe((state, prev) => {
        if (state.version !== prev.version) load();
      }),
    [load],
  );

  async function onAdd() {
    setError(null);
    setSaved(null);
    const iso = parseDmy(date);
    const baisa = toBaisa(amount);
    if (!iso) return setError('Enter the date as DD-MM-YYYY, for example 02-09-2026.');
    if (monthIdOfIsoDate(iso) !== month) return setError(`That date is not in ${monthLabel(month)}. Switch month with the arrows above, or change the date.`);
    if (!description.trim()) return setError('Enter a description, for example “Petty cash float”.');
    if (baisa === null || baisa <= 0) return setError('Enter the amount in OMR, for example 200.000.');
    setBusy(true);
    await addCashEntry(userId, month, { entryDate: iso, description: description.trim(), amount: baisa, remarks: remarks.trim() });
    setBusy(false);
    setDescription('');
    setAmount('');
    setRemarks('');
    setSaved(`Added ${formatOmr(baisa)} OMR.`);
    touch();
  }

  function onDelete(e: CashEntry) {
    Alert.alert('Delete this entry?', `${e.description} · ${formatOmr(e.amount)} OMR`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCashEntry(userId, e.id);
          touch();
        },
      },
    ]);
  }

  const total = entries.reduce((a, e) => a + e.amount, 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader eyebrow={`Section F · ${monthLabel(month)}`} title="Cash received" right={<MonthSwitcher />} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {entries.length === 0 ? (
            <Text style={[styles.empty, { color: c.textMuted }]}>No cash received recorded for {monthLabel(month)}.</Text>
          ) : (
            entries.map((e, i) => (
              <View key={e.id} style={[styles.row, { borderTopColor: c.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontFamily: fonts.medium, fontSize: 15 }}>{e.description}</Text>
                  <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 12 }}>
                    {formatReportDate(e.entryDate)}
                    {e.remarks ? ` · ${e.remarks}` : ''}
                  </Text>
                </View>
                <Text style={{ color: c.text, fontFamily: fonts.monoMedium, fontSize: 15 }}>{formatOmr(e.amount, { thousands: true })}</Text>
                <Pressable onPress={() => onDelete(e)} accessibilityRole="button" accessibilityLabel={`Delete ${e.description}`} hitSlop={8}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={c.textMuted} />
                </Pressable>
              </View>
            ))
          )}
          {entries.length > 0 ? (
            <View style={[styles.row, { borderTopColor: c.border, borderTopWidth: 1 }]}>
              <Text style={{ flex: 1, color: c.text, fontFamily: fonts.semibold }}>Total cash received</Text>
              <Text style={{ color: c.text, fontFamily: fonts.monoMedium, fontSize: 15, marginRight: 28 }}>{formatOmr(total, { thousands: true })}</Text>
            </View>
          ) : null}
        </Card>

        <Text style={[styles.h2, { color: c.text }]}>Add entry</Text>
        <Field label="Date (DD-MM-YYYY)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="Petty cash float" />
        <Field label="Amount (OMR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.000" />
        <Field label="Remarks (optional)" value={remarks} onChangeText={setRemarks} placeholder="Cashier" />
        {error ? <Message tone="error" text={error} /> : null}
        {saved ? <Message tone="success" text={saved} /> : null}
        <Button label="Add entry" onPress={onAdd} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: spacing.md },
  empty: { fontFamily: fonts.regular, fontSize: 14, paddingVertical: spacing.md },
  h2: { fontFamily: fonts.semibold, fontSize: 16, marginTop: spacing.sm },
});
