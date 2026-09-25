import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Card, Message, ScreenHeader } from '@/components/ui';
import { createBackup, pickBackup, restoreBackup, shareBackup } from '@/backup/backup';
import { isoToDmy } from '@/lib/billForm';
import { logError } from '@/lib/errorLog';
import { useMonthStore } from '@/state/month';
import { fonts, spacing, useThemeColors } from '@/theme';

/** Settings → Backup: all months, bills, cash entries and photos in one file. */
export default function Backup() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const touch = useMonthStore((s) => s.touch);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);

  async function onBackup() {
    setMsg(null);
    setBusy('backup');
    try {
      const res = await createBackup(userId, session?.user.email ?? '');
      const n = res.manifest.counts;
      setMsg({
        tone: 'success',
        text: `Backup ready: ${n.months} ${n.months === 1 ? 'month' : 'months'}, ${n.bills} bills, ${n.photos} photos, ${n.cash} cash entries. Save it to Google Drive or email it to yourself.`,
      });
      await shareBackup(res.uri, res.fileName);
    } catch (e) {
      logError(e, { where: 'backup.create' });
      setMsg({ tone: 'error', text: `Backup failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    setMsg(null);
    setBusy('restore');
    try {
      const picked = await pickBackup();
      if (!picked) return;
      const m = picked.manifest;
      const otherUser = m.userId !== userId;
      Alert.alert(
        'Restore this backup?',
        `Made ${isoToDmy(m.createdAt.slice(0, 10))} by ${m.email || 'unknown'}: ${m.counts.months} months, ${m.counts.bills} bills, ${m.counts.photos} photos.\n\n` +
          (otherUser ? 'This backup belongs to a different account. Its bills will be added to your account.\n\n' : '') +
          'Bills already on this phone are kept. A bill that is in both is replaced by the backup copy.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              setBusy('restore');
              try {
                const res = await restoreBackup(userId, picked);
                touch();
                setMsg({ tone: 'success', text: `Restored ${res.bills} bills and ${res.photos} photos.` });
              } catch (e) {
                logError(e, { where: 'backup.restore' });
                setMsg({ tone: 'error', text: `Restore failed: ${e instanceof Error ? e.message : String(e)}` });
              } finally {
                setBusy(null);
              }
            },
          },
        ],
      );
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy((b) => (b === 'restore' ? null : b));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        eyebrow="Settings"
        title="Backup and restore"
        right={
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={c.onBar} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Text style={[styles.h2, { color: c.text }]}>Back up everything</Text>
          <Text style={[styles.p, { color: c.textMuted }]}>
            One file with every month, bill, bill photo, cash entry, your description list and report header. Keep it on Google
            Drive or in your email so a lost or new phone loses nothing. Do this at least once a week.
          </Text>
          <Button
            label="Create backup file"
            onPress={onBackup}
            busy={busy === 'backup'}
            disabled={busy !== null}
            icon={<MaterialCommunityIcons name="cloud-upload-outline" size={20} color={c.onPrimary} />}
          />
        </Card>
        <Card>
          <Text style={[styles.h2, { color: c.text }]}>Restore from a backup</Text>
          <Text style={[styles.p, { color: c.textMuted }]}>
            Choose a BillScan backup file (.zip) from Drive, email or Downloads. Bills already on this phone stay; bills from the backup
            are added back with their photos.
          </Text>
          <Button
            label="Choose backup file"
            kind="secondary"
            onPress={onRestore}
            busy={busy === 'restore'}
            disabled={busy !== null}
            icon={<MaterialCommunityIcons name="cloud-download-outline" size={20} color={c.text} />}
          />
        </Card>
        {msg ? <Message tone={msg.tone} text={msg.text} /> : null}
        <Text style={[styles.note, { color: c.textMuted }]}>
          The backup does not contain your password or the AI key. Anyone with the file can see your bills, so keep it in your own Drive or email.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  h2: { fontFamily: fonts.semibold, fontSize: 16 },
  p: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
});
