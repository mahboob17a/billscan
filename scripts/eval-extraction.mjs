#!/usr/bin/env node
/**
 * Accuracy test: sends each sample bill photo to the live extract-bill function
 * and compares the AI's answer with eval/ground-truth.json.
 *
 *   EVAL_URL=https://<ref>.supabase.co/functions/v1/extract-bill \
 *   EVAL_TOKEN=... [EVAL_MODEL=gpt-4.1] node scripts/eval-extraction.mjs eval/samples
 *
 * Prints one line per bill plus a score per field. In GitHub Actions it also
 * writes annotations so results can be read without downloading logs.
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? 'eval/samples';
const url = process.env.EVAL_URL;
const token = process.env.EVAL_TOKEN;
const model = process.env.EVAL_MODEL || undefined;
if (!url || !token) {
  console.error('Set EVAL_URL and EVAL_TOKEN.');
  process.exit(2);
}
const gh = Boolean(process.env.GITHUB_ACTIONS);
const gt = JSON.parse(fs.readFileSync('eval/ground-truth.json', 'utf8')).bills.filter((b) => b.image);

const baisa = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 1000));
const near = (a, b) => a !== null && b !== null && Math.abs(a - b) <= 10;
const normNo = (s) => String(s ?? '').replace(/\s/g, '').replace(/^0+(?=\d)/, '').toUpperCase();

/** Report row the app would produce (mirror of src/lib/billRules.ts draftFromExtraction). */
function row(e) {
  let taxable = baisa(e.taxable_amount);
  let vat = baisa(e.vat_amount);
  const grand = baisa(e.grand_total);
  const disc = baisa(e.discount) ?? 0;
  let type = disc === 0 ? 'none' : e.discount_type;
  if (disc !== 0 && type === 'none') type = taxable !== null && vat !== null && grand !== null && Math.abs(taxable + vat - disc - grand) <= 10 ? 'after_vat' : 'before_vat';
  if (taxable === null && vat === null && grand !== null) {
    const g = grand + (type === 'after_vat' ? disc : 0);
    if (e.vendor_vat_registered) {
      taxable = Math.round((g * 10000) / 10500);
      vat = g - taxable;
    } else {
      taxable = g;
      vat = 0;
    }
  } else if (taxable !== null && vat === null && !e.vendor_vat_registered) vat = 0;
  const shop = taxable === null ? null : taxable + (type === 'before_vat' ? disc : 0);
  return { shop, vat, disc, grand };
}

const fields = ['bill_no', 'bill_date', 'grand', 'shop', 'vat', 'disc', 'description', 'section', 'vat_registered'];
const score = Object.fromEntries(fields.map((f) => [f, 0]));
let flaggedWrong = 0;
let silentWrong = 0;
let totalMs = 0;
const lines = [];

for (const b of gt) {
  const file = path.join(dir, `${b.image}.jpg`);
  if (!fs.existsSync(file)) {
    console.error(`missing ${file}`);
    continue;
  }
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-eval-token': token },
    body: JSON.stringify({ images: [fs.readFileSync(file).toString('base64')], model }),
  });
  const ms = Date.now() - t0;
  totalMs += ms;
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.extraction) {
    lines.push(`${b.id} ERROR ${res.status} ${body.error ?? ''}`);
    continue;
  }
  const e = body.extraction;
  const got = row(e);
  const want = { shop: baisa(b.row.shop_rate), vat: baisa(b.row.vat), disc: baisa(b.row.disc), grand: baisa(b.row.grand) };
  const ok = {
    bill_no: normNo(e.bill_no) === normNo(b.bill_no),
    bill_date: e.bill_date === b.bill_date,
    grand: near(got.grand, want.grand),
    shop: near(got.shop, want.shop),
    vat: near(got.vat, want.vat),
    disc: near(got.disc, want.disc),
    description: b.description.includes(e.description),
    section: e.section === b.section,
    vat_registered: e.vendor_vat_registered === b.vendor_vat_registered,
  };
  for (const f of fields) if (ok[f]) score[f] += 1;
  const amountsOk = ok.grand && ok.shop && ok.vat && ok.disc;
  // Would the app's checks have caught a wrong amount? (sum mismatch or low confidence)
  const sumOk = got.shop !== null && got.vat !== null && got.grand !== null && Math.abs(got.shop + got.vat - got.disc - got.grand) <= 10;
  const flagged = !sumOk || e.confidence?.amounts === 'low' || got.grand === null;
  if (!amountsOk) flagged ? flaggedWrong++ : silentWrong++;
  const wrong = fields.filter((f) => !ok[f]);
  const fmt = (v) => (v === null ? '—' : (v / 1000).toFixed(3));
  lines.push(
    `${b.id} ${wrong.length ? '✗ ' + wrong.join(',') : '✓'} | no ${e.bill_no} date ${e.bill_date} | ${fmt(got.shop)} + ${fmt(got.vat)} − ${fmt(got.disc)} = ${fmt(got.grand)} (want ${fmt(want.grand)}) | ${e.description} | conf ${e.confidence?.amounts}/${e.confidence?.bill_date}/${e.confidence?.bill_no} | ${ms} ms${e.notes ? ' | ' + e.notes.slice(0, 80) : ''}`,
  );
}

const n = gt.length;
const pct = (k) => `${score[k]}/${n} (${Math.round((score[k] / n) * 100)}%)`;
const summary = [
  `Model ${model ?? 'default'} · ${n} bills · avg ${Math.round(totalMs / n)} ms/bill`,
  `Amounts all correct: grand ${pct('grand')}, shop ${pct('shop')}, vat ${pct('vat')}, disc ${pct('disc')}`,
  `Bill no ${pct('bill_no')} · date ${pct('bill_date')} · description ${pct('description')} · section ${pct('section')} · VAT-registered ${pct('vat_registered')}`,
  `Wrong amounts caught by checks: ${flaggedWrong}; wrong amounts NOT caught: ${silentWrong}`,
];
for (const l of [...lines, ...summary]) console.log(l);
if (gh) {
  // GitHub shows at most 10 notices per step: summary first, then bills in groups of 4.
  const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::notice title=Summary::${esc(summary.join('\n'))}`);
  for (let i = 0; i < lines.length; i += 4) console.log(`::notice title=Bills ${i + 1}-${Math.min(i + 4, lines.length)}::${esc(lines.slice(i, i + 4).join('\n'))}`);
}
