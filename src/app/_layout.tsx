import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { getDb } from '@/db';
import { useThemeColors } from '@/theme';
import { fontAssets } from '@/theme/fonts';

// Keep the native splash (slate + BillScan mark) until fonts, the database
// and the saved sign-in have all been checked.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

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
  const { initializing, session, locked } = useAuth();

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
      <Stack.Protected guard={signedIn && !locked}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="system-check" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="report-settings" options={{ animation: 'slide_from_right' }} />
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
