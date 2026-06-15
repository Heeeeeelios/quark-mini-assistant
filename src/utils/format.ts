const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Format bytes into a human-readable string.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '-';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const clampedIndex = Math.min(i, UNITS.length - 1);
  const value = bytes / Math.pow(1024, clampedIndex);

  // Show 1 decimal for KB+, integers for B
  const decimals = clampedIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${UNITS[clampedIndex]}`;
}

/**
 * Format ISO date to a readable string.
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${y}-${m}-${d} ${h}:${min}`;
}
