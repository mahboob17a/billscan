/** Create and restore BillScan backups on the phone (see format.ts). */
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { getDb } from '@/db';
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  BackupManifest,
  backupFileName,
  pickColumns,
  relativisePhotos,
  Row,
  validateManifest,
} from './format';

export async function createBackup(userId: string, email: string): Promise<{ uri: string; fileName: string; manifest: BackupManifest }> {
  const db = await getDb();
  const tables = {} as BackupManifest['tables'];
  for (const t of BACKUP_TABLES) {
    tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t} WHERE user_id = ?`, userId);
  }
  const { bills, photos } = relativisePhotos(tables.bill);
  tables.bill = bills;

  const zip: Zippable = {};
  let photoCount = 0;
  for (const p of photos) {
    try {
      zip[p.entry] = [await new File(p.source).bytes(), { level: 0 }]; // JPEGs are already compressed
      photoCount += 1;
    } catch {
      // Missing photo: the bill is still backed up.
    }
  }
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: `${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`,
    userId,
    email,
    counts: { months: tables.report_month.length, bills: tables.bill.length, cash: tables.cash_entry.length, photos: photoCount },
    tables,
  };
  zip['billscan.json'] = strToU8(JSON.stringify(manifest));
  const bytes = zipSync(zip);

  const dir = new Directory(Paths.document, 'backups');
  dir.create({ intermediates: true, idempotent: true });
  // Keep only the newest backups on the phone itself.
  for (const old of dir.list().filter((f): f is File => f instanceof File).sort((a, b) => a.name.localeCompare(b.name)).slice(0, -2)) {
    try {
      old.delete();
    } catch {
      // ignore
    }
  }
  const fileName = backupFileName();
  const file = new File(dir, fileName);
  file.create({ overwrite: true });
  file.write(bytes);
  return { uri: file.uri, fileName, manifest };
}

export async function shareBackup(uri: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: `Save ${fileName}` });
}

export interface PickedBackup {
  manifest: BackupManifest;
  files: Record<string, Uint8Array>;
}

/** Let the user choose a backup file and check it. Returns null if they cancelled. */
export async function pickBackup(): Promise<PickedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/octet-stream', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const bytes = await new File(res.assets[0].uri).bytes();
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('This file is not a BillScan backup (not a zip file).');
  }
  if (!files['billscan.json']) throw new Error('This file is not a BillScan backup.');
  const manifest = JSON.parse(strFromU8(files['billscan.json'])) as BackupManifest;
  const err = validateManifest(manifest);
  if (err) throw new Error(err);
  return { manifest, files };
}

/**
 * Restore into the signed-in user's data. Rows with the same id (bills, cash entries,
 * months, settings, descriptions) are replaced by the backup's copy; everything else on
 * the phone is kept.
 */
export async function restoreBackup(userId: string, picked: PickedBackup): Promise<{ bills: number; photos: number }> {
  const db = await getDb();
  const { manifest, files } = picked;

  // 1. Photos → this phone's storage; map zip entries to new file URIs.
  const uriFor = new Map<string, string>();
  let photos = 0;
  for (const [entry, data] of Object.entries(files)) {
    const m = entry.match(/^photos\/([^/]+)\/(page-\d+\.jpg)$/);
    if (!m) continue;
    const dir = new Directory(Paths.document, 'bills', m[1]);
    dir.create({ intermediates: true, idempotent: true });
    const f = new File(dir, m[2]);
    f.create({ overwrite: true });
    f.write(data);
    uriFor.set(entry, f.uri);
    photos += 1;
  }

  // 2. Rows, restricted to the columns this version knows, owned by the current user.
  await db.withTransactionAsync(async () => {
    for (const t of BACKUP_TABLES) {
      const cols = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name));
      for (const raw of manifest.tables[t] ?? []) {
        const row = pickColumns({ ...raw, user_id: userId }, cols);
        if (t === 'bill') {
          let rel: string[] = [];
          try {
            rel = JSON.parse(String(row.image_paths ?? '[]'));
          } catch {
            rel = [];
          }
          row.image_paths = JSON.stringify(rel.map((e) => uriFor.get(e)).filter(Boolean));
        }
        const keys = Object.keys(row);
        if (keys.length === 0) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          ...keys.map((k) => row[k]),
        );
      }
    }
  });
  return { bills: manifest.tables.bill.length, photos };
}
