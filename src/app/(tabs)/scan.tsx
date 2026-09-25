import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import DocumentScanner, { ResponseType, ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin';
import { useAuth } from '@/auth/AuthProvider';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Button, Card, Message, ScreenHeader } from '@/components/ui';
import { createBill, EMPTY_DRAFT, setAiStatus, updateBill } from '@/db/bills';
import { descriptionsBySection, listDescriptions } from '@/db/repo';
import { prepareBillImages } from '@/lib/billImages';
import { draftFromExtraction } from '@/lib/billRules';
import { isOnline } from '@/lib/aiQueue';
import { logError } from '@/lib/errorLog';
import { extractBill } from '@/lib/extract';
import { monthLabel } from '@/lib/months';
import { useMonthStore } from '@/state/month';
import { fonts, spacing, useThemeColors } from '@/theme';

const MAX_PAGES = 3;

type Stage = 'idle' | 'saving' | 'reading';

/** Scan (or pick) a bill → store the photo → AI reads it → open the review screen. */
export default function Scan() {
  const c = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { month, touch } = useMonthStore();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  async function process(sources: string[]) {
    if (sources.length === 0) return;
    setError(null);
    const id = Crypto.randomUUID();
    try {
      setStage('saving');
      const pages = await prepareBillImages(id, sources.slice(0, MAX_PAGES));
      await createBill(userId, month, EMPTY_DRAFT, pages.map((p) => p.uri), null, id);
      touch();

      if (!(await isOnline())) {
        // Saved as "waiting for internet"; the queue reads it when signal returns.
        router.push({ pathname: '/bill/[id]', params: { id } });
        return;
      }
      setStage('reading');
      const labels = descriptionsBySection(await listDescriptions(userId));
      const result = await extractBill(
        pages.map((p) => p.base64),
        labels,
      );
      if (result.ok) {
        await updateBill(userId, id, draftFromExtraction(result.extraction), { extraction: result.extraction });
        touch();
        router.push({ pathname: '/bill/[id]', params: { id } });
      } else {
        if (!result.offline) await setAiStatus(userId, id, 'failed');
        router.push({ pathname: '/bill/[id]', params: result.offline ? { id } : { id, aiError: result.error } });
      }
    } catch (e) {
      logError(e, { where: 'scan.process' });
      setError(`Could not process the photo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setStage('idle');
    }
  }

  async function onCamera() {
    setError(null);
    try {
      const res = await DocumentScanner.scanDocument({
        maxNumDocuments: MAX_PAGES,
        croppedImageQuality: 90,
        responseType: ResponseType.ImageFilePath,
      });
      if (res.status === ScanDocumentResponseStatus.Cancel || !res.scannedImages?.length) return;
      await process(res.scannedImages);
    } catch (e) {
      logError(e, { where: 'scan.camera' });
      setError(`The camera scanner could not start: ${e instanceof Error ? e.message : String(e)}. Try "Choose from gallery".`);
    }
  }

  async function onGallery() {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PAGES,
      orderedSelection: true,
      quality: 1,
    });
    if (res.canceled) return;
    await process(res.assets.map((a) => a.uri));
  }

  async function onManual() {
    const id = await createBill(userId, month, EMPTY_DRAFT, [], null);
    touch();
    router.push({ pathname: '/bill/[id]', params: { id } });
  }

  const busy = stage !== 'idle';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader eyebrow={`Adding to ${monthLabel(month)}`} title="Scan bill" right={<MonthSwitcher />} />
      <ScrollView contentContainerStyle={styles.body}>
        {busy ? (
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md }}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={[styles.h2, { color: c.text }]}>{stage === 'saving' ? 'Saving the photo…' : 'Reading the bill…'}</Text>
            <Text style={[styles.p, { color: c.textMuted, textAlign: 'center' }]}>
              {stage === 'reading' ? 'The AI is reading the date, bill number and amounts. This takes about 5 seconds.' : ' '}
            </Text>
          </Card>
        ) : (
          <>
            <Card style={{ gap: spacing.md }}>
              <View style={styles.tipRow}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={c.highlight} />
                <Text style={[styles.p, { color: c.textMuted, flex: 1 }]}>
                  Lay the bill flat in good light. Make sure the date, bill number and totals are in the photo. A long bill can have up
                  to {MAX_PAGES} pages.
                </Text>
              </View>
            </Card>
            <Button
              label="Scan with camera"
              onPress={onCamera}
              icon={<MaterialCommunityIcons name="camera-document" size={20} color={c.onPrimary} />}
            />
            <Button
              label="Choose from gallery"
              kind="secondary"
              onPress={onGallery}
              icon={<MaterialCommunityIcons name="image-multiple-outline" size={20} color={c.text} />}
            />
            <Button
              label="Enter by hand (no photo)"
              kind="secondary"
              onPress={onManual}
              icon={<MaterialCommunityIcons name="keyboard-outline" size={20} color={c.text} />}
            />
          </>
        )}
        {error ? <Message tone="error" text={error} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  h2: { fontFamily: fonts.semibold, fontSize: 17 },
  p: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  tipRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
