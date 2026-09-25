/**
 * Calls the extract-bill Edge Function (the OpenAI key stays on the server).
 * Returns the AI's reading, or a plain-language error the scan screen can show.
 */
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import type { Extraction } from './billRules';
import { supabase } from './supabase';

export type ExtractResult =
  | { ok: true; extraction: Extraction; model: string; prompt: string }
  | { ok: false; error: string; offline: boolean };

function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function extractBill(pagesBase64: string[], descriptions: Record<string, string[]>): Promise<ExtractResult> {
  try {
    const { data, error } = await supabase.functions.invoke('extract-bill', {
      body: { images: pagesBase64, descriptions, today: todayIso() },
    });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        let message = 'The AI could not read this bill.';
        try {
          const body = await (error.context as Response).json();
          if (body?.error) message = String(body.error);
        } catch {
          // keep default message
        }
        return { ok: false, error: message, offline: false };
      }
      if (error instanceof FunctionsFetchError) {
        return { ok: false, error: 'No internet connection. The bill is saved as a draft; read it later.', offline: true };
      }
      return { ok: false, error: error.message || 'The AI could not read this bill.', offline: false };
    }
    if (!data?.extraction) return { ok: false, error: 'The AI returned no answer. Try again.', offline: false };
    return { ok: true, extraction: data.extraction as Extraction, model: String(data.model ?? ''), prompt: String(data.prompt ?? '') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), offline: true };
  }
}
