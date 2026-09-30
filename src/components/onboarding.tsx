/** Building blocks for the onboarding screens (OpsNest navy theme, continuing from the splash). */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OPSNEST } from '@/components/BrandSplash';
import type { PermState } from '@/lib/permissions';
import { fonts, radius, spacing } from '@/theme';

export const ON = {
  ...OPSNEST,
  card: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.12)',
  text: '#FFFFFF',
  sub: '#B6C4D8',
  ok: '#34D399',
  warn: '#F5B454',
} as const;

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function OnbScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: ON.navy }}>
      <LinearGradient colors={[ON.navy, ON.navyMid, ON.navyLow]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.glow} />
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

export function StepHeader({ step, of, title, subtitle }: { step: number; of: number; title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.step}>
        STEP {step} OF {of}
      </Text>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function GradientButton({ label, onPress, disabled, busy, icon }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [{ borderRadius: radius.pill, overflow: 'hidden', opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }]}
    >
      <LinearGradient colors={[ON.teal, ON.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.btnText}>{label}</Text>
            {icon ? <MaterialCommunityIcons name={icon} size={20} color="#fff" /> : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'center', paddingVertical: 8 }}>
      <Text style={{ color: ON.sub, fontFamily: fonts.medium, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} style={styles.checkRow} hitSlop={4}>
      <View style={[styles.box, checked ? { backgroundColor: ON.teal, borderColor: ON.teal } : null]}>
        {checked ? <MaterialCommunityIcons name="check-bold" size={16} color={ON.navy} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const STATE_TEXT: Record<PermState, string> = {
  granted: 'Allowed',
  denied: 'Not allowed',
  blocked: 'Blocked — open settings',
  undetermined: 'Not asked yet',
  'not-needed': 'No permission needed',
};

export function PermissionRow({
  icon,
  title,
  reason,
  state,
  onAllow,
  note,
}: {
  icon: IconName;
  title: string;
  reason: string;
  state: PermState | 'auto' | 'later';
  onAllow?: () => void;
  note?: string;
}) {
  const ok = state === 'granted' || state === 'not-needed' || state === 'auto';
  const status = state === 'auto' ? 'Used automatically' : state === 'later' ? 'Offered after sign-in' : STATE_TEXT[state];
  const askable = onAllow && (state === 'undetermined' || state === 'denied' || state === 'blocked');
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={styles.permIcon}>
          <MaterialCommunityIcons name={icon} size={22} color={ON.teal} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardText}>{reason}</Text>
          {note ? <Text style={[styles.cardText, { fontSize: 12, opacity: 0.8 }]}>{note}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <MaterialCommunityIcons name={ok ? 'check-circle' : state === 'later' ? 'clock-outline' : 'alert-circle-outline'} size={16} color={ok ? ON.ok : state === 'later' ? ON.sub : ON.warn} />
            <Text style={{ color: ok ? ON.ok : state === 'later' ? ON.sub : ON.warn, fontFamily: fonts.medium, fontSize: 13 }}>{status}</Text>
          </View>
        </View>
        {askable ? (
          <Pressable onPress={onAllow} accessibilityRole="button" accessibilityLabel={`Allow ${title}`} style={styles.allow}>
            <Text style={styles.allowText}>{state === 'blocked' ? 'Settings' : 'Allow'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: -140, right: -140, width: 380, height: 380, borderRadius: 190, backgroundColor: '#1B4A7E', opacity: 0.35 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  step: { color: ON.teal, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4 },
  title: { color: ON.text, fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  subtitle: { color: ON.sub, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 16 },
  btnText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 16 },
  checkRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: ON.sub, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkLabel: { flex: 1, color: ON.text, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: ON.card, borderColor: ON.cardBorder, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { color: ON.text, fontFamily: fonts.semibold, fontSize: 16 },
  cardText: { color: ON.sub, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  permIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(25,211,197,0.12)', alignItems: 'center', justifyContent: 'center' },
  allow: { borderWidth: 1, borderColor: ON.teal, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'center' },
  allowText: { color: ON.teal, fontFamily: fonts.semibold, fontSize: 13 },
});
