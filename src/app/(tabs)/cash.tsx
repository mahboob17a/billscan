import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Button, Card, Field, Message, ScreenHeader } from '@/components/ui';
import { addCashEntry, carryForwardSuggestion, CashEntry, CashKind, deleteCashEntry, listCashEntries } from '@/db/repo';
import { parseDmy, todayDmy } from '@/lib/dates';
import { formatOmr, toBaisa } from '@/lib/money';
import { formatReportDate, monthIdOfIsoDate, monthLabel } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { fonts, spacing, useThemeColors } from '@/theme';

/** Section F — cash brought forward from last month, and Section G — cash received from the cashier. */
export default function Cash() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { month, touch } = useMonthStore();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [suggestion, setSuggestion] = useState<{ fromMonth: string; amount: number } | null>(null);
  const [kind, setKind] = useState<CashKind>('received');
  const [date, setDate] = useState(todayDmy());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  // Section F only: + cash left with the supervisor, − money he spent from his own pocket.
  const [bfSign, setBfSign] = useState<1 | -1>(1);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [e, s] = await Promise.all([listCashEntries(userId, month), carryForwardSuggestion(userId, month)]);
    setEntries(e);
    setSuggestion(s);
  }, [userId, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  // Opened from the Month screen's F or G row: pre-select that entry type.
  const [seenKind, setSeenKind] = useState<string | undefined>(undefined);
  if (params.kind !== seenKind) {
    setSeenKind(params.kind);
    if (params.kind === 'brought_forward' || params.kind === 'received') setKind(params.kind);
  }
  // Reload when bills or cash entries change on another screen.
  useEffect(
    () =>
      useMonthStore.subscribe((state, prev) => {
        if (state.version !== prev.version) load();
      }),
    [load],
  );

  async function add(k: CashKind, iso: string, desc: string, baisa: number, rem: string) {
    setBusy(true);
    await addCashEntry(userId, month, { kind: k, entryDate: iso, description: desc, amount: baisa, remarks: rem });
    setBusy(false);
    setSaved(`Added ${formatOmr(baisa)} OMR to ${k === 'brought_forward' ? 'F · Cash brought forward' : 'G · Cash received'}.`);
    touch();
  }

  async function onAdd() {
    setError(null);
    setSaved(null);
    const iso = parseDmy(date);
    const baisa = toBaisa(amount);
    if (!iso) return setError('Enter the date as DD-MM-YYYY, for example 02-09-2026.');
    if (monthIdOfIsoDate(iso) !== month) return setError(`That date is not in ${monthLabel(month)}. Switch month with the arrows above, or change the date.`);
    if (!description.trim())
      return setError(kind === 'brought_forward' ? 'Enter a description, for example “Balance from August 2026”.' : 'Enter a description, for example “Petty cash float”.');
    if (baisa === null || baisa === 0) return setError('Enter the amount in OMR, for example 200.000.');
    let value = baisa;
    if (kind === 'received') {
      if (baisa < 0) return setError('Cash received from the cashier cannot be negative.');
    } else {
      // A typed minus sign wins; otherwise use the + / − choice.
      value = baisa < 0 ? baisa : bfSign * baisa;
    }
    await add(kind, iso, description.trim(), value, remarks.trim());
    setDescription('');
    setAmount('');
    setRemarks('');
  }

  async function onCarryForward() {
    if (!suggestion) return;
    setError(null);
    await add(
      'brought_forward',
      `${month}-01`,
      `Balance from ${monthLabel(suggestion.fromMonth)}`,
      suggestion.amount,
      suggestion.amount < 0 ? 'Spent from own pocket' : 'Cash left with supervisor',
    );
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

  const bf = entries.filter((e) => e.kind === 'brought_forward');
  const received = entries.filter((e) => e.kind === 'received');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader eyebrow={`Sections F and G · ${monthLabel(month)}`} title="Cash" right={<MonthSwitcher />} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {suggestion ? (
          <Card style={{ borderColor: c.highlight, backgroundColor: c.successSoft }}>
            <Text style={{ color: c.text, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 }}>
              {suggestion.amount > 0
                ? `You had ${formatOmr(suggestion.amount, { thousands: true })} OMR left at the end of ${monthLabel(suggestion.fromMonth)}. Bring it forward into ${monthLabel(month)}?`
                : `At the end of ${monthLabel(suggestion.fromMonth)} you had spent ${formatOmr(-suggestion.amount, { thousands: true })} OMR from your own pocket (balance due not yet paid). Bring it forward into ${monthLabel(month)} as −${formatOmr(-suggestion.amount)}?`}
            </Text>
            <Button label={`Bring forward ${formatOmr(suggestion.amount)} OMR`} onPress={onCarryForward} busy={busy} />
          </Card>
        ) : null}

        <EntryList
          title="F · Cash brought forward from last month"
          empty={`No cash brought forward into ${monthLabel(month)}.`}
          totalLabel="Total brought forward"
          entries={bf}
          onDelete={onDelete}
        />
        <EntryList
          title="G · Cash received from cashier"
          empty={`No cash received recorded for ${monthLabel(month)}.`}
          totalLabel="Total cash received"
          entries={received}
          onDelete={onDelete}
        />

        <Text style={[styles.h2, { color: c.text }]}>Add entry</Text>
        <View style={[styles.segment, { borderColor: c.border }]}>
          {(
            [
              ['received', 'G · Cash received'],
              ['brought_forward', 'F · Brought forward'],
            ] as const
          ).map(([k, label]) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.segmentItem, { backgroundColor: on ? c.primarySoft : 'transparent' }]}
              >
                <Text style={{ color: on ? c.primary : c.textMuted, fontFamily: fonts.semibold, fontSize: 13 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Date (DD-MM-YYYY)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder={kind === 'brought_forward' ? 'Balance from last month' : 'Petty cash float'}
        />
        {kind === 'brought_forward' ? (
          <View style={[styles.segment, { borderColor: c.border }]}>
            {(
              [
                [1, '+ Cash left with me'],
                [-1, '− Spent from my pocket'],
              ] as const
            ).map(([sgn, label]) => {
              const on = bfSign === sgn;
              return (
                <Pressable
                  key={sgn}
                  onPress={() => setBfSign(sgn)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.segmentItem, { backgroundColor: on ? (sgn < 0 ? c.warningSoft : c.successSoft) : 'transparent' }]}
                >
                  <Text style={{ color: on ? (sgn < 0 ? c.warning : c.success) : c.textMuted, fontFamily: fonts.semibold, fontSize: 13 }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Field
          label={kind === 'brought_forward' && bfSign < 0 ? 'Amount spent from your pocket (OMR)' : 'Amount (OMR)'}
          value={amount}
          onChangeText={setAmount}
          keyboardType={kind === 'brought_forward' ? 'numbers-and-punctuation' : 'decimal-pad'}
          placeholder="0.000"
          hint={
            kind === 'brought_forward'
              ? bfSign < 0
                ? 'Saved as a negative figure, e.g. −10.000. It increases the balance due from the cashier.'
                : 'Cash still with you from last month. It reduces the balance due.'
              : undefined
          }
        />
        <Field label="Remarks (optional)" value={remarks} onChangeText={setRemarks} placeholder={kind === 'brought_forward' ? 'Cash in hand' : 'Cashier'} />
        {error ? <Message tone="error" text={error} /> : null}
        {saved ? <Message tone="success" text={saved} /> : null}
        <Button label="Add entry" onPress={onAdd} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EntryList({
  title,
  empty,
  totalLabel,
  entries,
  onDelete,
}: {
  title: string;
  empty: string;
  totalLabel: string;
  entries: CashEntry[];
  onDelete: (e: CashEntry) => void;
}) {
  const c = useThemeColors();
  const total = entries.reduce((a, e) => a + e.amount, 0);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[styles.label, { color: c.textMuted }]}>{title.toUpperCase()}</Text>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {entries.length === 0 ? (
          <Text style={[styles.empty, { color: c.textMuted }]}>{empty}</Text>
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
            <Text style={{ flex: 1, color: c.text, fontFamily: fonts.semibold }}>{totalLabel}</Text>
            <Text style={{ color: c.text, fontFamily: fonts.monoMedium, fontSize: 15, marginRight: 28 }}>{formatOmr(total, { thousands: true })}</Text>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: spacing.md },
  empty: { fontFamily: fonts.regular, fontSize: 14, paddingVertical: spacing.md },
  h2: { fontFamily: fonts.semibold, fontSize: 16, marginTop: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 999, overflow: 'hidden' },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
});
