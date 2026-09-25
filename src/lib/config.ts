/**
 * Public runtime configuration. Values come from EXPO_PUBLIC_* variables
 * (.env locally, EAS environment variables for builds). These are safe to ship
 * in the app: the OpenAI key is NOT here — it lives only in the Supabase
 * Edge Function secrets.
 */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

export function isBackendConfigured(): boolean {
  return config.supabaseUrl.startsWith('https://') && config.supabaseAnonKey.length > 20;
}
