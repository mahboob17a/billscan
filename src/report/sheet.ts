/**
 * Builds the "Purchase Report" worksheet XML from the month's data (Blueprint §7).
 * Pure string work — no React Native APIs — so it is unit-tested in Node.
 *
 * Layout follows the DTR template: header block, Sections A–E (one row per bill,
 * with a sub-total under each section that has bills), Section F cash brought forward,
 * Section G cash received, Section H reconciliation with live formulas. Every formula also carries its
 * computed value, so phone viewers that don't recalculate still show the totals.
 */
import type { Section } from '@/db/schema';
import type { Baisa } from '@/lib/money';

export interface ReportBillRow {
  billDate: string | null; // YYYY-MM-DD
  billNo: string | null;
  noBillNo: boolean;
  description: string;
  shopRate: Baisa | null;
  vat: Baisa | null;
  discount: Baisa;
  grandTotal: Baisa | null;
  remarks: string;
}

export interface ReportCashRow {
  entryDate: string; // YYYY-MM-DD
  description: string;
  amount: Baisa;
  remarks: string;
}

export interface ReportData {
  companyName: string;
  contractLine: string;
  monthLabel: string; // "September 2026"
  statementRef: string;
  datePrepared: string; // YYYY-MM-DD
  preparedBy: string;
  submittedTo: string;
  sections: Record<Section, ReportBillRow[]>;
  cancelled: ReportBillRow[];
  broughtForward: ReportCashRow[]; // Section F
  cash: ReportCashRow[]; // Section G
}

/** Style indexes (cellXfs) in the workbook's styles.xml. */
export interface ReportStyles {
  title: number;
  subtitle: number;
  heading: number;
  label: number;
  value: number;
  bar: number;
  colHead: number;
  empty: number;
  reconLabel: number;
  reconValue: number;
  omr: number;
  balLabel: number;
  balValue: number;
  balOmr: number;
  dCenter: number;
  dDate: number;
  dText: number;
  dAmount: number;
  dRemarks: number;
  subLabel: number;
  subValue: number;
}

/** Totals as written in the file (baisa). */
export interface ReportTotals {
  sections: Record<Section, Baisa>;
  cancelled: Baisa;
  purchases: Baisa; // A + C + D + E (B excluded)
  broughtForward: Baisa; // F
  cashReceived: Baisa; // G
  balanceDue: Baisa;
  billCount: number;
}

const SECTION_ORDER: { key: Section | 'CANCELLED'; title: string; empty: string }[] = [
  { key: 'MATERIAL', title: 'Section A — Schedule of Material Purchases', empty: 'No material & service bills recorded during the period.' },
  { key: 'CANCELLED', title: 'Section B — Cancelled Bills', empty: 'No cancelled bills recorded during the period.' },
  { key: 'SEWAGE', title: 'Section C — Sewage Removal', empty: 'No sewage removal bills recorded during the period.' },
  { key: 'TOOLS', title: 'Section D — Tools', empty: 'No tools bills recorded during the period.' },
  { key: 'FUEL', title: 'Section E — Fuel', empty: 'No fuel bills recorded during the period.' },
];
const SECTION_LETTER: Record<Section, string> = { MATERIAL: 'A', SEWAGE: 'C', TOOLS: 'D', FUEL: 'E' };

const BILL_HEADS = ['S. No', 'Date', 'Bill No.', 'Description', 'Shop Rate', 'VAT 5%', 'Disc.', 'Grand Total', 'Remarks'];
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

// ── XML helpers ───────────────────────────────────────────────────────────

export function xmlEscape(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Baisa → OMR number text with exactly 3 decimals (no float noise). */
export function omrText(b: Baisa): string {
  const sign = b < 0 ? '-' : '';
  const a = Math.abs(b);
  return `${sign}${Math.floor(a / 1000)}.${String(a % 1000).padStart(3, '0')}`;
}

/** YYYY-MM-DD → Excel date serial (1900 date system). */
export function excelSerial(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000 + 25_569;
}

type Cell = string; // pre-rendered <c> element

const str = (ref: string, s: number, text: string): Cell =>
  text ? `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>` : `<c r="${ref}" s="${s}"/>`;
const num = (ref: string, s: number, value: string | number | null): Cell =>
  value === null || value === '' ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}"><v>${value}</v></c>`;
const fml = (ref: string, s: number, formula: string, cached: string): Cell =>
  `<c r="${ref}" s="${s}"><f>${xmlEscape(formula)}</f><v>${cached}</v></c>`;
const blank = (ref: string, s: number): Cell => `<c r="${ref}" s="${s}"/>`;

class SheetWriter {
  rows: string[] = [];
  merges: string[] = [];
  r = 0;

  row(cells: Cell[], height?: number): number {
    this.r += 1;
    const ht = height ? ` ht="${height}" customHeight="1"` : '';
    this.rows.push(`<row r="${this.r}" spans="1:9"${ht}>${cells.join('')}</row>`);
    return this.r;
  }

