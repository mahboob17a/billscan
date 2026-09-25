import * as Crypto from 'expo-crypto';
import type { DraftBill, Extraction } from '@/lib/billRules';
import { MonthId } from '@/lib/months';
import { getDb } from './index';
import { ensureMonth, reopenMonth } from './repo';
import { Section } from './schema';

export type BillStatus = 'draft' | 'saved' | 'cancelled';

export interface BillRecord extends DraftBill {
  id: string;
  month: MonthId;
  status: BillStatus;
  imagePaths: string[];
  extraction: Extraction | null;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  month: string;
  section: Section;
  status: BillStatus;
  bill_date: string | null;
  bill_no: string | null;
  no_bill_no: number;
  vendor_name: string | null;
  vendor_vat_no: string | null;
  description: string;
  shop_rate: number | null;
  vat: number | null;
  discount: number;
  discount_type: DraftBill['discountType'];
  grand_total: number | null;
  total_only: number;
  payment_mode: string | null;
  remarks: string;
  flags: string;
  image_paths: string;
  ai_raw_json: string | null;
  created_at: string;
  updated_at: string;
}

/** vat_source and vendor_vat_registered are kept inside the flags JSON column (no schema change needed). */
interface StoredMeta {
  vatSource?: DraftBill['vatSource'];
  vendorVatRegistered?: boolean;
}

