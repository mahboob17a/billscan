/**
 * HTML for the month's "bill photos" PDF (Blueprint §6): a contents page listing every
 * bill in report order, then one page per photo, captioned with its section and S. No
 * so head office can match each photo to its report row. Pure (unit-tested).
 */
import { formatOmr } from '@/lib/money';
import { formatReportDate } from '@/lib/months';

export interface PhotoBill {
  sectionLabel: string; // "A", "B (cancelled)", …
  sno: number;
  billDate: string | null;
  billNo: string | null;
  description: string;
  grandTotal: number | null;
  photos: string[]; // data: URIs
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildPhotosHtml(title: string, subtitle: string, bills: PhotoBill[]): string {
  const rows = bills
    .map(
      (b) => `<tr><td>${esc(b.sectionLabel)}</td><td class="c">${b.sno}</td><td>${b.billDate ? esc(formatReportDate(b.billDate)) : '—'}</td>` +
        `<td>${esc(b.billNo ?? 'N/A')}</td><td>${esc(b.description)}</td><td class="r">${b.grandTotal === null ? '—' : formatOmr(b.grandTotal)}</td>` +
        `<td class="c">${b.photos.length || '—'}</td></tr>`,
    )
    .join('');
  const pages = bills
    .flatMap((b) =>
      b.photos.map(
        (src, i) => `<section class="photo">
  <div class="cap"><b>Section ${esc(b.sectionLabel)} · S. No ${b.sno}</b> · ${b.billDate ? esc(formatReportDate(b.billDate)) : 'no date'} · Bill ${esc(b.billNo ?? 'N/A')} · ${esc(b.description)}${b.grandTotal === null ? '' : ` · ${formatOmr(b.grandTotal)} OMR`}${b.photos.length > 1 ? ` · page ${i + 1} of ${b.photos.length}` : ''}</div>
  <img src="${src}"/>
</section>`,
      ),
    )
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page { size: A4; margin: 12mm; }
body { font-family: Helvetica, Arial, sans-serif; color: #1B2430; margin: 0; }
h1 { font-size: 18px; margin: 0 0 2px; color: #16283F; }
.sub { font-size: 11px; color: #5B6472; margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; font-size: 10px; }
th { background: #F5F1E4; color: #16283F; text-align: left; }
th, td { border: 1px solid #B9B0A0; padding: 4px 5px; }
td.c, th.c { text-align: center; } td.r { text-align: right; font-variant-numeric: tabular-nums; }
.photo { page-break-before: always; height: 270mm; display: flex; flex-direction: column; }
.cap { font-size: 10.5px; padding: 0 0 6px; border-bottom: 2px solid #16283F; margin-bottom: 6px; }
.photo img { flex: 1; width: 100%; height: 100%; max-height: 255mm; object-fit: contain; }
</style></head><body>
<h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div>
<table><thead><tr><th>Section</th><th class="c">S. No</th><th>Date</th><th>Bill No.</th><th>Description</th><th>Grand Total</th><th class="c">Photos</th></tr></thead>
<tbody>${rows || '<tr><td colspan="7">No saved bills this month.</td></tr>'}</tbody></table>
${pages}
</body></html>`;
}
