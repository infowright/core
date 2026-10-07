import { cellText, normaliseHeader, type SheetInput } from '@infowright/common';
import type { InformationStandard } from '@infowright/iso19650';
import { splitFileName } from './file-name';
import { parseScheduleDate } from '@infowright/schedule';
import type { Register, RegisterEntry } from './types';

export interface RegisterImport {
  register: Register;
  problems: string[];
}

type Field = keyof RegisterEntry;

/** Accepted column headers, in order of preference, compared without case, spaces or punctuation. */
const COLUMNS: Record<Field, readonly string[]> = {
  name: [
    'containername',
    'documentnumber',
    'documentno',
    'docno',
    'documentreferencenumber',
    'documentreference',
    'referencenumber',
    'reference',
    'drawingnumber',
    'filename',
    'name',
  ],
  title: ['title', 'documenttitle', 'description'],
  // "Version" (V1, V2) in Autodesk Docs counts uploads, not ISO 19650 revisions, so it is not used.
  revision: ['revision', 'revisioncode', 'rev', 'revno'],
  status: ['suitability', 'suitabilitycode', 'status', 'statuscode', 'isostatus'],
  date: [
    'lastupdated',
    'updated',
    'lastmodified',
    'datemodified',
    'modified',
    'revisiondate',
    'issuedate',
    'dateuploaded',
    'uploaded',
    'date',
    'created',
  ],
};

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
 * Reads a list of containers exported from a CDE (Autodesk Docs, ProjectWise, Aconex, SharePoint
 * or any other) to Excel or CSV. Headers are matched loosely and can be anywhere near the top.
 * File extensions are removed from names; a status such as "S2 - Suitable for information"
 * becomes "S2". With the project standard given, a revision or status written at the end of a
 * file name is used when the export has no column for it.
 */
export function readRegisterSheets(
  sheets: readonly SheetInput[],
  options: { standard?: InformationStandard } = {},
): RegisterImport {
  const entries: RegisterEntry[] = [];
  const problems: string[] = [];
  let found = false;

  for (const sheet of sheets) {
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
      const status = cell('status')
        .split(/[\s:-]+/)[0]
        ?.toUpperCase();
      if (title) entry.title = title;
      if (revision) entry.revision = revision.toUpperCase();
      if (status) entry.status = status;
      if (options.standard && (!entry.revision || !entry.status)) {
        const parts = splitFileName(entry.name, options.standard);
        entry.name = parts.name;
        if (!entry.revision && parts.revision) entry.revision = parts.revision;
        if (!entry.status && parts.status) entry.status = parts.status;
      }
      if (columns.date !== undefined) {
        const raw = cells[columns.date];
        const date = parseScheduleDate(typeof raw === 'string' ? raw.slice(0, 16) : raw);
        if (date) entry.date = date.date;
        else if (cellText(raw)) {
          problems.push(
            `${sheet.name}, row ${r + 1}: "${cellText(raw)}" is not a date that can be read.`,
          );
        }
      }
      entries.push(entry);
    }
  }

  if (!found) {
    problems.push(
      'No containers found. Expected a header row with a name column (such as "Name" or "Document Number") and a revision, status, title or date column.',
    );
  }
  return { register: { entries }, problems };
}
