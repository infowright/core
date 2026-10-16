import { toIsoDate } from '@infowright/common';

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
 * Reads a date cell from a programme or CDE export.
 * Understands Excel dates and serial numbers, YYYY-MM-DD with or without a time or time zone,
 * 23/03/2026 and 03/23/2026 (see DateOptions), 23.03.26, the Primavera P6 style "23-Mar-26",
 * "23 March 2026", "Mar 23, 2026 3:24 PM" and a leading weekday, including the "A" (actual) and
 * "*" (constraint) markers. Returns undefined for empty or unrecognised values.
 */
export function parseScheduleDate(
  value: unknown,
  options: DateOptions = {},
): ScheduleDate | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    // Spreadsheet readers give dates as midnight UTC. Read those in UTC so the day does not
    // shift in time zones west of Greenwich; any other time is read in local time.
    const utc = value.getUTCHours() === 0 && value.getUTCMinutes() === 0;
    const date = utc
      ? toIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
      : toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
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
  const date = readDateText(text, options.dayFirst);
  return date ? { date, actual } : undefined;
}

export interface DateOptions {
  /**
   * How to read 03/04/2026 when the day and month could be either way round. True (the default)
   * reads 3 April, as in the UK and Europe; false reads March 4, as in the US. Find it for a whole
   * column with guessDayFirst.
   */
  dayFirst?: boolean | undefined;
}

const WEEKDAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i;
const TIME =
  /(?:,?\s+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2}(?:\.\d+)?)?(?:\s*[ap]\.?m\.?)?(?:\s*(?:[a-z]{2,5}|[+-]\d{2}:?\d{2}|z))?)$/i;
const NUMERIC = /^(\d{1,2})([./-])(\d{1,2})\2(\d{2}|\d{4})$/;

function year(y: string): number {
  return y.length === 2 ? (Number(y) < 70 ? 2000 + Number(y) : 1900 + Number(y)) : Number(y);
}

function month(name: string): number | undefined {
  return MONTHS[name.slice(0, 3).toLowerCase()];
}

/** Reads the many ways CDEs and programmes write a date. */
function readDateText(raw: string, dayFirst: boolean | undefined): string | undefined {
  // 2026-03-23, 2026-03-23T08:00:00Z, 2026-03-23 08:00:00.000+01:00
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T][\d:.]+(?:z|[+-]\d{2}:?\d{2})?)?$/i.exec(raw);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const text = raw.replace(WEEKDAY, '').replace(TIME, '').trim();

  // 2026/03/23
  const ymd = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(text);
  if (ymd) return toIsoDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  // 23/03/2026, 03/23/2026, 23.03.26, 23-03-2026
  const num = NUMERIC.exec(text);
  if (num) {
    const a = Number(num[1]);
    const b = Number(num[3]);
    const y = year(num[4] ?? '');
    // A dot is only used day first; otherwise a number over 12 settles it.
    const first = num[2] === '.' || a > 12 ? true : b > 12 ? false : (dayFirst ?? true);
    return first ? toIsoDate(y, b, a) : toIsoDate(y, a, b);
  }

  // 23-Mar-26, 23 Mar 2026, 23 March 2026, 23-March-2026
  const dmy = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})\.?[\s,-]+(\d{2}|\d{4})$/i.exec(text);
  if (dmy) {
    const m = month(dmy[2] ?? '');
    return m ? toIsoDate(year(dmy[3] ?? ''), m, Number(dmy[1])) : undefined;
  }

  // Mar 23, 2026 and March 23 2026
  const mdy = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(text);
  if (mdy) {
    const m = month(mdy[1] ?? '');
    return m ? toIsoDate(Number(mdy[3]), m, Number(mdy[2])) : undefined;
  }
  return undefined;
}

/**
 * Looks through a column of dates to see which way round day and month are: any first number
 * over 12 means day first, any second number over 12 means month first. Undefined when every
 * date could be either.
 */
export function guessDayFirst(values: readonly unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim().replace(WEEKDAY, '').replace(TIME, '').trim();
    const num = NUMERIC.exec(text);
    if (!num || num[2] === '.') continue;
    if (Number(num[1]) > 12) return true;
    if (Number(num[3]) > 12) return false;
  }
  return undefined;
}
