/**
 * Month-end export on the phone: collect the month's saved bills and cash entries,
 * fill the bundled DTR template, save DTR-PUR-UTAS-NIZWA-YYYY-MM[-Rn].xlsx and open the share sheet.
 */
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import reportTemplate from '../../assets/templates/DTR-PUR-UTAS-NIZWA-template.xlsx';
import { listBills } from '@/db/bills';
import { getReportMonth, getReportSettings, listCashEntries, markMonthExported } from '@/db/repo';
import { SECTIONS, Section } from '@/db/schema';
import { MonthId, monthLabel } from '@/lib/months';
import type { ReportBillRow, ReportData, ReportTotals } from './sheet';
import { nextRevision, reportFileName } from './naming';
import { buildReportXlsx } from './workbook';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function collectReportData(userId: string, month: MonthId, datePrepared: string): Promise<ReportData> {
  const [settings, rm, cash, cancelled, ...perSection] = await Promise.all([
    getReportSettings(userId),
    getReportMonth(userId, month),
    listCashEntries(userId, month),
    listBills(userId, month, { kind: 'cancelled' }),
    ...SECTIONS.map((section) => listBills(userId, month, { kind: 'section', section })),
  ]);
  const toRow = (b: (typeof cancelled)[number]): ReportBillRow => ({
    billDate: b.billDate,
    billNo: b.billNo,
    noBillNo: b.noBillNo,
    description: b.description,
    shopRate: b.shopRate,
    vat: b.vat,
    discount: b.discount,
    grandTotal: b.grandTotal,
    remarks: b.remarks,
  });
  const sections = Object.fromEntries(SECTIONS.map((s, i) => [s, perSection[i].map(toRow)])) as Record<Section, ReportBillRow[]>;
  return {
    companyName: settings.companyName,
    contractLine: settings.contractLine,
    monthLabel: monthLabel(month),
    statementRef: rm.statementRef,
    datePrepared,
    preparedBy: settings.preparedBy,
    submittedTo: settings.submittedTo,
    sections,
    cancelled: cancelled.map(toRow),
    cash: cash.map((e) => ({ entryDate: e.entryDate, description: e.description, amount: e.amount, remarks: e.remarks })),
  };
}

async function templateBytes(): Promise<Uint8Array> {
  const asset = await Asset.fromModule(reportTemplate).downloadAsync();
  if (!asset.localUri) throw new Error('The report template is missing from the app.');
  return new File(asset.localUri).bytes();
}

export interface ExportResult {
  uri: string;
  fileName: string;
  totals: ReportTotals;
}

/** Build and save the report file (does not open the share sheet). */
export async function exportMonthReport(userId: string, month: MonthId, datePrepared: string): Promise<ExportResult> {
  const rm = await getReportMonth(userId, month);
  const revision = nextRevision(rm);
  const data = await collectReportData(userId, month, datePrepared);
  const { bytes, totals } = buildReportXlsx(await templateBytes(), data);

  const dir = new Directory(Paths.document, 'reports');
  dir.create({ intermediates: true, idempotent: true });
  const fileName = reportFileName(rm.statementRef, revision);
  const file = new File(dir, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);

  await markMonthExported(userId, month, { datePrepared, revision, file: file.uri });
  return { uri: file.uri, fileName, totals };
}

export async function shareReport(uri: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(uri, { mimeType: XLSX_MIME, UTI: 'org.openxmlformats.spreadsheetml.sheet', dialogTitle: `Send ${fileName}` });
}

export function reportFileExists(uri: string | null): boolean {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