  skip(): void {
    this.r += 1;
  }

  merge(from: string, to: string): void {
    this.merges.push(`${from}${this.r}:${to}${this.r}`);
  }

  /** A full-width row (A:I merged) with one style. */
  wide(text: string, s: number, height?: number): number {
    const n = this.r + 1;
    this.row(COLS.map((c, i) => (i === 0 ? str(`A${n}`, s, text) : blank(`${c}${n}`, s))), height);
    this.merge('A', 'I');
    return n;
  }
}

/** Row height for wrapped remarks: column I holds ~22 characters per line at 9.5 pt. */
function heightFor(remarks: string, description: string): number | undefined {
  const lines = Math.max(Math.ceil(remarks.length / 22), Math.ceil(description.length / 34), 1);
  return lines > 1 ? Math.round(lines * 12.5 + 3) : undefined;
}

function billRows(w: SheetWriter, bills: ReportBillRow[], s: ReportStyles): { first: number; last: number; total: Baisa } {
  let first = 0;
  let total = 0;
  bills.forEach((b, i) => {
    const n = w.r + 1;
    if (i === 0) first = n;
    total += b.grandTotal ?? 0;
    w.row(
      [
        num(`A${n}`, s.dCenter, i + 1),
        b.billDate ? num(`B${n}`, s.dDate, excelSerial(b.billDate)) : blank(`B${n}`, s.dDate),
        str(`C${n}`, s.dCenter, b.noBillNo ? 'N/A' : (b.billNo ?? '')),
        str(`D${n}`, s.dText, b.description),
        num(`E${n}`, s.dAmount, b.shopRate === null ? null : omrText(b.shopRate)),
        num(`F${n}`, s.dAmount, b.vat === null ? null : omrText(b.vat)),
        num(`G${n}`, s.dAmount, omrText(b.discount)),
        num(`H${n}`, s.dAmount, b.grandTotal === null ? null : omrText(b.grandTotal)),
        str(`I${n}`, s.dRemarks, b.remarks),
      ],
      heightFor(b.remarks, b.description),
    );
  });
  return { first, last: w.r, total };
}

/** Sub-total row under a section: label across A:G, SUM in H. Returns the H cell reference. */
function subtotalRow(w: SheetWriter, label: string, first: number, last: number, total: Baisa, s: ReportStyles): string {
  const n = w.r + 1;
  w.row([
    ...COLS.slice(0, 7).map((c, i) => (i === 0 ? str(`A${n}`, s.subLabel, label) : blank(`${c}${n}`, s.subLabel))),
    fml(`H${n}`, s.subValue, `SUM(H${first}:H${last})`, omrText(total)),
    blank(`I${n}`, s.subLabel),
  ]);
  w.merge('A', 'G');
  return `H${n}`;
}

/**
 * Build the worksheet. `templateXml` is the template's sheet1.xml: its column widths,
 * page setup and margins are kept; only the cells, merges and dimension are replaced.
 */
