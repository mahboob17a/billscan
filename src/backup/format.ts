/**
 * Backup file format (Blueprint §6 Settings → Backup): one .zip holding
 *   billscan.json   — every row of the user's tables
 *   photos/<billId>/page-N.jpg — the bill photos
 * Photo paths inside the backup are relative, so a restore on another phone
 * points them at that phone's own storage. Pure helpers (unit-tested).
 */

export const BACKUP_FORMAT = 'billscan-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_TABLES = ['settings', 'report_month', 'description_catalog', 'cash_entry', 'bill'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
export type Row = Record<string, string | number | null>;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  appVersion: string;
  userId: string;
  email: string;
  counts: { months: number; bills: number; cash: number; photos: number };
  tables: Record<BackupTable, Row[]>;
}

/** Name of a photo inside the zip. */
export const photoEntry = (billId: string, index: number) => `photos/${billId}/page-${index + 1}.jpg`;

/** Replace each bill's device photo paths with zip entry names; returns the files to add. */
export function relativisePhotos(bills: Row[]): { bills: Row[]; photos: { entry: string; source: string }[] } {
  const photos: { entry: string; source: string }[] = [];
  const out = bills.map((b) => {
    let paths: string[] = [];
    try {
      paths = JSON.parse(String(b.image_paths ?? '[]'));
    } catch {
      paths = [];
    }
    const rel = paths.map((p, i) => {
      const entry = photoEntry(String(b.id), i);
      photos.push({ entry, source: p });
      return entry;
    });
    return { ...b, image_paths: JSON.stringify(rel) };
  });
  return { bills: out, photos };
}

/** Check a parsed billscan.json before restoring it. Returns an error message or null. */
export function validateManifest(m: unknown): string | null {
  const x = m as Partial<BackupManifest> | null;
  if (!x || x.format !== BACKUP_FORMAT) return 'This file is not a BillScan backup.';
  if (typeof x.version !== 'number' || x.version > BACKUP_VERSION) return 'This backup was made by a newer BillScan. Update the app first.';
  if (!x.tables || !Array.isArray(x.tables.bill)) return 'The backup is damaged (no bills table).';
  return null;
}

/** Keep only columns that exist in this phone's table (backups from older/newer versions). */
export function pickColumns(row: Row, columns: Set<string>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) if (columns.has(k)) out[k] = v;
  return out;
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `BillScan-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.zip`;
}
