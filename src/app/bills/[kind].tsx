import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { ScreenHeader } from '@/components/ui';
import { BillListFilter, BillRecord, listBills } from '@/db/bills';
import { Section, SECTION_INFO, SECTIONS } from '@/db/schema';
import { checkDraft, hasErrors } from '@/lib/billRules';
import { formatOmr } from '@/lib/money';
import { formatReportDate, monthLabel } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

/** Bills of one section (A, C, D, E), cancelled bills (B), or drafts waiting for review. */
export default function BillList() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const month = useMonthStore((s) => s.month);
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const [bills, setBills] = useState<BillRecord[]>([]);

  const filter: BillListFilter = SECTIONS.includes(kind as Section)
    ? { kind: 'section', section: kind as Section }
    : kind === 'cancelled'
      ? { kind: 'cancelled' }
      : { kind: 'drafts' };
  const title =
    filter.kind === 'section'
      ? `${SECTION_INFO[filter.section].letter} · ${SECTION_INFO[filter.section].title}`
      : filter.kind === 'cancelled'
        ? 'B · Cancelled bills'
        : 'Drafts to check';

  const filterKey = JSON.stringify(filter);
  const load = useCallback(async () => {
    if (userId) setBills(await listBills(userId, month, JSON.parse(filterKey) as BillListFilter));
  }, [userId, month, filterKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(
    () =>
      useMonthStore.subscribe((state, prev) => {
        if (state.version !== prev.version) load();
      }),
    [load],
  );

  const total = bills.reduce((a, b) => a + (b.grandTotal ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        eyebrow={monthLabel(month)}
        title={title}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MonthSwitcher />
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
              <MaterialCommunityIcons name="close" size={24} color={c.onBar} />
            </Pressable>
          </View>
        }
      />
      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.body}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>
            {filter.kind === 'drafts' ? 'No drafts. Every scanned bill has been checked.' : `No bills here for ${monthLabel(month)}.`}
          </Text>
        }
        renderItem={({ item, index }) => <BillRow bill={item} index={index} showFlags={filter.kind === 'drafts'} />}
        ListFooterComponent={
          bills.length > 0 && filter.kind !== 'drafts' ? (
            <View style={[styles.footer, { borderTopColor: c.border }]}>
              <Text style={{ flex: 1, color: c.text, fontFamily: fonts.semibold }}>
                {bills.length} {bills.length === 1 ? 'bill' : 'bills'}
                {filter.kind === 'cancelled' ? ' · not counted' : ''}
              </Text>
              <Text style={{ color: c.text, fontFamily: fonts.monoMedium, fontSize: 16 }}>{formatOmr(total, { thousands: true })}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function BillRow({ bill, index, showFlags }: { bill: BillRecord; index: number; showFlags: boolean }) {
  const c = useThemeColors();
  const flags = showFlags ? checkDraft(bill, { targetMonth: bill.month, confidence: bill.extraction?.confidence }) : [];
  const needsFix = showFlags && hasErrors(flags);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/bill/[id]', params: { id: bill.id } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}
    >
      {bill.imagePaths[0] ? (
        <Image source={{ uri: bill.imagePaths[0] }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
          <MaterialCommunityIcons name="receipt-text-outline" size={22} color={c.primary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontFamily: fonts.medium, fontSize: 15 }} numberOfLines={1}>
          {showFlags ? '' : `${index + 1}. `}
          {bill.description || 'No description yet'}
        </Text>
        <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 12 }} numberOfLines={1}>
          {bill.billDate ? formatReportDate(bill.billDate) : 'No date'} · {bill.noBillNo ? 'No bill no.' : `No. ${bill.billNo ?? '—'}`}
          {bill.remarks ? ` · ${bill.remarks}` : ''}
        </Text>
        {showFlags ? (
          <Text style={{ color: needsFix ? c.danger : c.warning, fontFamily: fonts.medium, fontSize: 12 }}>
            {needsFix ? `${flags.filter((f) => f.level === 'error').length} to fix` : 'Ready — tap to check and save'}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: c.text, fontFamily: fonts.monoMedium, fontSize: 15 }}>
        {bill.grandTotal !== null ? formatOmr(bill.grandTotal, { thousands: true }) : '—'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.sm },
  empty: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  thumb: { width: 44, height: 58, borderRadius: radius.sm },
  footer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: spacing.md, marginTop: spacing.sm },
});
