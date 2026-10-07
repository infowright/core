import { cellText, normaliseHeader, type SheetInput } from '@infowright/common';
import { parseScheduleDate } from './dates';
import { parseScheduleRows, type ParseResult } from './parse-rows';
import type { Activity } from './types';

/** Header names that mark the activity ID column in a spreadsheet export. */
const ID_HEADERS = ['activityid', 'taskcode', 'activitycode', 'uniqueid', 'id'];
const OTHER_HEADERS = [
  'activityname',
  'taskname',
  'name',
  'start',
  'finish',
  'startdate',
  'finishdate',
  'enddate',
];
const HEADER_SEARCH_ROWS = 30;

function addUnique(
  target: Activity[],
  seen: Set<string>,
  problems: string[],
  items: Activity[],
  where: string,
) {
  for (const a of items) {
    if (seen.has(a.id)) {
      problems.push(`Activity ${a.id} appears more than once (${where}). The first one is used.`);
      continue;
    }
    seen.add(a.id);
    target.push(a);
  }
}

/**
 * Reads a programme exported to Excel, from any sheet of the workbook.
 * The header row can be anywhere near the top. A second header row, as in Primavera P6 exports
 * (field names, then column titles), is skipped.
 */
export function readScheduleSheets(sheets: readonly SheetInput[]): ParseResult {
  const activities: Activity[] = [];
  const seen = new Set<string>();
  const problems: string[] = [];
  let found = false;

  for (const sheet of sheets) {
    const limit = Math.min(sheet.rows.length, HEADER_SEARCH_ROWS);
    let headerRow = -1;
    for (let r = 0; r < limit; r++) {
      const keys = (sheet.rows[r] ?? []).map((c) => normaliseHeader(cellText(c)));
      if (keys.some((k) => ID_HEADERS.includes(k)) && keys.some((k) => OTHER_HEADERS.includes(k))) {
        headerRow = r;
        break;
      }
    }
    if (headerRow < 0) continue;
    found = true;

    const headers = (sheet.rows[headerRow] ?? []).map((c, i) => cellText(c) || `Column ${i + 1}`);
    const idIndex = headers.findIndex((h) => ID_HEADERS.includes(normaliseHeader(h)));
    const records = sheet.rows
      .slice(headerRow + 1)
      .filter((row) => !ID_HEADERS.includes(normaliseHeader(cellText(row[idIndex]))))
      .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));

    const result = parseScheduleRows(records);
    problems.push(...result.problems.map((p) => (sheets.length > 1 ? `${sheet.name}: ${p}` : p)));
    addUnique(activities, seen, problems, result.schedule.activities, `sheet ${sheet.name}`);
  }

  if (!found) {
    problems.push(
      'No programme found. Expected a header row with an activity ID column (such as "Activity ID") and a name or date column.',
    );
  }
  return { schedule: { activities }, problems };
}

/**
 * Reads a Primavera P6 export in XER format. Uses the TASK table: activity ID, name and dates.
 * Actual dates are used where the activity has started or finished, otherwise the forecast
 * (early) dates, otherwise the planned dates. WBS summary rows are left out.
 */
export function parseXer(content: string): ParseResult {
  const activities: Activity[] = [];
  const seen = new Set<string>();
  const problems: string[] = [];
  let table = '';
  let fields: string[] = [];
  let sawTask = false;

  for (const line of content.split(/\r?\n/)) {
    const cells = line.split('\t');
    const marker = cells[0];
    if (marker === '%T') {
      table = cells[1] ?? '';
      fields = [];
      if (table === 'TASK') sawTask = true;
    } else if (marker === '%F' && table === 'TASK') {
      fields = cells.slice(1);
    } else if (marker === '%R' && table === 'TASK' && fields.length > 0) {
      const row: Record<string, string> = {};
      fields.forEach((f, i) => (row[f] = (cells[i + 1] ?? '').trim()));
      if (row.task_type === 'TT_WBS') continue;
      const id = row.task_code ?? '';
      if (!id) continue;

      const date = (value: string | undefined) =>
        value ? parseScheduleDate(value)?.date : undefined;
      const actualStart = date(row.act_start_date);
      const actualFinish = date(row.act_end_date);
      const activity: Activity = {
        id,
        name: row.task_name ?? '',
        startActual: actualStart !== undefined,
        finishActual: actualFinish !== undefined,
      };
      const start =
        actualStart ??
        date(row.early_start_date) ??
        date(row.restart_date) ??
        date(row.target_start_date);
      const finish =
        actualFinish ??
        date(row.early_end_date) ??
        date(row.reend_date) ??
        date(row.target_end_date);
      if (start) activity.start = start;
      if (finish) activity.finish = finish;
      addUnique(activities, seen, problems, [activity], 'XER');
    }
  }

  if (!sawTask) {
    problems.push('No activities found. The file does not look like a Primavera P6 XER export.');
  }
  return { schedule: { activities }, problems };
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/**
 * Reads a Microsoft Project file saved as XML. Uses each task's ID (the number in the ID
 * column), name and dates. Actual dates are used where present. Summary tasks are left out.
 */
export function parseMsProjectXml(content: string): ParseResult {
  const activities: Activity[] = [];
  const seen = new Set<string>();
  const problems: string[] = [];

  if (!/<Project[\s>]/.test(content)) {
    problems.push('No tasks found. The file does not look like a Microsoft Project XML file.');
    return { schedule: { activities }, problems };
  }

  for (const match of content.matchAll(/<Task>([\s\S]*?)<\/Task>/g)) {
    // Nested blocks repeat field names (a baseline has its own Start and Finish), so drop them.
    const body = (match[1] ?? '').replace(
      /<(Baseline|ExtendedAttribute|PredecessorLink|TimephasedData)>[\s\S]*?<\/\1>/g,
      '',
    );
    const field = (name: string) => {
      const value = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body)?.[1];
      return value === undefined ? undefined : decode(value.trim());
    };
    if (field('Summary') === '1' || field('IsNull') === '1') continue;
    const id = field('ID');
    if (!id) continue;

    const date = (name: string) => {
      const value = field(name);
      return value ? parseScheduleDate(value.replace('T', ' ').slice(0, 16))?.date : undefined;
    };
    const actualStart = date('ActualStart');
    const actualFinish = date('ActualFinish');
    const activity: Activity = {
      id,
      name: field('Name') ?? '',
      startActual: actualStart !== undefined,
      finishActual: actualFinish !== undefined,
    };
    const start = actualStart ?? date('Start');
    const finish = actualFinish ?? date('Finish');
    if (start) activity.start = start;
    if (finish) activity.finish = finish;
    addUnique(activities, seen, problems, [activity], 'XML');
  }

  if (activities.length === 0) problems.push('No tasks found in the Microsoft Project file.');
  return { schedule: { activities }, problems };
}
