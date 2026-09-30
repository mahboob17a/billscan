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
const REPORT_SETUP_KEY = 'billscan.report_setup_done';

export interface ConsentRecord {
  version: string;
  acceptedAt: string; // ISO
}

interface OnboardingState {
  loaded: boolean;
  consent: ConsentRecord | null;
  permissionsSeen: boolean;
  /** The report header has been set up once after the first sign-in on this phone. */
  reportSetupDone: boolean;
  load: () => Promise<void>;
  accept: () => Promise<void>;
  finishPermissions: () => Promise<void>;
  finishReportSetup: () => Promise<void>;
  /**
   * "Create an account": a new user goes through intro → consent → permissions → sign-up
   * form, even on a phone where someone already accepted before.
   */
  registering: boolean;
  /** This phone's onboarding was just completed in this app session (no need to repeat it). */
  onboardedNow: boolean;
  startRegistration: () => Promise<void>;
  cancelRegistration: () => Promise<void>;
  endRegistration: () => void;
}

// What was stored before "Create an account" reset it, so "Back to sign in" can restore it.
let saved: { consent: ConsentRecord | null; permissionsSeen: boolean; reportSetupDone: boolean } | null = null;

async function writeFlags(consent: ConsentRecord | null, permissionsSeen: boolean, reportSetupDone: boolean) {
  try {
    if (consent) await SecureStore.setItemAsync(CONSENT_KEY, JSON.stringify(consent));
    else await SecureStore.deleteItemAsync(CONSENT_KEY);
    if (permissionsSeen) await SecureStore.setItemAsync(PERMISSIONS_KEY, '1');
    else await SecureStore.deleteItemAsync(PERMISSIONS_KEY);
    if (reportSetupDone) await SecureStore.setItemAsync(REPORT_SETUP_KEY, '1');
    else await SecureStore.deleteItemAsync(REPORT_SETUP_KEY);
  } catch {
    // Storage errors only mean onboarding may be shown again.
  }
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  registering: false,
  onboardedNow: false,
  loaded: false,
  consent: null,
  permissionsSeen: false,
  reportSetupDone: false,
  load: async () => {
    let consent: ConsentRecord | null = null;
    let permissionsSeen = false;
    let reportSetupDone = false;
    try {
      const raw = await SecureStore.getItemAsync(CONSENT_KEY);
      consent = raw ? (JSON.parse(raw) as ConsentRecord) : null;
      permissionsSeen = (await SecureStore.getItemAsync(PERMISSIONS_KEY)) === '1';
      reportSetupDone = (await SecureStore.getItemAsync(REPORT_SETUP_KEY)) === '1';
    } catch {
      // Unreadable storage: show onboarding again.
    }
    set({ loaded: true, consent, permissionsSeen, reportSetupDone });
  },
  accept: async () => {
    const consent: ConsentRecord = { version: LEGAL_VERSION, acceptedAt: new Date().toISOString() };
    await SecureStore.setItemAsync(CONSENT_KEY, JSON.stringify(consent));
    set({ consent });
  },
  finishPermissions: async () => {
    await SecureStore.setItemAsync(PERMISSIONS_KEY, '1');
    set({ permissionsSeen: true, onboardedNow: true });
  },
  finishReportSetup: async () => {
    set({ reportSetupDone: true });
    await SecureStore.setItemAsync(REPORT_SETUP_KEY, '1').catch(() => {});
  },
  startRegistration: async () => {
    const { consent, permissionsSeen, reportSetupDone } = get();
    saved = { consent, permissionsSeen, reportSetupDone };
    // The new user also sets up their own report header after the first sign-in.
    set({ registering: true, consent: null, permissionsSeen: false, reportSetupDone: false });
    await writeFlags(null, false, false);
  },
  cancelRegistration: async () => {
    const back = saved ?? { consent: null, permissionsSeen: false, reportSetupDone: false };
    saved = null;
    set({ registering: false, ...back });
    await writeFlags(back.consent, back.permissionsSeen, back.reportSetupDone);
  },
  endRegistration: () => {
    saved = null;
    set({ registering: false });
  },
}));

/** True until the current documents are accepted and the permissions screen has been seen. */
export function needsOnboarding(s: Pick<OnboardingState, 'consent' | 'permissionsSeen'>): boolean {
  return s.consent?.version !== LEGAL_VERSION || !s.permissionsSeen;
}
