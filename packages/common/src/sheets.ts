/** One worksheet: its name and its cells, row by row, as read by any spreadsheet reader. */
export interface SheetInput {
  name: string;
  rows: readonly (readonly unknown[])[];
}

/** A cell as trimmed text. Empty for missing cells. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Header text compared without case, spaces or punctuation. */
export const normaliseHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
