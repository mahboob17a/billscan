import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Logo } from '@/components/Logo';
import { Button, Message } from '@/components/ui';
import { fonts, spacing, useThemeColors } from '@/theme';

/** Shown when app lock is on: at start-up and after 5 minutes in the background. */
export default function Lock() {
  const c = useThemeColors();
  const { unlock, signOut, profile } = useAuth();
  const [failed, setFailed] = useState(false);

  async function tryUnlock() {
    setFailed(!(await unlock()));
  }

  // Prompt once automatically when the screen opens.
  useEffect(() => {
    let alive = true;
    unlock().then((ok) => {
      if (alive) setFailed(!ok);
    });
    return () => {
      alive = false;
    };
  }, [unlock]);

  return (
    <View style={[styles.root, { backgroundColor: c.bar }]}>
      <Logo size={64} />
      <Text style={[styles.name, { color: c.onBar }]}>BillScan is locked</Text>
      {profile ? <Text style={[styles.sub, { color: c.onBar }]}>{profile.fullName}</Text> : null}
      <View style={styles.actions}>
        {failed ? <Message tone="error" text="Not recognised. Try again, or use your phone PIN." /> : null}
        <Button
          label="Unlock"
          onPress={tryUnlock}
          icon={<MaterialCommunityIcons name="fingerprint" size={20} color={c.onPrimary} />}
        />
        <Button label="Sign in with password instead" kind="secondary" onPress={signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  name: { fontFamily: fonts.semibold, fontSize: 20, marginTop: spacing.md },
  sub: { fontFamily: fonts.regular, fontSize: 14, opacity: 0.75 },
  actions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.xxl },
});
