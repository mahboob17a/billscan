import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { offerBiometric } from '@/auth/offerBiometric';
import { AuthShell, OrDivider, ProviderButton, TextLink } from '@/components/AuthShell';
import { Button, Field, Message } from '@/components/ui';
import {
  AuthOptions,
  fetchAuthOptions,
  OAuthProvider,
  resendConfirmation,
  signInWithProvider,
  signUpWithEmail,
  validateEmail,
  validatePassword,
} from '@/lib/authFlows';
import { fonts, spacing, useThemeColors } from '@/theme';


/** Create an account with name, email and password — or with Google / Apple. */
export default function SignUp() {
  const c = useThemeColors();
  const { setBiometric } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<'email' | OAuthProvider | 'resend' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [options, setOptions] = useState<AuthOptions>({ google: false, apple: false, signUp: true });

  useEffect(() => {
    let alive = true;
    fetchAuthOptions().then((o) => alive && setOptions(o));
    return () => {
      alive = false;
    };
  }, []);

  async function onCreate() {
    setError(null);
    if (name.trim().length < 2) return setError('Enter your full name, as it should appear on the report.');
    const e = validateEmail(email) ?? validatePassword(password);
    if (e) return setError(e);
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy('email');
    const res = await signUpWithEmail(name, email, password);
    setBusy(null);
    if (res.error) return setError(res.error);
    if (res.needsConfirmation) setSentTo(email.trim().toLowerCase());
    // Otherwise the account is signed in straight away and the app moves on by itself.
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

  async function onResend() {
    if (!sentTo) return;
    setBusy('resend');
    const err = await resendConfirmation(sentTo);
    setBusy(null);
    setError(err);
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${sentTo}.`} back>
        <Message tone="info" text="Open the email on this phone and tap the link. BillScan opens and signs you in automatically." />
        {error ? <Message tone="error" text={error} /> : null}
        <Button label="Send the email again" kind="secondary" onPress={onResend} busy={busy === 'resend'} />
        <TextLink label="Back to sign in" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  const social = options.google || options.apple;

  return (
    <AuthShell title="Create your account" subtitle="Your name and designation appear as “Prepared By” on the monthly report." back>
      {options.google ? <ProviderButton provider="google" onPress={() => onProvider('google')} busy={busy === 'google'} disabled={busy !== null} /> : null}
      {options.apple ? <ProviderButton provider="apple" onPress={() => onProvider('apple')} busy={busy === 'apple'} disabled={busy !== null} /> : null}
      {social ? <OrDivider /> : null}

      <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="Mahboob Alam Ansari" />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        placeholder="name@company.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="At least 8 characters"
        hint="Use letters and numbers."
      />
      <Field
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Type it again"
        returnKeyType="go"
        onSubmitEditing={onCreate}
      />
      {error ? <Message tone="error" text={error} /> : null}
      <Button label="Create account" onPress={onCreate} busy={busy === 'email'} disabled={busy !== null && busy !== 'email'} />
      <View style={styles.row}>
        <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 14 }}>Already have an account?</Text>
        <TextLink label="Sign in" onPress={() => router.replace('/login')} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.sm },
});
