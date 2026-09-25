import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

/** Slate header bar used at the top of every main screen. */
export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  const c = useThemeColors();
  return (
    <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: c.bar }]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: c.onBar }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: c.onBar }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </SafeAreaView>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
  style,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: ReactNode;
}) {
  const c = useThemeColors();
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? c.dangerSoft : c.surface;
  const fg = kind === 'primary' ? c.onPrimary : kind === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed && kind === 'primary' ? c.primaryPressed : bg,
          borderColor: kind === 'secondary' ? c.border : 'transparent',
          opacity: disabled ? 0.5 : pressed && kind !== 'primary' ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const c = useThemeColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }, props.style]}
      />
      {hint ? <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useThemeColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function Message({ text, tone }: { text: string; tone: 'error' | 'info' | 'success' }) {
  const c = useThemeColors();
  const bg = tone === 'error' ? c.dangerSoft : tone === 'success' ? c.successSoft : c.primarySoft;
  const fg = tone === 'error' ? c.danger : tone === 'success' ? c.success : c.text;
  return (
    <View style={[styles.message, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      <Text style={{ color: fg, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  eyebrow: { fontFamily: fonts.regular, fontSize: 12, opacity: 0.75, marginBottom: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  button: { borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: spacing.lg, alignItems: 'center', borderWidth: 1 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15 },
  label: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 16 },
  hint: { fontFamily: fonts.regular, fontSize: 12 },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  message: { borderRadius: radius.md, padding: spacing.md },
});
