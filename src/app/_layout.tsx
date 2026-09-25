import { useFonts } from 'expo-font';
import { ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { getDb } from '@/db';
import { useAiQueue } from '@/lib/aiQueue';
import { flushErrors, installGlobalErrorHandler, recordError } from '@/lib/errorLog';
import { useThemeColors } from '@/theme';
import { fontAssets } from '@/theme/fonts';

// Keep the native splash (slate + BillScan mark) until fonts, the database
// and the saved sign-in have all been checked.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });
installGlobalErrorHandler();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((e) => setDbError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (!(fontsLoaded || fontError) || !(dbReady || dbError)) return null;

  if (dbError) return <StartupError message={dbError} />;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { initializing, session, locked, welcomePending } = useAuth();
  // Bills scanned offline are read by the AI when the phone is back online.
  useAiQueue(session && !locked ? session.user.id : undefined);
  useEffect(() => {
    if (session) flushErrors();
  }, [session]);

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync().catch(() => {});
  }, [initializing]);

  if (initializing) return null;

  const signedIn = Boolean(session);
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && locked}>
        <Stack.Screen name="lock" />
      </Stack.Protected>
      {/* Welcome comes first after sign-in / app start; "Go to Month screen" clears the guard. */}
      <Stack.Protected guard={signedIn && !locked && welcomePending}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !locked && !welcomePending}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="system-check" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="report-settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="bill/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="bills/[kind]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="descriptions" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="backup" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
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
