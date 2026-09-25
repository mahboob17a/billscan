import { config, isBackendConfigured } from './config';

export interface PingResult {
  ok: boolean;
  /** Server reachable and responded */
  reachable: boolean;
  /** OpenAI key is stored in the Edge Function secrets */
  aiKeyConfigured?: boolean;
  model?: string;
  message: string;
}

/**
 * Phase 0 connection check: calls the `extract-bill` Edge Function in ping mode.
 * Confirms the server is reachable and the OpenAI key is configured, without
 * spending any AI credit and without sending the key to the phone.
 */
export async function pingBackend(timeoutMs = 15000): Promise<PingResult> {
  if (!isBackendConfigured()) {
    return {
      ok: false,
      reachable: false,
      message: 'Server address not set. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.',
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.supabaseUrl}/functions/v1/extract-bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
      body: JSON.stringify({ mode: 'ping' }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as Partial<PingResult> & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        reachable: true,
        message: body.error ?? `Server answered with status ${res.status}.`,
      };
    }
    const aiKeyConfigured = Boolean(body.aiKeyConfigured);
    return {
      ok: aiKeyConfigured,
      reachable: true,
      aiKeyConfigured,
      model: body.model,
      message: aiKeyConfigured
        ? `Connected. AI model: ${body.model ?? 'not set'}.`
        : 'Server reached, but the OpenAI key is not set. Run: supabase secrets set OPENAI_API_KEY=...',
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return {
      ok: false,
      reachable: false,
      message: aborted ? 'No answer from the server within 15 seconds. Check mobile data or Wi-Fi.' : 'Could not reach the server. Check the address in .env and your connection.',
    };
  } finally {
    clearTimeout(timer);
  }
}
