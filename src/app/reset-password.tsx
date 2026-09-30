import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { AuthShell, TextLink } from '@/components/AuthShell';
import { Button, Field, Message } from '@/components/ui';
import { completeAuthFromUrl, setNewPassword, validatePassword } from '@/lib/authFlows';
import { useThemeColors } from '@/theme';

/**
 * Choose a new password. Opened two ways:
 *  - from the forgot-password email (billscan://reset-password?code=…), which signs in first;
 *  - from Settings → Change password, when already signed in.
 */
export default function ResetPassword() {
  const c = useThemeColors();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [linkError, setLinkError] = useState<string | null>(params.error_description ?? null);
  const [exchanging, setExchanging] = useState(Boolean(params.code));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!params.code) return;
    let alive = true;
    completeAuthFromUrl(`billscan://reset-password?code=${encodeURIComponent(params.code)}`).then((err) => {
      if (!alive) return;
      if (err) setLinkError(err);
      setExchanging(false);
    });
    return () => {
      alive = false;
    };
  }, [params.code]);

  async function onSave() {
    setError(null);
    const e = validatePassword(password);
    if (e) return setError(e);
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    const err = await setNewPassword(password);
    setBusy(false);
    if (err) return setError(err);
    setDone(true);
  }

  if (exchanging) {
    return (
      <AuthShell title="Opening your reset link…">
        <ActivityIndicator color={c.primary} />
      </AuthShell>
    );
  }

  if (linkError || !session) {
    return (
      <AuthShell title="Link not valid" back>
        <Message tone="error" text={linkError ?? 'This reset link has expired or was opened on another phone.'} />
        <Button label="Send a new link" onPress={() => router.replace('/forgot-password')} />
        <TextLink label="Back to sign in" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password changed">
        <Message tone="success" text="Your new password is saved. Use it next time you sign in." />
        <Button label="Continue" onPress={() => router.replace('/')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle={session.user.email ? `For ${session.user.email}` : undefined} back>
      <Field
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="At least 8 characters"
        hint="Use letters and numbers."
      />
      <Field
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Type it again"
        returnKeyType="go"
        onSubmitEditing={onSave}
      />
      {error ? <Message tone="error" text={error} /> : null}
      <Button label="Save new password" onPress={onSave} busy={busy} />
    </AuthShell>
  );
}
