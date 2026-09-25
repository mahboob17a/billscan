#!/usr/bin/env node
/**
 * Builds a single-file copy of the extract-bill function for pasting into the
 * Supabase dashboard editor (used when the Supabase CLI can't be run):
 *   node scripts/bundle-function.mjs > /tmp/extract-bill.ts
 */
import fs from 'node:fs';

const dir = 'supabase/functions/extract-bill';
const read = (f) => fs.readFileSync(`${dir}/${f}`, 'utf8');
const index = read('index.ts')
  .split('\n')
  .filter((l) => !/^import .* from '\.\/(prompt|schema)\.ts';$/.test(l) && !l.startsWith("import 'jsr:"))
  .join('\n');
const at = index.indexOf('\n', index.indexOf("from 'npm:@supabase/supabase-js@2';")) + 1;
process.stdout.write(
  index.slice(0, at) + `\n// ── schema.ts ──\n${read('schema.ts')}\n// ── prompt.ts ──\n${read('prompt.ts')}\n// ── index.ts ──\n` + index.slice(at),
);
