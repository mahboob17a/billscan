/**
 * First-run onboarding: consent to the User Guide, Privacy Policy and Disclaimer
 * (per LEGAL_VERSION), then the permissions screen. Stored on this phone; the consent is
 * also recorded on the server after sign-in (see src/lib/consent.ts).
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { LEGAL_VERSION } from '@/legal/documents';

const CONSENT_KEY = 'billscan.consent';
const PERMISSIONS_KEY = 'billscan.permissions_seen';

export interface ConsentRecord {
  version: string;
  acceptedAt: string; // ISO
}

interface OnboardingState {
  loaded: boolean;
  consent: ConsentRecord | null;
  permissionsSeen: boolean;
  load: () => Promise<void>;
  accept: () => Promise<void>;
  finishPermissions: () => Promise<void>;
}

export const useOnboarding = create<OnboardingState>((set) => ({
  loaded: false,
  consent: null,
  permissionsSeen: false,
  load: async () => {
    let consent: ConsentRecord | null = null;
    let permissionsSeen = false;
    try {
      const raw = await SecureStore.getItemAsync(CONSENT_KEY);
      consent = raw ? (JSON.parse(raw) as ConsentRecord) : null;
      permissionsSeen = (await SecureStore.getItemAsync(PERMISSIONS_KEY)) === '1';
    } catch {
      // Unreadable storage: show onboarding again.
    }
    set({ loaded: true, consent, permissionsSeen });
  },
  accept: async () => {
    const consent: ConsentRecord = { version: LEGAL_VERSION, acceptedAt: new Date().toISOString() };
    await SecureStore.setItemAsync(CONSENT_KEY, JSON.stringify(consent));
    set({ consent });
  },
  finishPermissions: async () => {
    await SecureStore.setItemAsync(PERMISSIONS_KEY, '1');
    set({ permissionsSeen: true });
  },
}));

/** True until the current documents are accepted and the permissions screen has been seen. */
export function needsOnboarding(s: Pick<OnboardingState, 'consent' | 'permissionsSeen'>): boolean {
  return s.consent?.version !== LEGAL_VERSION || !s.permissionsSeen;
}
