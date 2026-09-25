/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { excelSerial, omrText, xmlEscape, ReportData } from '../sheet';
import { nextRevision, reportFileName } from '../naming';
import { buildReportXlsx } from '../workbook';

const template = new Uint8Array(fs.readFileSync(path.join(__dirname, '../../../assets/templates/DTR-PUR-UTAS-NIZWA-template.xlsx')));

const bill = (o: Partial<ReportData['cancelled'][number]>) => ({
  billDate: '2026-09-17', billNo: '0022', noBillNo: false, description: 'Electrical Goods',
  shopRate: 46000, vat: 0, discount: 0, grandTotal: 46000, remarks: 'Shop · Cash', ...o,
});

const SAMPLE: ReportData = {
  companyName: 'DARYAS TRADING AND CONTRACTING  LLC',
  contractLine: 'UTAS Nizwa — North & South Campus  |  O&M Maintenance Contract',
  monthLabel: 'September 2026',
  statementRef: 'DTR-PUR-UTAS-NIZWA-2026-09',
  datePrepared: '2026-09-30',
  preparedBy: 'Mahboob Alam Ansari — Maintenance Supervisor',
  submittedTo: 'Cashier, Daryas Trading & Contracting',
  sections: {
    MATERIAL: [
      bill({}),
      bill({ billNo: '4286', description: 'Paint', shopRate: 6400, vat: 320, discount: 220, grandTotal: 6500, remarks: 'Al Noor Paints · Cash · Round-off disc. after VAT' }),
      bill({ billNo: null, noBillNo: true, billDate: '2026-09-03', description: 'Civil Material', shopRate: 2000, grandTotal: 2000, remarks: 'Handwritten memo <A&B>' }),
    ],
    SEWAGE: [],
    TOOLS: [bill({ billNo: 'T-1', description: 'Hand Tools', shopRate: 10000, vat: 500, grandTotal: 10500 })],
    FUEL: [],
  },
  cancelled: [bill({ billNo: '999', grandTotal: 5000, shopRate: 5000 })],
  broughtForward: [{ entryDate: '2026-09-01', description: 'Balance from August 2026', amount: 10000, remarks: 'Cash in hand' }],
  cash: [{ entryDate: '2026-09-02', description: 'Petty cash float', amount: 50000, remarks: 'Cashier' }],
};

describe('report workbook', () => {
  it('helpers', () => {
    expect(omrText(6500)).toBe('6.500');
    expect(omrText(-125)).toBe('-0.125');
    expect(excelSerial('2026-09-17')).toBe(46282);
    expect(xmlEscape('a<b>&"')).toBe('a&lt;b&gt;&amp;&quot;');
  });

  it('builds totals: cancelled excluded, balance = purchases − brought forward − cash received', () => {
    const { totals } = buildReportXlsx(template, SAMPLE);
    expect(totals.sections.MATERIAL).toBe(54500);
    expect(totals.purchases).toBe(65000);
    expect(totals.cancelled).toBe(5000);
    expect(totals.broughtForward).toBe(10000);
    expect(totals.cashReceived).toBe(50000);
    expect(totals.balanceDue).toBe(5000);
    expect(totals.billCount).toBe(4);
  });

  it('writes formulas, merges and a valid package', () => {
    const { bytes } = buildReportXlsx(template, SAMPLE);
    const files = unzipSync(bytes);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<f>SUM(H12:H14)</f><v>54.500</v>');
    expect(sheet).toContain('Handwritten memo &lt;A&amp;B&gt;');
    expect(sheet).toMatch(/<f>H\d+\+H\d+<\/f><v>65\.000<\/v>/);
    expect(sheet).toMatch(/<f>H\d+-H\d+-H\d+<\/f><v>5\.000<\/v>/);
    expect(sheet).toContain('Section F — Cash Brought Forward from Last Month');
    expect(sheet).toContain('Section G — Cash Received from Cashier');
    expect(sheet).toContain('Section H — Reconciliation Summary');
    expect(sheet).toContain('CASH BROUGHT FORWARD FROM LAST MONTH');
    expect(sheet).toContain('<cols>');
    expect(sheet).toContain('<pageSetup');
    expect(strFromU8(files['xl/workbook.xml'])).toContain('fullCalcOnLoad="1"');
    if (process.env.REPORT_OUT) fs.writeFileSync(process.env.REPORT_OUT, bytes);
  });

  it('negative brought forward (spent from own pocket) raises the balance due', () => {
    const neg = { ...SAMPLE, broughtForward: [{ entryDate: '2026-09-01', description: 'Balance from August 2026', amount: -10000, remarks: 'Spent from own pocket' }] };
    const { bytes, totals } = buildReportXlsx(template, neg);
    expect(totals.broughtForward).toBe(-10000);
    expect(totals.balanceDue).toBe(25000); // 65.000 − (−10.000) − 50.000
    const sheet = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<v>-10.000</v>');
    expect(sheet).toMatch(/<f>H\d+-H\d+-H\d+<\/f><v>25\.000<\/v>/);
    if (process.env.REPORT_OUT_NEG) fs.writeFileSync(process.env.REPORT_OUT_NEG, bytes);
  });

  it('empty month keeps every "No … recorded" line and zero totals', () => {
    const { bytes, totals } = buildReportXlsx(template, { ...SAMPLE, sections: { MATERIAL: [], SEWAGE: [], TOOLS: [], FUEL: [] }, cancelled: [], broughtForward: [], cash: [] });
    const sheet = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
    expect(sheet.match(/recorded during the period\./g)).toHaveLength(6);
    expect(sheet).toContain('No cash brought forward from last month.');
    expect(totals.balanceDue).toBe(0);
    if (process.env.REPORT_OUT_EMPTY) fs.writeFileSync(process.env.REPORT_OUT_EMPTY, bytes);
  });
});


describe('report naming', () => {
  it('names the file after the statement reference, with Rn for revisions', () => {
    expect(reportFileName('DTR-PUR-UTAS-NIZWA-2026-09', 0)).toBe('DTR-PUR-UTAS-NIZWA-2026-09.xlsx');
    expect(reportFileName('DTR-PUR-UTAS-NIZWA-2026-09', 2)).toBe('DTR-PUR-UTAS-NIZWA-2026-09-R2.xlsx');
    expect(reportFileName('A/B C', 0)).toBe('A-B-C.xlsx');
  });
  it('counts revisions only when the month changed after an export', () => {
    expect(nextRevision({ exportedAt: null, status: 'open', revision: 0 })).toBe(0);
    expect(nextRevision({ exportedAt: 'x', status: 'exported', revision: 0 })).toBe(0);
    expect(nextRevision({ exportedAt: 'x', status: 'open', revision: 0 })).toBe(1);
    expect(nextRevision({ exportedAt: 'x', status: 'open', revision: 1 })).toBe(2);
  });
});
