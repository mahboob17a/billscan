/** AI usage for the signed-in user this month (from the server's ai_calls log). */
import { getDb } from '@/db';
import { supabase } from './supabase';

export interface AiUsage {
  calls: number;
  failed: number;
  pages: number;
  promptTokens: number;
  completionTokens: number;
  avgSeconds: number;
}

export async function getAiUsageThisMonth(now = new Date()): Promise<AiUsage | { error: string }> {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return { error: 'Not signed in.' };
  const { data, error } = await supabase
    .from('ai_calls')
    .select('ok, pages, prompt_tokens, completion_tokens, duration_ms')
    .eq('user_id', uid)
    .gte('created_at', start)
    .limit(5000);
  if (error) return { error: 'Could not reach the server.' };
  const rows = data ?? [];
  const ok = rows.filter((r) => r.ok);
  return {
    calls: rows.length,
    failed: rows.length - ok.length,
    pages: rows.reduce((a, r) => a + (r.pages ?? 0), 0),
    promptTokens: rows.reduce((a, r) => a + (r.prompt_tokens ?? 0), 0),
    completionTokens: rows.reduce((a, r) => a + (r.completion_tokens ?? 0), 0),
    avgSeconds: ok.length ? Math.round(ok.reduce((a, r) => a + (r.duration_ms ?? 0), 0) / ok.length / 100) / 10 : 0,
  };
}

export async function pendingErrorReports(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM error_log WHERE uploaded = 0');
  return r?.n ?? 0;
}
