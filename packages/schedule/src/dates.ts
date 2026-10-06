import { isIsoDate, toIsoDate } from '@infowright/common';

export interface ScheduleDate {
  /** YYYY-MM-DD */
  date: string;
  /** True when the programme marks the date as an actual ("A" suffix in Primavera P6). */
  actual: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Excel stores dates as days since 1899-12-30 (1900 date system). */
function fromExcelSerial(serial: number): string | undefined {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return undefined;
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Reads a date cell from a programme export.
 * Understands Excel dates, Excel serial numbers, YYYY-MM-DD (with or without time)
 * and the Primavera P6 style "23-Mar-26", including the "A" (actual) and "*" (constraint) markers.
 * Returns undefined for empty or unrecognised values.
 */
export function parseScheduleDate(value: unknown): ScheduleDate | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const date = toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    return date ? { date, actual: false } : undefined;
  }

  if (typeof value === 'number') {
    const date = fromExcelSerial(value);
    return date ? { date, actual: false } : undefined;
  }

  if (typeof value !== 'string') return undefined;

  let text = value.trim();
  if (!text) return undefined;

  let actual = false;
  if (/\sA$/.test(text)) {
    actual = true;
    text = text.slice(0, -1).trim();
  }
  text = text.replace(/\*$/, '').trim();

  const iso = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.exec(text);
  if (iso?.[1] && isIsoDate(iso[1])) return { date: iso[1], actual };

  const p6 = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})(?:\s+\d{1,2}:\d{2})?$/.exec(text);
  if (p6) {
    const [, d, mon, y] = p6;
    const month = MONTHS[(mon ?? '').toLowerCase()];
    if (!month || !d || !y) return undefined;
    const year =
      y.length === 2 ? (Number(y) < 70 ? 2000 + Number(y) : 1900 + Number(y)) : Number(y);
    const date = toIsoDate(year, month, Number(d));
    return date ? { date, actual } : undefined;
  }

  return undefined;
}