function fromRow(r: Row): BillRecord {
  let meta: StoredMeta = {};
  try {
    const parsed = JSON.parse(r.flags);
    if (parsed && !Array.isArray(parsed)) meta = parsed;
  } catch {
    meta = {};
  }
  let extraction: Extraction | null = null;
  try {
    extraction = r.ai_raw_json ? (JSON.parse(r.ai_raw_json) as Extraction) : null;
  } catch {
    extraction = null;
  }
  let imagePaths: string[] = [];
  try {
    imagePaths = JSON.parse(r.image_paths);
  } catch {
    imagePaths = [];
  }
  return {
    id: r.id,
    month: r.month,
    status: r.status,
    section: r.section,
    billDate: r.bill_date,
    billNo: r.bill_no,
    noBillNo: r.no_bill_no === 1,
    vendorName: r.vendor_name,
    vendorVatNo: r.vendor_vat_no,
    vendorVatRegistered: meta.vendorVatRegistered ?? Boolean(r.vendor_vat_no),
    description: r.description,
    shopRate: r.shop_rate,
    vat: r.vat,
    discount: r.discount,
    discountType: r.discount_type,
    grandTotal: r.grand_total,
    vatSource: meta.vatSource ?? (r.total_only ? 'calculated' : 'printed'),
    paymentMode: r.payment_mode ?? 'unknown',
    remarks: r.remarks,
    imagePaths,
    extraction,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const EMPTY_DRAFT: DraftBill = {
  billDate: null,
  billNo: null,
  noBillNo: false,
  vendorName: null,
  vendorVatNo: null,
  vendorVatRegistered: false,
  description: '',
  section: 'MATERIAL',
  shopRate: null,
  vat: null,
  discount: 0,
  discountType: 'none',
  grandTotal: null,
  vatSource: 'printed',
  paymentMode: 'unknown',
  remarks: '',
};

/** Create a draft bill right after scanning (before or after the AI has read it). */
export async function createBill(
  userId: string,
  month: MonthId,
  draft: DraftBill,
  imagePaths: string[],
  extraction: Extraction | null,
  id: string = Crypto.randomUUID(),
): Promise<string> {
  await ensureMonth(userId, month);
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO bill (id, user_id, month, section, status, bill_date, bill_no, no_bill_no, vendor_name, vendor_vat_no,
       description, shop_rate, vat, discount, discount_type, grand_total, total_only, payment_mode, remarks, flags,
       image_paths, ai_raw_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    month,
    draft.section,
    draft.billDate,
    draft.billNo,
    draft.noBillNo ? 1 : 0,
    draft.vendorName,
    draft.vendorVatNo,
    draft.description,
    draft.shopRate,
    draft.vat,
    draft.discount,
    draft.discountType,
    draft.grandTotal,
    draft.vatSource === 'calculated' ? 1 : 0,
    draft.paymentMode,
    draft.remarks,
    JSON.stringify({ vatSource: draft.vatSource, vendorVatRegistered: draft.vendorVatRegistered } satisfies StoredMeta),
    JSON.stringify(imagePaths),
    extraction ? JSON.stringify(extraction) : null,
    now,
    now,
  );
  return id;
}

export async function getBill(userId: string, id: string): Promise<BillRecord | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>('SELECT * FROM bill WHERE user_id = ? AND id = ?', userId, id);
  return r ? fromRow(r) : null;
}

/** Update the editable fields (and optionally the AI reading and month). */
export async function updateBill(
  userId: string,
  id: string,
  draft: DraftBill,
  opts: { month?: MonthId; status?: BillStatus; extraction?: Extraction | null } = {},
): Promise<void> {
  const db = await getDb();
  if (opts.month) await ensureMonth(userId, opts.month);
  const before = await db.getFirstAsync<{ month: string; status: BillStatus }>('SELECT month, status FROM bill WHERE user_id = ? AND id = ?', userId, id);
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE bill SET section = ?, bill_date = ?, bill_no = ?, no_bill_no = ?, vendor_name = ?, vendor_vat_no = ?,
       description = ?, shop_rate = ?, vat = ?, discount = ?, discount_type = ?, grand_total = ?, total_only = ?,
       payment_mode = ?, remarks = ?, flags = ?, updated_at = ?,
       month = COALESCE(?, month), status = COALESCE(?, status),
       ai_raw_json = CASE WHEN ? = 1 THEN ? ELSE ai_raw_json END
     WHERE user_id = ? AND id = ?`,
    draft.section,
    draft.billDate,
    draft.billNo,
    draft.noBillNo ? 1 : 0,
    draft.vendorName,
    draft.vendorVatNo,
    draft.description,
    draft.shopRate,
    draft.vat,
    draft.discount,
    draft.discountType,
    draft.grandTotal,
    draft.vatSource === 'calculated' ? 1 : 0,
    draft.paymentMode,
    draft.remarks,
    JSON.stringify({ vatSource: draft.vatSource, vendorVatRegistered: draft.vendorVatRegistered } satisfies StoredMeta),
    now,
    opts.month ?? null,
    opts.status ?? null,
    opts.extraction !== undefined ? 1 : 0,
    opts.extraction ? JSON.stringify(opts.extraction) : null,
    userId,
    id,
  );
  // Only saved and cancelled bills are in the report; drafts don't reopen an exported month.
  const statusAfter = opts.status ?? before?.status;
  if (before && (before.status !== 'draft' || (statusAfter && statusAfter !== 'draft'))) {
    await reopenMonth(userId, before.month);
    if (opts.month && opts.month !== before.month) await reopenMonth(userId, opts.month);
  }
}

export async function setBillStatus(userId: string, id: string, status: BillStatus): Promise<void> {
  const db = await getDb();
  const before = await db.getFirstAsync<{ month: string }>('SELECT month FROM bill WHERE user_id = ? AND id = ?', userId, id);
  if (before) await reopenMonth(userId, before.month);
  await db.runAsync('UPDATE bill SET status = ?, updated_at = ? WHERE user_id = ? AND id = ?', status, new Date().toISOString(), userId, id);
}

export async function deleteBill(userId: string, id: string): Promise<string[]> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ image_paths: string; month: string; status: BillStatus }>(
    'SELECT image_paths, month, status FROM bill WHERE user_id = ? AND id = ?',
    userId,
    id,
  );
  await db.runAsync('DELETE FROM bill WHERE user_id = ? AND id = ?', userId, id);
  if (r && r.status !== 'draft') await reopenMonth(userId, r.month);
  try {
    return r ? JSON.parse(r.image_paths) : [];
  } catch {
    return [];
  }
}

export type BillListFilter = { kind: 'section'; section: Section } | { kind: 'cancelled' } | { kind: 'drafts' };

export async function listBills(userId: string, month: MonthId, filter: BillListFilter): Promise<BillRecord[]> {
  const db = await getDb();
  let where = "status = 'saved' AND section = ?";
  const params: (string | number)[] = [userId, month];
  if (filter.kind === 'section') params.push(filter.section);
  else if (filter.kind === 'cancelled') where = "status = 'cancelled'";
  else where = "status = 'draft'";
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM bill WHERE user_id = ? AND month = ? AND ${where} ORDER BY bill_date IS NULL, bill_date, created_at`,
    ...params,
  );
  return rows.map(fromRow);
}

/** Saved or draft bills that look like the same bill (Blueprint §5). */
export async function findDuplicates(userId: string, id: string, d: DraftBill): Promise<BillRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM bill WHERE user_id = ? AND id <> ? AND status <> 'cancelled' AND (
        (? IS NOT NULL AND ? <> '' AND LTRIM(bill_no, '0') = LTRIM(?, '0')
           AND (COALESCE(vendor_name, '') = COALESCE(?, '') OR grand_total = ?))
        OR (bill_date = ? AND grand_total = ?)
      ) LIMIT 3`,
    userId,
    id,
    d.billNo,
    d.billNo ?? '',
    d.billNo ?? '',
    d.vendorName,
    d.grandTotal,
    d.billDate,
    d.grandTotal,
  );
  return rows.map(fromRow);
}
