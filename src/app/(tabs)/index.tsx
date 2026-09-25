import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Card, ScreenHeader } from '@/components/ui';
import { getMonthSummary, MonthSummary } from '@/db/repo';
import { SECTION_INFO } from '@/db/schema';
import { formatOmr } from '@/lib/money';
import { monthLabel } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

export default function Dashboard() {
  const c = useThemeColors();
  const { session } = useAuth();
  const month = useMonthStore((st) => st.month);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const userId = session?.user.id ?? '';

  const load = useCallback(async () => {
    if (!userId) return;
    setSummary(await getMonthSummary(userId, month));
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

  const s = summary;
  const balanceLabel = s && s.balanceDue < 0 ? 'Cash left with you' : 'Balance due from cashier';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader eyebrow={s?.statementRef ?? ' '} title={monthLabel(month)} right={<MonthSwitcher />} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.kpis}>
          <Kpi label="Purchases" value={s ? formatOmr(s.purchases, { thousands: true }) : '—'} />
          <Kpi label="Cash received" value={s ? formatOmr(s.cashReceived, { thousands: true }) : '—'} />
        </View>
        <View style={[styles.balance, { backgroundColor: c.primarySoft, borderLeftColor: c.highlight }]}>
          <Text style={[styles.kpiLabel, { color: c.textMuted }]}>{balanceLabel.toUpperCase()}</Text>
          <Text style={[styles.balanceValue, { color: c.text }]}>
            {s ? formatOmr(Math.abs(s.balanceDue), { thousands: true }) : '—'} <Text style={styles.omr}>OMR</Text>
          </Text>
        </View>

        {s && s.draftsToReview > 0 ? (
          <Pressable onPress={() => router.push('/bills/drafts')} accessibilityRole="button">
            <Card style={{ borderColor: c.warning, backgroundColor: c.warningSoft, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: c.warning, fontFamily: fonts.semibold }}>
                {s.draftsToReview} scanned {s.draftsToReview === 1 ? 'bill needs' : 'bills need'} checking before saving
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={c.warning} />
            </Card>
          </Pressable>
        ) : null}

        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {s?.sections.map((sec, i) => (
            <Row
              key={sec.section}
              first={i === 0}
              title={`${SECTION_INFO[sec.section].letter} · ${SECTION_INFO[sec.section].title}`}
              meta={sec.bills === 0 ? 'No bills yet' : `${sec.bills} ${sec.bills === 1 ? 'bill' : 'bills'}`}
              amount={sec.bills === 0 ? '—' : formatOmr(sec.total, { thousands: true })}
              onPress={() => router.push({ pathname: '/bills/[kind]', params: { kind: sec.section } })}
            />
          ))}
          <Row
            title="B · Cancelled"
            meta={s && s.cancelledBills > 0 ? `${s.cancelledBills} ${s.cancelledBills === 1 ? 'bill' : 'bills'} · not counted` : 'None'}
            amount="—"
            onPress={() => router.push('/bills/cancelled')}
          />
          <Row
            title="F · Cash received"
            meta={s && s.cashEntries > 0 ? `${s.cashEntries} ${s.cashEntries === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
            amount={s && s.cashEntries > 0 ? formatOmr(s.cashReceived, { thousands: true }) : '—'}
            onPress={() => router.navigate('/cash')}
          />
        </Card>
        <View style={{ height: 88 }} />
      </ScrollView>

      <Pressable
        onPress={() => router.navigate('/scan')}
        accessibilityRole="button"
        accessibilityLabel="Scan bill"
        style={({ pressed }) => [styles.fab, { backgroundColor: pressed ? c.primaryPressed : c.primary }]}
      >
        <MaterialCommunityIcons name="line-scan" size={20} color={c.onPrimary} />
        <Text style={[styles.fabText, { color: c.onPrimary }]}>Scan bill</Text>
      </Pressable>
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <View style={[styles.kpi, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.kpiLabel, { color: c.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.kpiValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function Row({ title, meta, amount, first, onPress }: { title: string; meta: string; amount: string; first?: boolean; onPress?: () => void }) {
  const c = useThemeColors();
  const content = (
    <View style={[styles.row, { borderTopColor: c.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontFamily: fonts.medium, fontSize: 15 }}>{title}</Text>
        <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 12 }}>{meta}</Text>
      </View>
      <Text style={{ color: c.text, fontFamily: fonts.monoMedium, fontSize: 15 }}>{amount}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  kpis: { flexDirection: 'row', gap: spacing.md },
  kpi: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  kpiLabel: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6 },
  kpiValue: { fontFamily: fonts.monoMedium, fontSize: 18 },
  balance: { borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 4, gap: 2 },
  balanceValue: { fontFamily: fonts.monoMedium, fontSize: 24 },
  omr: { fontFamily: fonts.regular, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: spacing.md },
  fab: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: radius.pill,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { fontFamily: fonts.semibold, fontSize: 16 },
});
