/**
 * Crash and error reporting without a third-party service: errors are written to the
 * phone's database first (works offline and during a crash), then uploaded to the
 * Supabase table app_errors, where the admin can read them.
 */
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { getDb } from '@/db';
import { supabase } from './supabase';

function describe(e: unknown): { message: string; stack: string | null } {
  if (e instanceof Error) return { message: `${e.name}: ${e.message}`.slice(0, 1000), stack: e.stack?.slice(0, 4000) ?? null };
  return { message: String(e).slice(0, 1000), stack: null };
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export async function recordError(e: unknown, context: Record<string, unknown> = {}, fatal = false): Promise<void> {
  try {
    const { message, stack } = describe(e);
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO error_log (user_id, created_at, message, stack, context, fatal) VALUES (?, ?, ?, ?, ?, ?)',
      await currentUserId(),
      new Date().toISOString(),
      message,
      stack,
      JSON.stringify(context).slice(0, 2000),
      fatal ? 1 : 0,
    );
  } catch {
    // Never let error logging throw.
  }
}

/** Log a handled error and try to upload it (fire-and-forget). */
export function logError(e: unknown, context: Record<string, unknown> = {}): void {
  if (__DEV__) console.warn('[BillScan]', e, context);
  recordError(e, context).then(() => flushErrors());
}

let flushing = false;

/** Upload errors that haven't reached the server yet. */
export async function flushErrors(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: number; created_at: string; message: string; stack: string | null; context: string | null; fatal: number }>(
      'SELECT id, created_at, message, stack, context, fatal FROM error_log WHERE uploaded = 0 ORDER BY id LIMIT 20',
    );
    if (rows.length === 0) return;
    const { error } = await supabase.from('app_errors').insert(
      rows.map((r) => ({
        user_id: userId,
        occurred_at: r.created_at,
        message: r.message,
        stack: r.stack,
        context: r.context,
        fatal: r.fatal === 1,
        app_version: `${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`,
        platform: `${Platform.OS} ${Platform.Version}`,
      })),
    );
    if (!error) {
      await db.runAsync(`UPDATE error_log SET uploaded = 1 WHERE id IN (${rows.map((r) => r.id).join(',')})`);
      await db.runAsync("DELETE FROM error_log WHERE uploaded = 1 AND created_at < ?", new Date(Date.now() - 30 * 86_400_000).toISOString());
    }
  } catch {
    // Offline or table missing: keep the rows for next time.
  } finally {
    flushing = false;
  }
}

let installed = false;

/** Record uncaught JavaScript errors (including crashes) before the default handler runs. */
export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;
  const eu = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    recordError(e, { where: 'global' }, Boolean(fatal)).finally(() => previous(e, fatal));
  });
}
