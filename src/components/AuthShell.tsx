/** Shared frame for the sign-in, sign-up and password screens. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import type { OAuthProvider } from '@/lib/authFlows';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

export function AuthShell({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: boolean; children: ReactNode }) {
  const c = useThemeColors();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <SafeAreaView edges={['top']} style={[styles.top, { backgroundColor: c.bar }]}>
          {back ? (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={10}
              style={styles.back}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={c.onBar} />
            </Pressable>
          ) : null}
          <Logo size={52} />
          <Text style={[styles.name, { color: c.onBar }]}>BillScan</Text>
          <Text style={[styles.tagline, { color: c.onBar }]}>by OpsNest</Text>
        </SafeAreaView>
        <View style={styles.form}>
          <View style={{ gap: 4 }}>
            <Text style={[styles.heading, { color: c.text }]} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={[styles.sub, { color: c.textMuted }]}>{subtitle}</Text> : null}
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** "Continue with Google / Apple" button. */
export function ProviderButton({ provider, onPress, busy, disabled }: { provider: OAuthProvider; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const c = useThemeColors();
  const apple = provider === 'apple';
  const bg = apple ? '#000000' : c.surface;
  const fg = apple ? '#FFFFFF' : c.text;
  const label = apple ? 'Continue with Apple' : 'Continue with Google';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.provider,
        { backgroundColor: bg, borderColor: apple ? '#000000' : c.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <MaterialCommunityIcons name={apple ? 'apple' : 'google'} size={20} color={apple ? '#FFFFFF' : '#4285F4'} />
          <Text style={[styles.providerText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function OrDivider() {
  const c = useThemeColors();
  return (
    <View style={styles.or}>
      <View style={[styles.line, { backgroundColor: c.border }]} />
      <Text style={{ color: c.textMuted, fontFamily: fonts.medium, fontSize: 12 }}>OR</Text>
      <View style={[styles.line, { backgroundColor: c.border }]} />
    </View>
  );
}

export function TextLink({ label, onPress, align = 'center' }: { label: string; onPress: () => void; align?: 'center' | 'flex-end' | 'flex-start' }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={{ alignSelf: align }}>
      <Text style={{ color: c.primary, fontFamily: fonts.medium, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
    borderBottomLeftRadius: radius.lg + 8,
    borderBottomRightRadius: radius.lg + 8,
  },
  back: { position: 'absolute', left: spacing.lg, top: spacing.xl + 8, zIndex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 24, marginTop: spacing.sm },
  tagline: { fontFamily: fonts.regular, fontSize: 13, opacity: 0.75 },
  form: { padding: spacing.lg, gap: spacing.md, flex: 1 },
  heading: { fontFamily: fonts.semibold, fontSize: 21 },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  provider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 13,
  },
  providerText: { fontFamily: fonts.semibold, fontSize: 15 },
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: 2 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
