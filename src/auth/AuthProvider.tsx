import type { Session } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ensureUserSetup } from '@/db/repo';
import { isBiometricEnabled, setBiometricEnabled } from '@/lib/secureStorage';
import { fetchProfile, Profile, resolveLoginEmail, signInErrorMessage, supabase } from '@/lib/supabase';

/** Lock the app after this long in the background (Blueprint: 5 minutes). */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

interface AuthState {
  /** True until the saved session and profile have been checked at start-up. */
  initializing: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Signed in, but must unlock with fingerprint / Face ID / phone PIN first. */
  locked: boolean;
  biometricEnabled: boolean;
  signIn: (emailOrEmployeeId: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometric: (on: boolean) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
  /** Show the welcome screen (after sign-in and on each fresh app start). */
  welcomePending: boolean;
  dismissWelcome: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const profileCacheKey = (id: string) => `billscan.profile.${id}`;

async function loadProfile(userId: string): Promise<Profile | null> {
  const fresh = await fetchProfile(userId).catch(() => null);
  if (fresh) {
    await SecureStore.setItemAsync(profileCacheKey(userId), JSON.stringify(fresh)).catch(() => {});
    return fresh;
  }
  // Offline: fall back to the last profile seen on this phone.
  const cached = await SecureStore.getItemAsync(profileCacheKey(userId)).catch(() => null);
  return cached ? (JSON.parse(cached) as Profile) : null;
}

export async function biometricAvailable(): Promise<boolean> {
  const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  return hw && enrolled;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [welcomePending, setWelcomePending] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const applySession = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      return;
    }
    const p = await loadProfile(s.user.id);
    if (p && !p.active) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return;
    }
    setProfile(p);
    await ensureUserSetup(s.user.id, p ? `${p.fullName.split(' ')[0] || p.fullName} — ${p.designation}` : '').catch(() => {});
  }, []);

  // Start-up: restore the saved session; lock if app lock is on.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const bio = await isBiometricEnabled();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setBiometricEnabledState(bio);
      await applySession(data.session);
      setLocked(Boolean(data.session) && bio);
      setWelcomePending(Boolean(data.session));
      setInitializing(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setLocked(false);
      } else if (event === 'TOKEN_REFRESHED' && s) {
        setSession(s);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  // Auto-lock after 5 minutes in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current ??= Date.now();
      } else if (state === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since && Date.now() - since >= AUTO_LOCK_MS && biometricEnabled && session) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [biometricEnabled, session]);

  const signIn = useCallback(
    async (emailOrEmployeeId: string, password: string): Promise<string | null> => {
      if (!emailOrEmployeeId.trim() || !password) return 'Enter your email (or employee ID) and password.';
      const resolved = await resolveLoginEmail(emailOrEmployeeId);
      if (!resolved.email) return resolved.error ?? 'Could not sign in.';
      const { data, error } = await supabase.auth.signInWithPassword({ email: resolved.email, password });
      if (error || !data.session) return signInErrorMessage(error?.message);
      await applySession(data.session);
      if (!(await supabase.auth.getSession()).data.session) return 'This account is not active. Ask your admin.';
      setLocked(false);
      setWelcomePending(true);
      return null;
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
    setProfile(null);
    setLocked(false);
  }, []);

  const unlock = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock BillScan',
      cancelLabel: 'Cancel',
    });
    if (r.success) setLocked(false);
    return r.success;
  }, []);

  const setBiometric = useCallback(async (on: boolean): Promise<string | null> => {
    if (on) {
      if (!(await biometricAvailable())) return 'Set up a fingerprint or face unlock in your phone settings first.';
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to turn on quick unlock' });
      if (!r.success) return 'Not turned on. Try again.';
    }
    await setBiometricEnabled(on);
    setBiometricEnabledState(on);
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) setProfile(await loadProfile(session.user.id));
  }, [session]);

  const dismissWelcome = useCallback(() => setWelcomePending(false), []);

  const value = useMemo<AuthState>(
    () => ({
      initializing,
      session,
      profile,
      locked,
      biometricEnabled,
      signIn,
      signOut,
      unlock,
      setBiometric,
      refreshProfile,
      welcomePending,
      dismissWelcome,
    }),
    [initializing, session, profile, locked, biometricEnabled, signIn, signOut, unlock, setBiometric, refreshProfile, welcomePending, dismissWelcome],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
