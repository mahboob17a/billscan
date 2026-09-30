import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AuthShell, TextLink } from '@/components/AuthShell';
import { Message } from '@/components/ui';
import { completeAuthFromUrl } from '@/lib/authFlows';
import { useThemeColors } from '@/theme';

/**
 * Landing page for billscan://auth-callback?code=… — the email-confirmation link, or a
 * Google / Apple sign-in that came back through the phone's browser. Once the session
 * exists, the app's route guards move on to the welcome screen by themselves.
 */
export default function AuthCallback() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(params.error_description ?? params.error ?? null);

  useEffect(() => {
    if (!params.code) return;
    let alive = true;
    completeAuthFromUrl(`billscan://auth-callback?code=${encodeURIComponent(params.code)}`).then((err) => {
      if (!alive) return;
      if (err) setError(err);
      else router.replace('/');
    });
    return () => {
      alive = false;
    };
  }, [params.code]);

  if (error || !params.code) {
    return (
      <AuthShell title="Could not sign you in">
        <Message tone="error" text={error ?? 'This link is incomplete. Try signing in again.'} />
        <TextLink label="Back to sign in" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Signing you in…">
      <ActivityIndicator color={c.primary} />
    </AuthShell>
  );
}
