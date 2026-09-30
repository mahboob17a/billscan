import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, ScreenHeader } from '@/components/ui';
import { LEGAL_DOCS, LEGAL_ORDER } from '@/legal/documents';
import { isoToDmy } from '@/lib/billForm';
import { cameraState, openAppSettings, PermState, photosState, requestCamera, requestPhotos } from '@/lib/permissions';
import { useOnboarding } from '@/state/onboarding';
import { fonts, spacing, useThemeColors } from '@/theme';

const LABEL: Record<PermState, string> = {
  granted: 'Allowed',
  denied: 'Not allowed',
  blocked: 'Blocked',
  undetermined: 'Not asked yet',
  'not-needed': 'Not needed',
};

/** Settings → Legal and permissions. */
export default function LegalAndPermissions() {
  const c = useThemeColors();
  const consent = useOnboarding((s) => s.consent);
  const [camera, setCamera] = useState<PermState>('undetermined');
  const [photos, setPhotos] = useState<PermState>('undetermined');

  const refresh = useCallback(() => {
    cameraState().then(setCamera);
    photosState().then(setPhotos);
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const permRow = (icon: 'camera-outline' | 'image-multiple-outline', title: string, state: PermState, ask: () => Promise<PermState>, set: (s: PermState) => void, first?: boolean) => (
    <View style={[styles.row, { borderTopColor: c.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <MaterialCommunityIcons name={icon} size={22} color={c.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.t, { color: c.text }]}>{title}</Text>
        <Text style={{ color: state === 'granted' || state === 'not-needed' ? c.success : c.warning, fontFamily: fonts.regular, fontSize: 12 }}>{LABEL[state]}</Text>
      </View>
      {state !== 'granted' && state !== 'not-needed' ? (
        <Pressable onPress={async () => set(await ask())} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: c.primary, fontFamily: fonts.semibold }}>{state === 'blocked' ? 'Settings' : 'Allow'}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        eyebrow="Settings"
        title="Legal and permissions"
        right={
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={c.onBar} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.h2, { color: c.textMuted }]}>DOCUMENTS</Text>
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {LEGAL_ORDER.map((id, i) => (
            <Pressable
              key={id}
              onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: id } })}
              accessibilityRole="button"
              style={[styles.row, { borderTopColor: c.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.t, { color: c.text }]}>{LEGAL_DOCS[id].title}</Text>
                <Text style={{ color: c.textMuted, fontFamily: fonts.regular, fontSize: 12 }}>{LEGAL_DOCS[id].summary}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={c.textMuted} />
            </Pressable>
          ))}
        </Card>
        {consent ? (
          <Text style={[styles.note, { color: c.textMuted }]}>
            You accepted these documents on {isoToDmy(consent.acceptedAt.slice(0, 10))} (version {consent.version}).
          </Text>
        ) : null}

        <Text style={[styles.h2, { color: c.textMuted }]}>PERMISSIONS</Text>
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {permRow('camera-outline', 'Camera — scan bills', camera, requestCamera, setCamera, true)}
          {permRow('image-multiple-outline', 'Photos — add a bill photo', photos, requestPhotos, setPhotos)}
        </Card>
        <Pressable onPress={openAppSettings} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: c.primary, fontFamily: fonts.medium, fontSize: 14 }}>Open phone settings for BillScan</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  h2: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12 },
  t: { fontFamily: fonts.medium, fontSize: 15 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
});
