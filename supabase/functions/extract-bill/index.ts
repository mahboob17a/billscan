// BillScan · extract-bill Edge Function
//
// Holds the OpenAI key (server secret). The phone never sees it.
//   POST { mode: "ping" }                         → health check, no AI call, no login needed
//   POST { images: ["<base64 jpeg>", ...], descriptions?: {...}, today?: "YYYY-MM-DD" }
//        with Authorization: Bearer <user access token> → extraction JSON
//
// Secrets:  OPENAI_API_KEY (required), OPENAI_MODEL (optional),
//           EVAL_TOKEN (optional: lets the accuracy test harness call without a user session)
// Provided by Supabase: SUPABASE_URL, SUPABASE_SECRET_KEYS (or legacy SUPABASE_SERVICE_ROLE_KEY)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { allLabels, buildSystemPrompt, cleanDescriptions, CUSTOMER_VAT_NUMBERS, PROMPT_VERSION } from './prompt.ts';
import { buildBillSchema } from './schema.ts';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_PAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // per page, after base64 decode (~1600 px JPEG is well under this)
const AI_TIMEOUT_MS = 45_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const env = (k: string) => Deno.env.get(k) ?? '';
const defaultModel = () => env('OPENAI_MODEL') || 'gpt-4.1-mini';

/** Server-only key: new-style SUPABASE_SECRET_KEYS (JSON), falling back to the legacy service role key. */
function serviceKey(): string {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>;
    const k = keys.default ?? Object.values(keys)[0];
    if (k) return k;
  } catch {
    // ignore malformed value and fall back
  }
  return env('SUPABASE_SERVICE_ROLE_KEY');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let body: { mode?: string; images?: unknown; descriptions?: unknown; model?: string; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  // ── Health check (Phase 0 "done when": server answers, key is configured) ──
  if (body.mode === 'ping') {
    return json({ ok: true, aiKeyConfigured: env('OPENAI_API_KEY').startsWith('sk-'), model: defaultModel(), prompt: PROMPT_VERSION });
  }

  const admin = createClient(env('SUPABASE_URL'), serviceKey(), {
    auth: { persistSession: false },
  });

  // ── Authenticate: signed-in user, or the accuracy-test harness ──
  let userId: string | null = null;
  const evalToken = env('EVAL_TOKEN');
  const isEval = evalToken.length >= 32 && req.headers.get('x-eval-token') === evalToken;
  if (!isEval) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in required.' }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Your session has expired. Sign in again.' }, 401);
    userId = userData.user.id;
    const { data: profile } = await admin.from('profiles').select('active').eq('id', userId).maybeSingle();
    if (!profile?.active) return json({ error: 'This account is not active. Ask your admin.' }, 403);
  }

  // The accuracy test may compare models; normal users always get the configured model.
  const modelName = isEval && typeof body.model === 'string' && /^[a-z0-9.\-]{3,40}$/.test(body.model) ? body.model : defaultModel();
  const model = () => modelName;

  // ── Validate images ──
  const images = Array.isArray(body.images) ? (body.images as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  if (images.length === 0) return json({ error: 'No bill image received.' }, 400);
  if (images.length > MAX_PAGES) return json({ error: `A bill can have at most ${MAX_PAGES} pages.` }, 400);
  for (const img of images) {
    if (Math.floor((img.length * 3) / 4) > MAX_IMAGE_BYTES) return json({ error: 'Image too large. Rescan the bill.' }, 413);
  }

  const descriptions = cleanDescriptions(body.descriptions);
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
    ? body.today
    : new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10); // Oman time

  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'AI service is not configured on the server.' }, 503);

  // ── Call OpenAI with the strict JSON schema ──
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  let ok = false;
  let errorText: string | null = null;
  let usage: { prompt_tokens?: number; completion_tokens?: number } = {};

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model(),
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: buildBillSchema(allLabels(descriptions)) },
        messages: [
          { role: 'system', content: buildSystemPrompt(descriptions, today) },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Extract the bill. It has ${images.length} page(s).` },
              ...images.map((b64) => ({
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
              })),
            ],
          },
        ],
      }),
    });

    const data = await res.json();
    usage = data.usage ?? {};
    if (!res.ok) {
      errorText = data?.error?.message ?? `OpenAI status ${res.status}`;
      return json({ error: 'The AI service could not read this bill. Try again.' }, 502);
    }
    const message = data.choices?.[0]?.message;
    if (message?.refusal) {
      errorText = `refusal: ${message.refusal}`;
      return json({ error: 'The AI declined to read this image. Check it is a bill.' }, 422);
    }
    const extraction = JSON.parse(message?.content ?? '{}');
    // Guard: Daryas' own VAT number is the customer's, never the vendor's.
    const vat = String(extraction.vendor_vat_no ?? '').replace(/\s/g, '').toUpperCase();
    if (vat && CUSTOMER_VAT_NUMBERS.some((c) => vat.endsWith(c.replace(/^OM/, '')))) {
      extraction.vendor_vat_no = null;
    }
    ok = true;
    return json({ extraction, model: model(), prompt: PROMPT_VERSION, usage });
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    const aborted = e instanceof Error && e.name === 'AbortError';
    return json({ error: aborted ? 'The AI took too long. Try again.' : 'Extraction failed. Try again.' }, aborted ? 504 : 500);
  } finally {
    clearTimeout(timer);
    // Cost and audit log (never blocks the response on failure).
    await admin
      .from('ai_calls')
      .insert({
        user_id: userId,
        model: isEval ? `${model()} (eval ${PROMPT_VERSION})` : `${model()} (${PROMPT_VERSION})`,
        pages: images.length,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        duration_ms: Date.now() - started,
        ok,
        error: errorText,
      })
      .then(() => {}, () => {});
  }
});
