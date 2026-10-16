import { cellText, normaliseHeader, type SheetInput } from '@infowright/common';
import type { InformationStandard } from '@infowright/iso19650';
import { splitFileName } from './file-name';
import { guessDayFirst, parseScheduleDate } from '@infowright/schedule';
import type { Register, RegisterEntry } from './types';

export interface RegisterImport {
  register: Register;
  problems: string[];
  /** What was read from each sheet, so the person can check the right columns were used. */
  sheets: RegisterSheet[];
}

export interface RegisterSheet {
  name: string;
  /** 1-based row number of the header row. Missing when the sheet was not recognised. */
  headerRow?: number;
  containers: number;
  /** Which column was used for what, by its header text. */
  columns: Partial<Record<keyof RegisterEntry, string>>;
}

type Field = keyof RegisterEntry;

/** Accepted column headers, in order of preference, compared without case, spaces or punctuation. */
const COLUMNS: Record<Field, readonly string[]> = {
  name: [
    'containername',
    'informationcontainer',
    'containerid',
    'documentnumber',
    'documentno',
    'docno',
    'docnumber',
    'documentreferencenumber',
    'documentreference',
    'documentref',
    'docref',
    'documentcode',
    'documentid',
    'referencenumber',
    'reference',
    'refno',
    'drawingnumber',
    'drawingno',
    'number',
    'filename',
    'name',
  ],
  title: [
    'title',
    'documenttitle',
    'drawingtitle',
    'sheettitle',
    'description',
    'documentdescription',
  ],
  // "Version" (V1, V2) in Autodesk Docs counts uploads, not ISO 19650 revisions, so it is not used.
  revision: [
    'revision',
    'revisioncode',
    'rev',
    'revno',
    'revisionno',
    'revisionnumber',
    'currentrevision',
    'latestrevision',
  ],
  status: [
    'suitability',
    'suitabilitycode',
    'suitabilitystatus',
    'statussuitability',
    'statuscode',
    'isostatus',
    'isostatuscode',
    'isosuitability',
    'status',
  ],
  date: [
    'lastupdated',
    'lastupdateddate',
    'updated',
    'dateupdated',
    'lastmodified',
    'lastmodifieddate',
    'datemodified',
    'modifieddate',
    'modified',
    'revisiondate',
    'issuedate',
    'dateissued',
    'issueddate',
    'dateuploaded',
    'uploaddate',
    'uploadeddate',
    'uploaded',
    'date',
    'created',
    'createddate',
    'datecreated',
    'creationdate',
  ],
};

/** Sheets that list folders, not containers, in exports such as the Autodesk Docs files log. */
const NOT_CONTAINERS = /^(folders?|summary|info|information|about|filters?)$/i;

const HEADER_SEARCH_ROWS = 30;

function mapColumns(row: readonly unknown[]): Partial<Record<Field, number>> {
  const keys = row.map((c) => normaliseHeader(cellText(c)));
  const used = new Set<number>();
  const map: Partial<Record<Field, number>> = {};
  for (const field of Object.keys(COLUMNS) as Field[]) {
    for (const alias of COLUMNS[field]) {
      const index = keys.findIndex((k, i) => k === alias && !used.has(i));
      if (index >= 0) {
        map[field] = index;
        used.add(index);
        break;
      }
    }
  }
  return map;
}

/** A file extension such as .pdf or .rvt at the end of a name. */
const EXTENSION = /\.[a-z0-9]{2,5}$/i;

/**
 * Picks the status code out of a status cell. Exports write it many ways: "S2", "S2 - Suitable
 * for information", "Shared (S2)" or "S2: Suitable for coordination". With the project's codes
 * known, the first word that is one of them is used; otherwise a first word shaped like a code.
 */
export function statusFromCell(text: string, codes: readonly string[] = []): string | undefined {
  const words = text
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (codes.length) {
    const known = new Set(codes.map((c) => c.toUpperCase()));
    const found = words.find((w) => known.has(w));
    if (found) return found;
  }
  const first = words[0];
  return first && /^[A-Z]{1,2}\d{0,2}$/.test(first) && first.length <= 3 ? first : undefined;
}

