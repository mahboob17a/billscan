import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Card, Field, Message, ScreenHeader } from '@/components/ui';
import { updateOwnProfile } from '@/lib/supabase';
import { fonts, spacing, useThemeColors } from '@/theme';

export default function Settings() {
  const c = useThemeColors();
  const { session, profile, biometricEnabled, setBiometric, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.fullName ?? '');
  const [designation, setDesignation] = useState(profile?.designation ?? '');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    if (!session) return;
    if (!name.trim()) return setMsg({ tone: 'error', text: 'Enter your name.' });
    setBusy(true);
    const err = await updateOwnProfile(session.user.id, name.trim(), designation.trim());
    setBusy(false);
    if (err) return setMsg({ tone: 'error', text: err });
    await refreshProfile();
    setEditing(false);
    setMsg({ tone: 'success', text: 'Saved.' });
  }

  async function toggleBiometric(on: boolean) {
    setMsg(null);
    const err = await setBiometric(on);
    if (err) setMsg({ tone: 'error', text: err });
  }

  function confirmSignOut() {
    Alert.alert('Sign out of BillScan?', 'Your bills stay saved on this phone. You will need your password to sign in again.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader eyebrow={session?.user.email ?? ''} title="Settings" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {msg ? <Message tone={msg.tone} text={msg.text} /> : null}

        <Text style={[styles.h2, { color: c.textMuted }]}>ACCOUNT</Text>
        <Card>
          {editing ? (
            <>
              <Field label="Full name" value={name} onChangeText={setName} />
              <Field label="Designation" value={designation} onChangeText={setDesignation} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Cancel" kind="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} />
                <Button label="Save" onPress={saveProfile} busy={busy} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <Text style={{ color: c.text, fontFamily: fonts.semibold, fontSize: 17 }}>{profile?.fullName || 'Name not set'}</Text>
              <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 14 }}>
                {profile?.designation ?? ''} · {profile?.role === 'admin' ? 'Admin' : 'Supervisor'}
              </Text>
              <Pressable
                onPress={() => {
                  setName(profile?.fullName ?? '');
                  setDesignation(profile?.designation ?? '');
                  setEditing(true);
                }}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={{ color: c.primary, fontFamily: fonts.medium, fontSize: 14 }}>Edit name and designation</Text>
              </Pressable>
            </>
          )}
        </Card>

        <Text style={[styles.h2, { color: c.textMuted }]}>SECURITY</Text>
        <Card>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontFamily: fonts.medium, fontSize: 15 }}>Unlock with fingerprint / Face ID</Text>
              <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 12 }}>
                Asks at start-up and after 5 minutes in the background.
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ true: c.primary, false: c.border }}
              thumbColor={c.surface}
              accessibilityLabel="Unlock with fingerprint or Face ID"
            />
          </View>
        </Card>

        <Text style={[styles.h2, { color: c.textMuted }]}>REPORT</Text>
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          <LinkRow icon="file-document-edit-outline" label="Report header" detail="Prepared by, submitted to, reference" onPress={() => router.push('/report-settings')} first />
          <LinkRow icon="stethoscope" label="System check" detail="Test the server and AI connection" onPress={() => router.push('/system-check')} />
        </Card>

        <Button label="Sign out" kind="danger" onPress={confirmSignOut} style={{ marginTop: spacing.sm }} />
        <Text style={[styles.version, { color: c.textMuted }]}>
          BillScan {Application.nativeApplicationVersion ?? ''} ({Application.nativeBuildVersion ?? 'dev'})
        </Text>
      </ScrollView>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  detail,
  onPress,
  first,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  detail: string;
  onPress: () => void;
  first?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.linkRow, { borderTopColor: c.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={c.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontFamily: fonts.medium, fontSize: 15 }}>{label}</Text>
        <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 12 }}>{detail}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={c.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  h2: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8, marginTop: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12 },
  version: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.md },
});
