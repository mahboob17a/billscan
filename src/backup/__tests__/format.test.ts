import { BACKUP_FORMAT, backupFileName, pickColumns, relativisePhotos, validateManifest } from '../format';

describe('backup format', () => {
  it('makes photo paths relative and lists the files to copy', () => {
    const { bills, photos } = relativisePhotos([
      { id: 'b1', image_paths: JSON.stringify(['file:///data/bills/b1/page-1.jpg', 'file:///data/bills/b1/page-2.jpg']) },
      { id: 'b2', image_paths: '[]' },
      { id: 'b3', image_paths: 'not json' },
    ]);
    expect(JSON.parse(String(bills[0].image_paths))).toEqual(['photos/b1/page-1.jpg', 'photos/b1/page-2.jpg']);
    expect(bills[2].image_paths).toBe('[]');
    expect(photos).toEqual([
      { entry: 'photos/b1/page-1.jpg', source: 'file:///data/bills/b1/page-1.jpg' },
      { entry: 'photos/b1/page-2.jpg', source: 'file:///data/bills/b1/page-2.jpg' },
    ]);
  });

  it('rejects files that are not BillScan backups or are too new', () => {
    expect(validateManifest(null)).toMatch(/not a BillScan backup/);
    expect(validateManifest({ format: 'x' })).toMatch(/not a BillScan backup/);
    expect(validateManifest({ format: BACKUP_FORMAT, version: 99, tables: { bill: [] } })).toMatch(/newer/);
    expect(validateManifest({ format: BACKUP_FORMAT, version: 1, tables: {} })).toMatch(/damaged/);
    expect(validateManifest({ format: BACKUP_FORMAT, version: 1, tables: { bill: [] } })).toBeNull();
  });

  it('drops columns this version does not have', () => {
    expect(pickColumns({ id: 'a', future_col: 1, month: '2026-09' }, new Set(['id', 'month']))).toEqual({ id: 'a', month: '2026-09' });
  });

  it('names the file with date and time', () => {
    expect(backupFileName(new Date(2026, 9, 5, 7, 3))).toBe('BillScan-backup-2026-10-05-0703.zip');
  });
});
