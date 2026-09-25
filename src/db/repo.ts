import * as Crypto from 'expo-crypto';
import { DEFAULT_REF_PATTERN, MonthId, statementRef } from '@/lib/months';
import { Baisa } from '@/lib/money';
import { getDb } from './index';
import { DEFAULT_DESCRIPTIONS, Section, SECTIONS } from './schema';

// ── Report header settings (per user) ────────────────────────────────────

export interface ReportSettings {
  companyName: string;
  contractLine: string;
  preparedBy: string;
  submittedTo: string;
  refPattern: string;
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  companyName: 'DARYAS TRADING AND CONTRACTING  LLC',
  contractLine: 'UTAS Nizwa — North & South Campus  |  O&M Maintenance Contract',
  preparedBy: '',
  submittedTo: 'Cashier, Daryas Trading & Contracting',
  refPattern: DEFAULT_REF_PATTERN,
};

const SETTING_KEYS: Record<keyof ReportSettings, string> = {
  companyName: 'report.company_name',
  contractLine: 'report.contract_line',
  preparedBy: 'report.prepared_by',
  submittedTo: 'report.submitted_to',
  refPattern: 'report.ref_pattern',
};

export async function getReportSettings(userId: string): Promise<ReportSettings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings WHERE user_id = ? AND key LIKE ?',
    userId,
    'report.%',
  );
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_REPORT_SETTINGS };
  (Object.keys(SETTING_KEYS) as (keyof ReportSettings)[]).forEach((k) => {
    const v = byKey.get(SETTING_KEYS[k]);
    if (v !== undefined) out[k] = v;
  });
  return out;
}

export async function saveReportSettings(userId: string, s: ReportSettings): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const k of Object.keys(SETTING_KEYS) as (keyof ReportSettings)[]) {
      await db.runAsync(
        'INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value',
        userId,
        SETTING_KEYS[k],
        s[k],
      );
    }
  });
}

// ── First-run setup for a user ───────────────────────────────────────────

/** Seed the description list and the Prepared By name the first time a user signs in on this phone. */
export async function ensureUserSetup(userId: string, preparedBy: string): Promise<void> {
  const db = await getDb();
  const seeded = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM description_catalog WHERE user_id = ?', userId);
  if (!seeded || seeded.n === 0) {
    await db.withTransactionAsync(async () => {
      let i = 0;
      for (const d of DEFAULT_DESCRIPTIONS) {
        await db.runAsync(
          'INSERT OR IGNORE INTO description_catalog (user_id, label, section, active, sort) VALUES (?, ?, ?, 1, ?)',
          userId,
          d.label,
          d.section,
          i++,
        );
      }
    });
  }
  const current = await getReportSettings(userId);
  if (!current.preparedBy && preparedBy) {
    await saveReportSettings(userId, { ...current, preparedBy });
  }
}

// ── Description list (one label per bill) ─────────────────────────────────

export interface DescriptionItem {
  label: string;
  section: Section;
}

export async function listDescriptions(userId: string): Promise<DescriptionItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DescriptionItem>(
    'SELECT label, section FROM description_catalog WHERE user_id = ? AND active = 1 ORDER BY sort, label',
    userId,
  );
  return rows.length ? rows : DEFAULT_DESCRIPTIONS;
}

export interface DescriptionRow extends DescriptionItem {
  active: boolean;
  used: number; // bills using this label
}

/** Every label (active and retired) with how many bills use it — for the editor in Settings. */
export async function listAllDescriptions(userId: string): Promise<DescriptionRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ label: string; section: Section; active: number; used: number }>(
    `SELECT d.label, d.section, d.active,
            (SELECT COUNT(*) FROM bill b WHERE b.user_id = d.user_id AND b.description = d.label) AS used
       FROM description_catalog d WHERE d.user_id = ? ORDER BY d.sort, d.label`,
    userId,
  );
  return rows.map((r) => ({ label: r.label, section: r.section, active: r.active === 1, used: r.used }));
}

