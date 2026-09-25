/** Builds the month's bill-photo PDF on the phone (expo-print) and saves it next to the Excel file. */
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { BillRecord, listBills } from '@/db/bills';
import { getReportMonth } from '@/db/repo';
import { SECTION_INFO, SECTIONS } from '@/db/schema';
import { MonthId, monthLabel } from '@/lib/months';
import { buildPhotosHtml, PhotoBill } from './photosHtml';

async function toDataUris(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    try {
      out.push(`data:image/jpeg;base64,${await new File(p).base64()}`);
    } catch {
      // Photo missing on this phone (e.g. restored without photos): skip it.
    }
  }
  return out;
}

export async function buildBillPhotosPdf(userId: string, month: MonthId): Promise<{ uri: string; fileName: string; photoCount: number }> {
  const rm = await getReportMonth(userId, month);
  const groups: { label: string; bills: BillRecord[] }[] = [];
  for (const s of SECTIONS) {
    groups.push({ label: SECTION_INFO[s].letter, bills: await listBills(userId, month, { kind: 'section', section: s }) });
    if (s === 'MATERIAL') groups.push({ label: 'B (cancelled)', bills: await listBills(userId, month, { kind: 'cancelled' }) });
  }
  const items: PhotoBill[] = [];
  let photoCount = 0;
  for (const g of groups) {
    for (let i = 0; i < g.bills.length; i++) {
      const b = g.bills[i];
      const photos = await toDataUris(b.imagePaths);
      photoCount += photos.length;
      items.push({ sectionLabel: g.label, sno: i + 1, billDate: b.billDate, billNo: b.noBillNo ? null : b.billNo, description: b.description, grandTotal: b.grandTotal, photos });
    }
  }
  const html = buildPhotosHtml(`Bill photos — ${monthLabel(month)}`, `${rm.statementRef} · ${items.length} bills · ${photoCount} photos`, items);
  const printed = await Print.printToFileAsync({ html, width: 595, height: 842 });

  const dir = new Directory(Paths.document, 'reports');
  dir.create({ intermediates: true, idempotent: true });
  const fileName = `${rm.statementRef.replace(/[^A-Za-z0-9._-]+/g, '-')}-bill-photos.pdf`;
  const dest = new File(dir, fileName);
  if (dest.exists) dest.delete();
  new File(printed.uri).moveSync(dest);
  return { uri: dest.uri, fileName, photoCount };
}
