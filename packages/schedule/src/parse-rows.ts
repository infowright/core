import { parseScheduleDate } from './dates';
import type { Activity, Schedule } from './types';

export interface ParseResult {
  schedule: Schedule;
  /** Problems in plain language. The schedule still contains every row that could be read. */
  problems: string[];
}

const normalise = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Accepted column headers, in order of preference. Compared without case, spaces or punctuation. */
const COLUMNS = {
  id: ['activityid', 'taskcode', 'activitycode', 'uniqueid', 'id'],
  name: ['activityname', 'taskname', 'name', 'description'],
  start: ['start', 'startdate', 'plannedstart', 'earlystart'],
  finish: ['finish', 'finishdate', 'plannedfinish', 'earlyfinish', 'end', 'enddate'],
} as const;

function findColumn(headers: string[], aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const found = headers.find((h) => normalise(h) === alias);
    if (found !== undefined) return found;
  }
  return undefined;
}

const text = (value: unknown) =>
  value === null || value === undefined ? '' : String(value).trim();

/**
 * Reads programme rows exported to Excel (Primavera P6, Microsoft Project or a plain sheet).
 * Each row is an object of column header to cell value, as produced by any spreadsheet reader.
 * Header names are matched loosely, so "Activity ID", "activity_id" and "ActivityID" all work.
 * Rows without an activity ID (e.g. WBS summary rows) are skipped.
 */
export function parseScheduleRows(rows: readonly Record<string, unknown>[]): ParseResult {
  const problems: string[] = [];
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];

  const col = {
    id: findColumn(headers, COLUMNS.id),
    name: findColumn(headers, COLUMNS.name),
    start: findColumn(headers, COLUMNS.start),
    finish: findColumn(headers, COLUMNS.finish),
  };

  if (!col.id) {
    problems.push(
      'No activity ID column found. Expected a column such as "Activity ID" or "Task Code".',
    );
    return { schedule: { activities: [] }, problems };
  }
  if (!col.finish) {
    problems.push(
      'No finish date column found. Delivery dates cannot be taken from this programme.',
    );
  }

  const activities: Activity[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const id = text(row[col.id as string]);
    if (!id) return;
    if (seen.has(id)) {
      problems.push(
        `Activity ${id} appears more than once (row ${index + 1}). The first one is used.`,
      );
      return;
    }
    seen.add(id);

    const activity: Activity = {
      id,
      name: col.name ? text(row[col.name]) : '',
      startActual: false,
      finishActual: false,
    };

    for (const key of ['start', 'finish'] as const) {
      const column = col[key];
      if (!column) continue;
      const raw = row[column];
      if (text(raw) === '') continue;
      const parsed = parseScheduleDate(raw);
      if (!parsed) {
        problems.push(`Activity ${id}: could not read ${key} date "${text(raw)}".`);
        continue;
      }
      activity[key] = parsed.date;
      if (key === 'start') activity.startActual = parsed.actual;
      else activity.finishActual = parsed.actual;
    }

    activities.push(activity);
  });

  return { schedule: { activities }, problems };
}

/** Finds an activity by its ID. */
export function findActivity(schedule: Schedule, id: string): Activity | undefined {
  return schedule.activities.find((a) => a.id === id);
}
