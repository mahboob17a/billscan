import { useFonts } from 'expo-font';
import { ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { BrandSplash } from '@/components/BrandSplash';
import { LEGAL_VERSION } from '@/legal/documents';
import { syncConsent } from '@/lib/consent';
import { needsOnboarding, useOnboarding } from '@/state/onboarding';
import { getDb } from '@/db';
import { useAiQueue } from '@/lib/aiQueue';
import { flushErrors, installGlobalErrorHandler, recordError } from '@/lib/errorLog';
import { useThemeColors } from '@/theme';
import { fontAssets } from '@/theme/fonts';

// Native splash (OpsNest logo on navy) stays until fonts load; then the animated
// OpsNest splash takes over until the database and saved sign-in have been checked.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });
installGlobalErrorHandler();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);

  const onboardingLoaded = useOnboarding((s) => s.loaded);
  useEffect(() => {
    useOnboarding.getState().load();
  }, []);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((e) => setDbError(e instanceof Error ? e.message : String(e)));
  }, []);

  const [authReady, setAuthReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const onAuthReady = useCallback(() => setAuthReady(true), []);
  const onSplashDone = useCallback(() => setSplashDone(true), []);

  if (!(fontsLoaded || fontError)) return null;

  const appReady = Boolean(dbError) || (dbReady && authReady && onboardingLoaded);
  return (
    <View style={{ flex: 1, backgroundColor: '#0B1B34' }}>
      <StatusBar style="light" />
      {dbError ? (
        <StartupError message={dbError} />
      ) : dbReady && onboardingLoaded ? (
        <AuthProvider>
          <RootStack onReady={onAuthReady} />
        </AuthProvider>
      ) : null}
      {splashDone ? null : <BrandSplash ready={appReady} onDone={onSplashDone} />}
    </View>
  );
}

function RootStack({ onReady }: { onReady: () => void }) {
  const { initializing, session, locked, welcomePending } = useAuth();
  // Bills scanned offline are read by the AI when the phone is back online.
  useAiQueue(session && !locked ? session.user.id : undefined);
  const consent = useOnboarding((s) => s.consent);
  const onboarding = useOnboarding((s) => needsOnboarding(s));
  const reportSetupDone = useOnboarding((s) => s.reportSetupDone);
  useEffect(() => {
    if (session) flushErrors();
  }, [session]);
  // Keep a server-side record of which documents this user accepted.
  useEffect(() => {
    if (session) syncConsent(session.user.id, consent);
  }, [session, consent]);

  useEffect(() => {
    if (!initializing) onReady();
  }, [initializing, onReady]);

  if (initializing) return null;

  const signedIn = Boolean(session);
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      {/* First run (and whenever the legal documents change): intro, consent, permissions. */}
      {/* Only Screen / Protected children are allowed here — no fragments (expo-router crashes on them). */}
      <Stack.Protected guard={onboarding && consent?.version !== LEGAL_VERSION}>
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/consent" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={onboarding}>
        <Stack.Screen name="onboarding/permissions" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={!onboarding && !signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={!onboarding && signedIn && locked}>
        <Stack.Screen name="lock" />
      </Stack.Protected>
      {/* Only after a fresh sign-in; a returning user goes from the fingerprint straight to Home. */}
      <Stack.Protected guard={!onboarding && signedIn && !locked && welcomePending}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack.Protected>
      {/* Home and the rest of the app. Listed before report-settings so it is the landing screen. */}
      <Stack.Protected guard={!onboarding && signedIn && !locked && !welcomePending && reportSetupDone}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="system-check" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="bill/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="bills/[kind]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="descriptions" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="backup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="legal/index" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      {/* First sign-in on this phone: set up the report header, then Home. Also opened from Settings. */}
      <Stack.Protected guard={!onboarding && signedIn && !locked && !welcomePending}>
        <Stack.Screen name="report-settings" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      {/*
        Always reachable, and deliberately LAST: when a guard changes, expo-router opens the
        first screen in this list that is allowed, so these must never come first.
      */}
      <Stack.Screen name="legal/[doc]" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="auth-callback" />
      <Stack.Screen name="reset-password" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

function StartupError({ message }: { message: string }) {
  const c = useThemeColors();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', padding: 24, gap: 8 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>BillScan could not open its storage</Text>
      <Text style={{ color: c.textMuted, fontSize: 14 }}>
        Close the app fully and open it again. If this keeps happening, send this message to your admin: {message}
      </Text>
    </View>
  );
}

/** Shown instead of a screen that crashed; the error is saved and sent to the admin. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = useThemeColors();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    recordError(error, { where: 'ErrorBoundary' }, true).then(() => flushErrors());
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>Something went wrong on this screen</Text>
      <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20 }}>
        Your bills are safe. The problem has been reported. Tap Try again; if it keeps happening, close and reopen BillScan.
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 12 }} selectable>
        {error.message}
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={{ backgroundColor: c.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
      >
        <Text style={{ color: c.onPrimary, fontSize: 15, fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}
