import { router } from 'expo-router';
import { useState } from 'react';
import { AuthShell, TextLink } from '@/components/AuthShell';
import { Button, Field, Message } from '@/components/ui';
import { sendPasswordReset, validateEmail } from '@/lib/authFlows';

/** Email a password-reset link that opens BillScan on this phone. */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSend() {
    setError(null);
    const e = validateEmail(email);
    if (e) return setError(e);
    setBusy(true);
    const err = await sendPasswordReset(email);
    setBusy(false);
    if (err) return setError(err);
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`If an account exists for ${email.trim().toLowerCase()}, a reset link is on its way.`} back>
        <Message tone="info" text="Open the email on this phone and tap the link. BillScan opens so you can choose a new password. The link works once and expires after about an hour." />
        <Button label="Send again" kind="secondary" onPress={onSend} busy={busy} />
        <TextLink label="Back to sign in" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" subtitle="Enter the email of your BillScan account. We'll send you a link to set a new password." back>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        placeholder="name@company.com"
        returnKeyType="send"
        onSubmitEditing={onSend}
      />
      {error ? <Message tone="error" text={error} /> : null}
      <Button label="Send reset link" onPress={onSend} busy={busy} />
      <Message
        tone="info"
        text="Signed up with Google or Apple? You don't have a BillScan password — use “Continue with Google / Apple” instead. Signing in with an employee ID? Ask your admin."
      />
    </AuthShell>
  );
}
