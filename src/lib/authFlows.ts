/**
 * Sign-in with Google / Apple, sign-up, forgot password and change password (Supabase Auth).
 *
 * Every emailed or browser-based step returns to the app through a deep link:
 *   billscan://auth-callback?code=…    (Google, Apple, email confirmation)
 *   billscan://reset-password?code=…   (forgot-password email)
 * The code is exchanged for a session on this phone (PKCE), so a link only works on the
 * phone that asked for it.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { config } from './config';
import { supabase } from './supabase';

export type OAuthProvider = 'google' | 'apple';

export const authRedirect = (path: 'auth-callback' | 'reset-password') => Linking.createURL(path);

/** Which sign-in options are switched on in Supabase (so the app only shows working buttons). */
export interface AuthOptions {
  google: boolean;
  apple: boolean;
  signUp: boolean;
}

export async function fetchAuthOptions(): Promise<AuthOptions> {
  try {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/settings`, { headers: { apikey: config.supabaseAnonKey } });
    const s = (await res.json()) as { external?: Record<string, boolean>; disable_signup?: boolean };
    return { google: Boolean(s.external?.google), apple: Boolean(s.external?.apple), signUp: !s.disable_signup };
  } catch {
    // Offline: show email sign-in only.
    return { google: false, apple: false, signUp: true };
  }
}

function friendly(message: string | undefined, fallback: string): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check mobile data or Wi-Fi and try again.';
  if (m.includes('provider is not enabled')) return 'This sign-in option is not switched on yet. Use email and password.';
  if (m.includes('already registered') || m.includes('already exists')) return 'An account with this email already exists. Sign in, or use Forgot password.';
  if (m.includes('password should be') || m.includes('weak')) return 'Choose a stronger password: at least 8 characters with letters and numbers.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a few minutes and try again.';
  if (m.includes('same password') || m.includes('different from the old')) return 'The new password must be different from the old one.';
  if (m.includes('expired') || m.includes('invalid') || m.includes('code verifier')) return 'This link has expired or was opened on another phone. Ask for a new one.';
  return fallback;
}

// The same code can arrive twice (the browser session result and the app's deep-link
// router both see it). A code can only be exchanged once, so share the first attempt.
const exchanges = new Map<string, Promise<string | null>>();

/** Complete a deep link that carries ?code=… (or an error) by creating the session. */
export function completeAuthFromUrl(url: string): Promise<string | null> {
  const { queryParams } = Linking.parse(url);
  const err = (queryParams?.error_description ?? queryParams?.error) as string | undefined;
  if (err) return Promise.resolve(friendly(err, 'Sign-in was cancelled or failed. Try again.'));
  const code = queryParams?.code as string | undefined;
  if (!code) return Promise.resolve(null);
  let p = exchanges.get(code);
  if (!p) {
    p = supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => (error ? friendly(error.message, 'Could not finish signing in. Try again.') : null));
    exchanges.set(code, p);
  }
  return p;
}

/** Open Google or Apple in a secure browser tab and come back signed in. Returns an error message or null. */
export async function signInWithProvider(provider: OAuthProvider): Promise<string | null> {
  const redirectTo = authRedirect('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true, queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined },
  });
  if (error || !data?.url) return friendly(error?.message, 'Could not open the sign-in page. Try again.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return result.type === 'cancel' || result.type === 'dismiss' ? 'cancelled' : 'Sign-in did not finish. Try again.';
  return (await completeAuthFromUrl(result.url)) ?? null;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use letters and numbers in your password.';
  return null;
}

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Enter a valid email address.';
}

/**
 * Create an account. If the project requires email confirmation, Supabase emails a link
 * and no session is returned yet (needsConfirmation = true).
 */
export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: fullName.trim() }, emailRedirectTo: authRedirect('auth-callback') },
  });
  if (error) return { error: friendly(error.message, 'Could not create the account. Try again.'), needsConfirmation: false };
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: 'An account with this email already exists. Sign in, or use Forgot password.', needsConfirmation: false };
  }
  return { error: null, needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authRedirect('reset-password') });
  return error ? friendly(error.message, 'Could not send the email. Try again.') : null;
}

export async function setNewPassword(password: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? friendly(error.message, 'Could not change the password. Try again.') : null;
}

export async function resendConfirmation(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: authRedirect('auth-callback') } });
  return error ? friendly(error.message, 'Could not resend the email. Try again.') : null;
}
