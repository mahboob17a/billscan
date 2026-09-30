/** Records the accepted legal version on the server (once per user and version). */
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ConsentRecord } from '@/state/onboarding';
import { supabase } from './supabase';

const syncedKey = (userId: string, version: string) => `billscan.consent_synced.${userId}.${version}`.replace(/[^A-Za-z0-9._-]/g, '_');

export async function syncConsent(userId: string, consent: ConsentRecord | null): Promise<void> {
  if (!consent) return;
  const key = syncedKey(userId, consent.version);
  try {
    if ((await SecureStore.getItemAsync(key)) === '1') return;
    const { error } = await supabase.from('user_consents').insert({
      user_id: userId,
      version: consent.version,
      accepted_at: consent.acceptedAt,
      documents: 'guide,privacy,disclaimer',
      app_version: `${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`,
      platform: `${Platform.OS} ${Platform.Version}`,
    });
    // 23505 = already recorded (unique user + version)
    if (!error || error.code === '23505') await SecureStore.setItemAsync(key, '1');
  } catch {
    // Offline: try again next start.
  }
}
