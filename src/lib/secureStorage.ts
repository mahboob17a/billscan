import * as SecureStore from 'expo-secure-store';

/**
 * Storage adapter for the Supabase session, backed by the phone's secure
 * keychain/keystore. SecureStore values are limited to about 2 KB, so long
 * values are split into chunks: `<key>.n` holds the chunk count and
 * `<key>.0`, `<key>.1`, … hold the pieces.
 */
const CHUNK = 1800;
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safe(key);
    const n = await SecureStore.getItemAsync(`${k}.n`);
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(n); i++) {
      const p = await SecureStore.getItemAsync(`${k}.${i}`);
      if (p === null) return null; // incomplete write; treat as signed out
      parts.push(p);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const k = safe(key);
    const old = Number((await SecureStore.getItemAsync(`${k}.n`)) ?? 0);
    const count = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${k}.n`, String(count));
    for (let i = count; i < old; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
  },

  async removeItem(key: string): Promise<void> {
    const k = safe(key);
    const n = Number((await SecureStore.getItemAsync(`${k}.n`)) ?? 0);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};

// ── Device preferences (not secret, but kept alongside) ──────────────────

const BIOMETRIC_KEY = 'billscan.biometric_enabled';
const BIOMETRIC_ASKED_KEY = 'billscan.biometric_asked';

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === '1';
}
export async function setBiometricEnabled(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, on ? '1' : '0');
  await SecureStore.setItemAsync(BIOMETRIC_ASKED_KEY, '1');
}
export async function wasBiometricOffered(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_ASKED_KEY)) === '1';
}