export function cleanLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** Add a label (or bring back a retired one). Returns an error message or null. */
export async function addDescription(userId: string, label: string, section: Section): Promise<string | null> {
  const clean = cleanLabel(label);
  if (clean.length < 2) return 'Type a description of at least 2 letters.';
  const db = await getDb();
  const existing = await db.getFirstAsync<{ label: string; active: number }>(
    'SELECT label, active FROM description_catalog WHERE user_id = ? AND LOWER(label) = LOWER(?)',
    userId,
    clean,
  );
  if (existing?.active === 1) return `“${existing.label}” is already in the list.`;
  if (existing) {
    await db.runAsync('UPDATE description_catalog SET active = 1, section = ? WHERE user_id = ? AND label = ?', section, userId, existing.label);
    return null;
  }
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort) AS m FROM description_catalog WHERE user_id = ?', userId);
  await db.runAsync(
    'INSERT INTO description_catalog (user_id, label, section, active, sort) VALUES (?, ?, ?, 1, ?)',
    userId,
    clean,
    section,
    (max?.m ?? 0) + 1,
  );
  return null;
}

/**
 * Rename a label and/or move it to another section. Draft bills follow the new name;
 * saved bills keep the name they were saved with (the report already went out with it).
 */
export async function updateDescription(userId: string, oldLabel: string, newLabel: string, section: Section): Promise<string | null> {
  const clean = cleanLabel(newLabel);
  if (clean.length < 2) return 'Type a description of at least 2 letters.';
  const db = await getDb();
  if (clean.toLowerCase() !== oldLabel.toLowerCase()) {
    const clash = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM description_catalog WHERE user_id = ? AND LOWER(label) = LOWER(?)',
      userId,
      clean,
    );
    if (clash && clash.n > 0) return `“${clean}” is already in the list.`;
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE description_catalog SET label = ?, section = ? WHERE user_id = ? AND label = ?', clean, section, userId, oldLabel);
    await db.runAsync("UPDATE bill SET description = ?, section = ? WHERE user_id = ? AND description = ? AND status = 'draft'", clean, section, userId, oldLabel);
  });
  return null;
}

/** Retire (hide from the list and from the AI) or bring back a label. Bills keep their text. */
export async function setDescriptionActive(userId: string, label: string, active: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE description_catalog SET active = ? WHERE user_id = ? AND label = ?', active ? 1 : 0, userId, label);
}

/** The list grouped by section, as sent to the AI. */
export function descriptionsBySection(items: DescriptionItem[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of items) (out[d.section] ??= []).push(d.label);
  return out;
}

// ── Month summary (dashboard) ─────────────────────────────────────────────

export interface SectionTotal {
  section: Section;
  bills: number;
  total: Baisa;
}

export interface MonthSummary {
  month: MonthId;
  statementRef: string;
  sections: SectionTotal[];
  cancelledBills: number;
  purchases: Baisa;
  cashReceived: Baisa;
  cashEntries: number;
  balanceDue: Baisa;
  draftsToReview: number;
}

export async function ensureMonth(userId: string, month: MonthId): Promise<void> {
  const db = await getDb();
  const settings = await getReportSettings(userId);
  await db.runAsync(
    'INSERT OR IGNORE INTO report_month (user_id, month, statement_ref) VALUES (?, ?, ?)',
    userId,
    month,
    statementRef(month, settings.refPattern),
  );
}

/** A change to a month's saved bills or cash reopens an exported month; the next export is a revision. */
export async function reopenMonth(userId: string, month: MonthId): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE report_month SET status = 'open' WHERE user_id = ? AND month = ? AND status = 'exported'", userId, month);
}

export interface ReportMonth {
  month: MonthId;
  statementRef: string;
  datePrepared: string | null;
  status: 'open' | 'exported';
  exportedAt: string | null;
  revision: number;
  exportedFile: string | null;
}

