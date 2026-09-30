import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text } from 'react-native';
import { GradientButton, ON, OnbScreen, PermissionRow, StepHeader } from '@/components/onboarding';
import { cameraState, PermState, photosState, requestCamera, requestPhotos } from '@/lib/permissions';
import { useOnboarding } from '@/state/onboarding';
import { fonts, spacing } from '@/theme';

/** Onboarding step 3: explain and ask for the permissions BillScan needs. */
export default function Permissions() {
  const finish = useOnboarding((s) => s.finishPermissions);
  const [camera, setCamera] = useState<PermState>('undetermined');
  const [photos, setPhotos] = useState<PermState>('undetermined');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    cameraState().then(setCamera);
    photosState().then(setPhotos);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  // Coming back from phone Settings: read the new state.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  async function onContinue() {
    setBusy(true);
    // Ask for anything not asked yet, so nothing interrupts the first scan later.
    if (camera === 'undetermined') setCamera(await requestCamera());
    if (photos === 'undetermined') setPhotos(await requestPhotos());
    await finish();
    setBusy(false);
  }

  return (
    <OnbScreen footer={<GradientButton label="Continue" icon="arrow-right" onPress={onContinue} busy={busy} />}>
      <ScrollView contentContainerStyle={styles.body}>
        <StepHeader step={2} of={2} title="Allow access" subtitle="BillScan only uses these to scan and store your bills. Nothing is taken without you tapping a button." />
        <PermissionRow icon="scan" title="Camera" reason="To photograph and scan purchase bills." state={camera} onAllow={async () => setCamera(await requestCamera())} />
        <PermissionRow
          icon="photos"
          title="Photos"
          reason="To add a bill you have already photographed. You choose each photo; BillScan never looks through your gallery."
          state={photos}
          onAllow={async () => setPhotos(await requestPhotos())}
        />
        <PermissionRow
          icon="files"
          title="Files and storage"
          reason="Bills, photos and reports are saved inside BillScan. You pick where to share a report or which backup to restore."
          state="not-needed"
        />
        <PermissionRow icon="internet" title="Internet" reason="To sign in and to read bills with AI. Without signal, scans wait and are read later." state="auto" />
        <PermissionRow icon="fingerprint" title="Fingerprint / face unlock" reason="Optional quick unlock that keeps your bills private." state="later" />
        <Text style={styles.small}>You can change these any time in your phone’s Settings → Apps → BillScan → Permissions.</Text>
      </ScrollView>
    </OnbScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingTop: spacing.xl },
  small: { color: ON.sub, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, opacity: 0.8 },
});
