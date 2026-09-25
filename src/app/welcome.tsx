import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { Logo } from '@/components/Logo';
import { getMonthSummary, MonthSummary } from '@/db/repo';
import { formatOmr } from '@/lib/money';
import { monthIdOf, monthLabel } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Welcome (design option B): profile card with name and designation, this month's figures, then on to the Month screen. */
export default function Welcome() {
  const c = useThemeColors();
  const { session, profile, dismissWelcome } = useAuth();
  const setMonth = useMonthStore((s) => s.setMonth);
  const month = monthIdOf();
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const userId = session?.user.id ?? '';

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getMonthSummary(userId, month)
      .then((s) => alive && setSummary(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, month]);

  const name = profile?.fullName || session?.user.email || '';
  const shortMonth = monthLabel(month).slice(0, 3).toUpperCase();

  function onContinue() {
    setMonth(month);
    dismissWelcome();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView edges={['top']} style={[styles.top, { backgroundColor: c.bar }]}>
        <View style={styles.brand}>
          <Logo size={34} />
          <Text style={[styles.brandText, { color: c.onBar }]}>BillScan</Text>
        </View>
      </SafeAreaView>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.avatar, { backgroundColor: c.primary, borderColor: c.surface }]}>
          <Text style={[styles.avatarText, { color: c.onPrimary }]}>{initials(name)}</Text>
        </View>
        <Text style={[styles.hello, { color: c.textMuted }]}>Welcome</Text>
        <Text style={[styles.name, { color: c.text }]} accessibilityRole="header">
          {name}
        </Text>
        {profile?.designation ? <Text style={[styles.desig, { color: c.primary }]}>{profile.designation}</Text> : null}
        <Text style={[styles.org, { color: c.textMuted }]}>{'Daryas Trading & Contracting · UTAS Nizwa'}</Text>
      </View>

      <View style={styles.stats}>
        <Stat label={`${shortMonth} PURCHASES`} value={summary ? formatOmr(summary.purchases, { thousands: true }) : '—'} />
        <Stat
          label="DRAFTS TO CHECK"
          value={summary ? String(summary.draftsToReview) : '—'}
          tone={summary && summary.draftsToReview > 0 ? c.warning : undefined}
        />
      </View>

      <View style={{ flex: 1 }} />

      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Go to Month screen"
          style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? c.primaryPressed : c.primary }]}
        >
          <Text style={[styles.btnText, { color: c.onPrimary }]}>Go to Month screen</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color={c.onPrimary} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const c = useThemeColors();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: tone ?? c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingBottom: 84, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  brandText: { fontFamily: fonts.semibold, fontSize: 17 },
  card: {
    marginTop: -60,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginTop: -42, marginBottom: spacing.md },
  avatarText: { fontFamily: fonts.bold, fontSize: 30 },
  hello: { fontFamily: fonts.regular, fontSize: 15 },
  name: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, textAlign: 'center', marginTop: 2 },
  desig: { fontFamily: fonts.medium, fontSize: 16, marginTop: 4, textAlign: 'center' },
  org: { fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6 },
  statValue: { fontFamily: fonts.monoMedium, fontSize: 18 },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.pill, paddingVertical: 16 },
  btnText: { fontFamily: fonts.semibold, fontSize: 16 },
});
