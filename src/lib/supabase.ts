import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { config } from './config';
import { chunkedSecureStorage } from './secureStorage';

/** Supabase client: login, profiles and the extract-bill server function. */
export const supabase = createClient(config.supabaseUrl || 'https://invalid.local', config.supabaseAnonKey || 'missing', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : chunkedSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export interface Profile {
  id: string;
  fullName: string;
  designation: string;
  site: string;
  employeeId: string | null;
  role: 'admin' | 'supervisor';
  active: boolean;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, designation, site, employee_id, role, active')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    designation: data.designation,
    site: data.site,
    employeeId: data.employee_id,
    role: data.role,
    active: data.active,
  };
}

export async function updateOwnProfile(userId: string, fullName: string, designation: string): Promise<string | null> {
  const { error } = await supabase.from('profiles').update({ full_name: fullName, designation }).eq('id', userId);
  return error ? 'Could not save. Check your connection and try again.' : null;
}

/** Turn what the user typed (email or employee ID) into the email Supabase signs in with. */
export async function resolveLoginEmail(input: string): Promise<{ email?: string; error?: string }> {
  const v = input.trim();
  if (v.includes('@')) return { email: v.toLowerCase() };
  const { data, error } = await supabase.rpc('email_for_employee_id', { eid: v });
  if (error) return { error: 'Could not look up that employee ID. Try your email instead.' };
  if (!data) return { error: 'No account has that employee ID. Check it, or use your email.' };
  return { email: data as string };
}

/** Friendly text for Supabase sign-in errors. */
export function signInErrorMessage(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is not correct.';
  if (m.includes('email not confirmed')) return 'This account is not confirmed yet. Ask your admin.';
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check mobile data or Wi-Fi and try again.';
  return 'Could not sign in. Try again in a moment.';
}