export function buildSheetXml(templateXml: string, d: ReportData, s: ReportStyles): { xml: string; totals: ReportTotals } {
  const w = new SheetWriter();

  // Header block (rows 1–8)
  w.wide(d.companyName, s.title, 18);
  w.wide(d.contractLine, s.subtitle, 18);
  w.skip();
  w.wide('MONTHLY PURCHASE REPORT', s.heading, 18);
  w.wide(`For the Month of ${d.monthLabel}`, s.subtitle, 18);
  w.skip();
  for (const [l1, v1, l2, v2] of [
    ['Statement Ref.:', d.statementRef, 'Date Prepared:', d.datePrepared],
    ['Prepared By:', d.preparedBy, 'Submitted To:', d.submittedTo],
  ]) {
    // Labels get two columns each so they are not cut off (column A is narrow).
    const n = w.r + 1;
    w.row([
      str(`A${n}`, s.label, l1),
      blank(`B${n}`, s.label),
      str(`C${n}`, s.value, v1),
      blank(`D${n}`, s.value),
      blank(`E${n}`, s.value),
      str(`F${n}`, s.label, l2),
      blank(`G${n}`, s.label),
      str(`H${n}`, s.value, v2),
      blank(`I${n}`, s.value),
    ]);
    w.merges.push(`A${n}:B${n}`, `C${n}:E${n}`, `F${n}:G${n}`, `H${n}:I${n}`);
  }
  w.skip();

  // Sections A–E
  const sectionTotals: Record<Section, Baisa> = { MATERIAL: 0, SEWAGE: 0, TOOLS: 0, FUEL: 0 };
  const purchaseRefs: string[] = [];
  let cancelledTotal = 0;
  let billCount = 0;
  for (const sec of SECTION_ORDER) {
    const bills = sec.key === 'CANCELLED' ? d.cancelled : d.sections[sec.key];
    w.wide(sec.title, s.bar, 20);
    const hn = w.r + 1;
    w.row(BILL_HEADS.map((h, i) => str(`${COLS[i]}${hn}`, s.colHead, h)));
    if (bills.length === 0) {
      w.wide(sec.empty, s.empty);
    } else {
      const { first, last, total } = billRows(w, bills, s);
      if (sec.key === 'CANCELLED') {
        cancelledTotal = total;
      } else {
        billCount += bills.length;
        sectionTotals[sec.key] = total;
        purchaseRefs.push(subtotalRow(w, `Total — Section ${SECTION_LETTER[sec.key]}`, first, last, total, s));
      }
    }
    w.skip();
  }

  // Sections F (cash brought forward) and G (cash received) share one layout.
  const cashSection = (title: string, emptyText: string, totalLabel: string, rows: ReportCashRow[]): { ref: string | null; total: Baisa } => {
    w.wide(title, s.bar, 20);
    const hn = w.r + 1;
    w.row([
      str(`A${hn}`, s.colHead, 'S. No'),
      str(`B${hn}`, s.colHead, 'Date'),
      str(`C${hn}`, s.colHead, 'Description'),
      ...['D', 'E', 'F', 'G'].map((c) => blank(`${c}${hn}`, s.colHead)),
      str(`H${hn}`, s.colHead, 'Amount'),
      str(`I${hn}`, s.colHead, 'Remarks'),
    ]);
    w.merge('C', 'G');
    const total = rows.reduce((a, e) => a + e.amount, 0);
    let ref: string | null = null;
    if (rows.length === 0) {
      w.wide(emptyText, s.empty);
    } else {
      const first = w.r + 1;
      rows.forEach((e, i) => {
        const n = w.r + 1;
        w.row(
          [
            num(`A${n}`, s.dCenter, i + 1),
            num(`B${n}`, s.dDate, excelSerial(e.entryDate)),
            str(`C${n}`, s.dText, e.description),
            ...['D', 'E', 'F', 'G'].map((c) => blank(`${c}${n}`, s.dText)),
            num(`H${n}`, s.dAmount, omrText(e.amount)),
            str(`I${n}`, s.dRemarks, e.remarks),
          ],
          heightFor(e.remarks, ''),
        );
        w.merge('C', 'G');
      });
      ref = subtotalRow(w, totalLabel, first, w.r, total, s);
    }
    w.skip();
    return { ref, total };
  };
  const bf = cashSection(
    'Section F — Cash Brought Forward from Last Month',
    'No cash brought forward from last month.',
    'Total brought forward',
    d.broughtForward,
  );
  const cash = cashSection('Section G — Cash Received from Cashier', 'No cash received recorded during the period.', 'Total cash received', d.cash);

  // Section H — reconciliation (live formulas)
  // Balance due = purchases − cash already in hand from last month − cash received this month.
  const purchases = Object.values(sectionTotals).reduce((a, b) => a + b, 0);
  const balance = purchases - bf.total - cash.total;
  w.wide('Section H — Reconciliation Summary', s.bar, 20);
  const reconRow = (label: string, formula: string, value: Baisa, ls: number, vs: number, os: number) => {
    const n = w.r + 1;
    w.row([
      ...COLS.slice(0, 7).map((c, i) => (i === 0 ? str(`A${n}`, ls, label) : blank(`${c}${n}`, ls))),
      fml(`H${n}`, vs, formula, omrText(value)),
      str(`I${n}`, os, 'OMR'),
    ]);
    w.merge('A', 'G');
    return `H${n}`;
  };
  const pRef = reconRow('TOTAL PURCHASE VALUE', purchaseRefs.length ? purchaseRefs.join('+') : '0', purchases, s.reconLabel, s.reconValue, s.omr);
  const bRef = reconRow('CASH BROUGHT FORWARD FROM LAST MONTH', bf.ref ?? '0', bf.total, s.reconLabel, s.reconValue, s.omr);
  const cRef = reconRow('CASH RECEIVED FROM CASHIER', cash.ref ?? '0', cash.total, s.reconLabel, s.reconValue, s.omr);
  reconRow('BALANCE DUE (Payable by Cashier)', `${pRef}-${bRef}-${cRef}`, balance, s.balLabel, s.balValue, s.balOmr);

  const sheetData = `<sheetData>${w.rows.join('')}</sheetData>`;
  const mergeCells = `<mergeCells count="${w.merges.length}">${w.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;

  let xml = templateXml
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:I${w.r}"/>`)
    .replace(/<sheetData\/>|<sheetData>[\s\S]*<\/sheetData>/, sheetData);
  xml = /<mergeCells[\s\S]*?<\/mergeCells>/.test(xml)
    ? xml.replace(/<mergeCells[\s\S]*?<\/mergeCells>/, mergeCells)
    : xml.replace('</sheetData>', `</sheetData>${mergeCells}`);

  return {
    xml,
    totals: {
      sections: sectionTotals,
      cancelled: cancelledTotal,
      purchases,
      broughtForward: bf.total,
      cashReceived: cash.total,
      balanceDue: balance,
      billCount,
    },
  };
}