/**
 * Reads a list of containers exported from a CDE (Autodesk Docs, Viewpoint, Aconex, Asite,
 * ProjectWise, SharePoint, Trimble Connect, Procore or any other) to Excel or CSV. Headers are
 * matched loosely and can be anywhere near the top. File extensions are removed from names; the
 * status code is picked out of longer text such as "S2 - Suitable for information". With the
 * project standard given, a revision or status written at the end of a file name is used when
 * the export has no column for it.
 */
export function readRegisterSheets(
  sheets: readonly SheetInput[],
  options: { standard?: InformationStandard } = {},
): RegisterImport {
  const entries: RegisterEntry[] = [];
  const problems: string[] = [];
  const summaries: RegisterSheet[] = [];
  const codes = options.standard?.statusCodes.map((c) => c.code) ?? [];
  let found = false;

  for (const sheet of sheets) {
    const summary: RegisterSheet = { name: sheet.name, containers: 0, columns: {} };
    summaries.push(summary);
    if (sheets.length > 1 && NOT_CONTAINERS.test(sheet.name.trim())) continue;
    let headerRow = -1;
    let columns: Partial<Record<Field, number>> = {};
    const limit = Math.min(sheet.rows.length, HEADER_SEARCH_ROWS);
    for (let r = 0; r < limit; r++) {
      const map = mapColumns(sheet.rows[r] ?? []);
      const detail = [map.revision, map.status, map.title, map.date].filter((i) => i !== undefined);
      if (map.name !== undefined && detail.length > 0) {
        headerRow = r;
        columns = map;
        break;
      }
    }
    if (headerRow < 0) continue;
    found = true;
    summary.headerRow = headerRow + 1;
    const header = sheet.rows[headerRow] ?? [];
    for (const [field, index] of Object.entries(columns) as [Field, number][]) {
      summary.columns[field] = cellText(header[index]);
    }

    const dateIndex = columns.date;
    const dayFirst =
      dateIndex === undefined
        ? undefined
        : guessDayFirst(sheet.rows.slice(headerRow + 1).map((row) => row[dateIndex]));
    const badDates: string[] = [];
    let badStatus = 0;

    for (let r = headerRow + 1; r < sheet.rows.length; r++) {
      const cells = sheet.rows[r] ?? [];
      const cell = (field: Field) => {
        const index = columns[field];
        return index === undefined ? '' : cellText(cells[index]);
      };
      const name = cell('name').replace(EXTENSION, '').trim();
      if (!/[a-z0-9]/i.test(name)) continue;

      const entry: RegisterEntry = { name };
      const title = cell('title');
      const revision = cell('revision');
      const statusText = cell('status');
      const status = statusText ? statusFromCell(statusText, codes) : undefined;
      if (statusText && !status) badStatus++;
      if (title) entry.title = title;
      if (revision) entry.revision = revision.toUpperCase();
      if (status) entry.status = status;
      if (options.standard && (!entry.revision || !entry.status)) {
        const parts = splitFileName(entry.name, options.standard);
        entry.name = parts.name;
        if (!entry.revision && parts.revision) entry.revision = parts.revision;
        if (!entry.status && parts.status) entry.status = parts.status;
      }
      if (dateIndex !== undefined) {
        const raw = cells[dateIndex];
        const date = parseScheduleDate(raw, { dayFirst });
        if (date) entry.date = date.date;
        else if (cellText(raw)) badDates.push(cellText(raw));
      }
      entries.push(entry);
      summary.containers++;
    }

    const where = sheets.length > 1 ? `${sheet.name}: ` : '';
    if (badDates.length > 0) {
      const examples = [...new Set(badDates)].slice(0, 3).map((d) => `"${d}"`);
      problems.push(
        `${where}${badDates.length === 1 ? '1 date' : `${badDates.length} dates`} in the ${summary.columns.date ?? 'date'} column could not be read, e.g. ${examples.join(', ')}. Those containers have no date.`,
      );
    }
    if (badStatus > 0) {
      problems.push(
        `${where}${badStatus === 1 ? '1 status' : `${badStatus} statuses`} in the ${summary.columns.status ?? 'status'} column ${badStatus === 1 ? 'holds' : 'hold'} no status code such as S2. The code at the end of the name is used where there is one.`,
      );
    }
  }

  if (!found) {
    problems.push(
      'No containers found. Expected a header row with a name column (such as "Name" or "Document Number") and a revision, status, title or date column.',
    );
  }
  return { register: { entries }, problems, sheets: summaries };
}
