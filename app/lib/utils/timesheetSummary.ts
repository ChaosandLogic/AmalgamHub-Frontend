/** Hours for one job in timesheet.summary.jobs — either a number or { totalHours, ... }. */
export function jobSummaryHours(entry: unknown): number {
  if (entry != null && typeof entry === 'object' && 'totalHours' in entry) {
    const th = (entry as { totalHours?: unknown }).totalHours
    return typeof th === 'number' ? th : parseFloat(String(th)) || 0
  }
  if (typeof entry === 'number') return entry
  return parseFloat(String(entry)) || 0
}