export async function getReportMonth(userId: string, month: MonthId): Promise<ReportMonth> {
  await ensureMonth(userId, month);
  const db = await getDb();
  const r = await db.getFirstAsync<{
    statement_ref: string;
    date_prepared: string | null;
    status: 'open' | 'exported';
    exported_at: string | null;
    revision: number;
    exported_file: string | null;
  }>('SELECT statement_ref, date_prepared, status, exported_at, revision, exported_file FROM report_month WHERE user_id = ? AND month = ?', userId, month);
  return {
    month,
    statementRef: r?.statement_ref ?? '',
    datePrepared: r?.date_prepared ?? null,
    status: r?.status ?? 'open',
    exportedAt: r?.exported_at ?? null,
    revision: r?.revision ?? 0,
    exportedFile: r?.exported_file ?? null,
  };
}

export async function markMonthExported(
  userId: string,
  month: MonthId,
  info: { datePrepared: string; revision: number; file: string },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE report_month SET status = 'exported', exported_at = ?, date_prepared = ?, revision = ?, exported_file = ? WHERE user_id = ? AND month = ?",
    new Date().toISOString(),
    info.datePrepared,
    info.revision,
    info.file,
    userId,
    month,
  );
}

export async function getMonthSummary(userId: string, month: MonthId): Promise<MonthSummary> {
  await ensureMonth(userId, month);
  const db = await getDb();
  const rows = await db.getAllAsync<{ section: Section; bills: number; total: number | null }>(
    `SELECT section, COUNT(*) AS bills, SUM(grand_total) AS total
       FROM bill WHERE user_id = ? AND month = ? AND status = 'saved'
      GROUP BY section`,
    userId,
    month,
  );
  const byS = new Map(rows.map((r) => [r.section, r]));
  const sections = SECTIONS.map((section) => ({
    section,
    bills: byS.get(section)?.bills ?? 0,
    total: byS.get(section)?.total ?? 0,
  }));
  const cancelled = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM bill WHERE user_id = ? AND month = ? AND status = 'cancelled'",
    userId,
    month,
  );
  const drafts = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM bill WHERE user_id = ? AND month = ? AND status = 'draft'",
    userId,
    month,
  );
  const cash = await db.getFirstAsync<{ n: number; total: number | null }>(
    'SELECT COUNT(*) AS n, SUM(amount) AS total FROM cash_entry WHERE user_id = ? AND month = ?',
    userId,
    month,
  );
  const ref = await db.getFirstAsync<{ statement_ref: string }>(
    'SELECT statement_ref FROM report_month WHERE user_id = ? AND month = ?',
    userId,
    month,
  );
  const purchases = sections.reduce((a, s) => a + s.total, 0);
  const cashReceived = cash?.total ?? 0;
  return {
    month,
    statementRef: ref?.statement_ref ?? '',
    sections,
    cancelledBills: cancelled?.n ?? 0,
    purchases,
    cashReceived,
    cashEntries: cash?.n ?? 0,
    balanceDue: purchases - cashReceived,
    draftsToReview: drafts?.n ?? 0,
  };
}

// ── Cash received (Section F) ─────────────────────────────────────────────

export interface CashEntry {
  id: string;
  entryDate: string;
  description: string;
  amount: Baisa;
  remarks: string;
}

export async function listCashEntries(userId: string, month: MonthId): Promise<CashEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; entry_date: string; description: string; amount: number; remarks: string }>(
    'SELECT id, entry_date, description, amount, remarks FROM cash_entry WHERE user_id = ? AND month = ? ORDER BY entry_date, created_at',
    userId,
    month,
  );
  return rows.map((r) => ({ id: r.id, entryDate: r.entry_date, description: r.description, amount: r.amount, remarks: r.remarks }));
}

export async function addCashEntry(
  userId: string,
  month: MonthId,
  e: Omit<CashEntry, 'id'>,
): Promise<void> {
  await ensureMonth(userId, month);
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO cash_entry (id, user_id, month, entry_date, description, amount, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    Crypto.randomUUID(),
    userId,
    month,
    e.entryDate,
    e.description,
    e.amount,
    e.remarks,
    new Date().toISOString(),
  );
  await reopenMonth(userId, month);
}

export async function deleteCashEntry(userId: string, id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ month: string }>('SELECT month FROM cash_entry WHERE user_id = ? AND id = ?', userId, id);
  await db.runAsync('DELETE FROM cash_entry WHERE user_id = ? AND id = ?', userId, id);
  if (row) await reopenMonth(userId, row.month);
}
