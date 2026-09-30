import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { offerBiometric } from '@/auth/offerBiometric';
import { AuthShell, OrDivider, ProviderButton, TextLink } from '@/components/AuthShell';
import { Button, Field, Message } from '@/components/ui';
import { AuthOptions, fetchAuthOptions, OAuthProvider, signInWithProvider } from '@/lib/authFlows';
import { fonts, spacing, useThemeColors } from '@/theme';

export default function Login() {
  const c = useThemeColors();
  const { signIn, setBiometric } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'password' | OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<AuthOptions>({ google: false, apple: false, signUp: true });

  useEffect(() => {
    let alive = true;
    fetchAuthOptions().then((o) => alive && setOptions(o));
    return () => {
      alive = false;
    };
  }, []);

  async function onSignIn() {
    setBusy('password');
    setError(null);
    const err = await signIn(id, password);
    setBusy(null);
    if (err) return setError(err);
    await offerBiometric(setBiometric);
  }

  async function onProvider(p: OAuthProvider) {
    setBusy(p);
    setError(null);
    const err = await signInWithProvider(p);
    setBusy(null);
    if (err === 'cancelled') return;
    if (err) return setError(err);
    await offerBiometric(setBiometric);
  }

  const social = options.google || options.apple;

  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Sign in to scan bills and build your monthly report.">
      {options.google ? <ProviderButton provider="google" onPress={() => onProvider('google')} busy={busy === 'google'} disabled={busy !== null} /> : null}
      {options.apple ? <ProviderButton provider="apple" onPress={() => onProvider('apple')} busy={busy === 'apple'} disabled={busy !== null} /> : null}
      {social ? <OrDivider /> : null}

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
      <TextLink label="Forgot password?" align="flex-end" onPress={() => router.push('/forgot-password')} />

      {error ? <Message tone="error" text={error} /> : null}
      <Button label="Sign in" onPress={onSignIn} busy={busy === 'password'} disabled={busy !== null && busy !== 'password'} />

      {options.signUp ? (
        <View style={styles.signup}>
          <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 14 }}>New to BillScan?</Text>
          <TextLink label="Create an account" onPress={() => router.push('/signup')} />
        </View>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  show: { position: 'absolute', right: 12, top: 34 },
  signup: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.sm },
});
