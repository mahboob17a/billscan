/** Report file naming and revision numbers (pure; unit-tested). */

export function reportFileName(statementRef: string, revision: number): string {
  const safe = statementRef.replace(/[^A-Za-z0-9._-]+/g, '-');
  return revision > 0 ? `${safe}-R${revision}.xlsx` : `${safe}.xlsx`;
}

/**
 * The revision the next export gets: the first export is 0; exporting again after
 * a saved bill or cash entry changed gives R1, R2…; exporting an unchanged month keeps its number.
 */
export function nextRevision(m: { exportedAt: string | null; status: 'open' | 'exported'; revision: number }): number {
  if (!m.exportedAt) return 0;
  return m.status === 'open' ? m.revision + 1 : m.revision;
}
