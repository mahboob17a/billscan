import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { biometricAvailable, useAuth } from '@/auth/AuthProvider';
import { Logo } from '@/components/Logo';
import { Button, Field, Message } from '@/components/ui';
import { wasBiometricOffered, setBiometricEnabled } from '@/lib/secureStorage';
import { fonts, radius, spacing, useThemeColors } from '@/theme';

export default function Login() {
  const c = useThemeColors();
  const { signIn, setBiometric } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSignIn() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const err = await signIn(id, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    // First sign-in on this phone: offer quick unlock.
    if (!(await wasBiometricOffered()) && (await biometricAvailable())) {
      Alert.alert(
        'Unlock with fingerprint?',
        'Next time, open BillScan with your fingerprint or face instead of your password. The app also locks itself after 5 minutes in the background.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => setBiometricEnabled(false) },
          { text: 'Turn on', onPress: () => setBiometric(true) },
        ],
      );
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <SafeAreaView edges={['top']} style={[styles.top, { backgroundColor: c.bar }]}>
          <Logo size={56} />
          <Text style={[styles.name, { color: c.onBar }]}>BillScan</Text>
          <Text style={[styles.tagline, { color: c.onBar }]}>Purchase report automation</Text>
        </SafeAreaView>

        <View style={styles.form}>
          <Text style={[styles.heading, { color: c.text }]} accessibilityRole="header">
            Sign in
          </Text>
          <Field
            label="Email or employee ID"
            value={id}
            onChangeText={setId}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            placeholder="Enter email or employee ID"
            returnKeyType="next"
          />
          <View>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              placeholder="Enter password"
              returnKeyType="go"
              onSubmitEditing={onSignIn}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={styles.show}
              hitSlop={8}
            >
              <Text style={{ color: c.primary, fontFamily: fonts.medium, fontSize: 13 }}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              setError(null);
              setInfo('Ask your BillScan admin to set a new password for you, then sign in with it.');
            }}
            accessibilityRole="button"
            style={{ alignSelf: 'flex-end' }}
            hitSlop={8}
          >
            <Text style={{ color: c.primary, fontFamily: fonts.medium, fontSize: 13 }}>Forgot password?</Text>
          </Pressable>

          {error ? <Message tone="error" text={error} /> : null}
          {info ? <Message tone="info" text={info} /> : null}

          <Button label="Sign in" onPress={onSignIn} busy={busy} />
          <Text style={[styles.footer, { color: c.textMuted }]}>Daryas Trading & Contracting LLC · UTAS Nizwa O&M</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xl,
    borderBottomLeftRadius: radius.lg + 8,
    borderBottomRightRadius: radius.lg + 8,
  },
  name: { fontFamily: fonts.bold, fontSize: 26, marginTop: spacing.sm },
  tagline: { fontFamily: fonts.regular, fontSize: 13, opacity: 0.75 },
  form: { padding: spacing.lg, gap: spacing.md, flex: 1 },
  heading: { fontFamily: fonts.semibold, fontSize: 20 },
  show: { position: 'absolute', right: 12, top: 34 },
  footer: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, marginTop: 'auto', paddingTop: spacing.xl },
});
