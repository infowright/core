import { checkName, UK_NATIONAL_ANNEX, type InformationStandard } from '@infowright/iso19650';
import { parseScheduleDate } from '@infowright/schedule';
import type { Deliverable, DeliveryPlan, Milestone, PlannedIssue } from './types';

/** One worksheet: its name and its cells, row by row, as read by any spreadsheet reader. */
export interface SheetInput {
  name: string;
  rows: readonly (readonly unknown[])[];
}

type DeliverableField = 'containerName' | 'title' | 'taskTeam' | 'author';
type IssueField = 'milestone' | 'status' | 'due' | 'activity' | 'loin';

export interface SheetSummary {
  name: string;
  /** 1-based row number of the header row. Missing when the sheet was not recognised. */
  headerRow?: number;
  deliverables: number;
  /** Which column was used for what, by header text. */
  columns: Partial<Record<DeliverableField | IssueField, string[]>>;
  /** Set when the container name is put together from one column per naming field. */
  composedName?: string;
}

export interface PlanImport {
  plan: DeliveryPlan;
  sheets: SheetSummary[];
  /** Problems in plain language. The plan still contains every row that could be read. */
  problems: string[];
}

export interface ReadOptions {
  /** The project's information standard. Used to read names. Defaults to the UK National Annex. */
  standard?: InformationStandard;
}

/**
 * Accepted column headers, in order of preference. Compared without case, spaces or
 * punctuation, and with any trailing number removed: "Suitability - 2" is the second
 * "suitability" column, which is how sheets repeat a block of columns for every stage gate.
 */
const DELIVERABLE_COLUMNS: Record<DeliverableField, readonly string[]> = {
  containerName: [
    'containername',
    'informationcontainer',
    'informationcontainerid',
    'containerid',
    'documentnumber',
    'documentno',
    'docno',
    'docnumber',
    'documentreferencenumber',
    'documentreferenceno',
    'documentreference',
    'documentref',
    'referencenumber',
    'reference',
    'refno',
    'drawingnumber',
    'drawingno',
    'filename',
  ],
  title: [
    'title',
    'documenttitle',
    'containertitle',
    'drawingtitle',
    'combinedtitle',
    'fulltitle',
    'description',
    'documentdescription',
    'name',
  ],
  taskTeam: [
    'taskteam',
    'originator',
    'originatorcode',
    'informationauthor',
    'organisation',
    'organization',
    'company',
  ],
  author: ['author', 'responsibleperson', 'responsible', 'owner', 'preparedby', 'producedby'],
};

const ISSUE_COLUMNS: Record<IssueField, readonly string[]> = {
  milestone: ['milestone', 'deliverymilestone', 'stagegate', 'gate', 'stage', 'workstage'],
  status: [
    'targetstatus',
    'targetsuitability',
    'suitabilitycode',
    'suitability',
    'statuscode',
    'status',
  ],
  due: [
    'duedate',
    'due',
    'plannedissuedate',
    'plannedissue',
    'plannedsubmissiondate',
    'plannedsubmission',
    'planneddeliverydate',
    'deliverydate',
    'planneddate',
    'issuedate',
    'deliverymilestonesdate',
    'deliverymilestonedate',
    'milestonedate',
  ],
  activity: [
    'activityid',
    'programmeactivityid',
    'programmeactivitycode',
    'programmeactivity',
    'p6activityid',
    'activitycode',
    'taskcode',
    'activity',
  ],
  loin: ['loin', 'levelofinformationneed', 'levelofinformation'],
};

const HEADER_SEARCH_ROWS = 30;
const DEFAULT_MILESTONE = 'Delivery';

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const text = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'milestone';

interface Header {
  index: number;
  text: string;
  base: string;
  /** Number at the end of the header, e.g. 2 for "Suitability 2". 0 when there is none. */
  block: number;
}

function readHeaders(row: readonly unknown[]): Header[] {
  const headers: Header[] = [];
  row.forEach((cell, index) => {
    const value = text(cell);
    const key = normalise(value);
    if (!key) return;
    const match = /^(.*?[a-z])(\d+)$/.exec(key);
    headers.push({
      index,
      text: value,
      base: match?.[1] ?? key,
      block: match?.[2] ? Number(match[2]) : 0,
    });
  });
  return headers;
}

interface Layout {
  deliverable: Partial<Record<DeliverableField, Header>>;
  /** Issue columns grouped by block number. */
  blocks: Map<number, Partial<Record<IssueField, Header>>>;
  /** Columns that make up the container name, in naming order. */
  nameParts?: { headers: Header[]; keys: string[]; delimiter: string; convention: string };
}

function namePartAliases(key: string, label: string): string[] {
  const parts = label.split(/[/,&]/).map(normalise).filter(Boolean);
  return [...new Set([normalise(key), normalise(label), ...parts])];
}

function planLayout(headers: Header[], standard: InformationStandard): Layout {
  const used = new Set<number>();
  const take = (aliases: readonly string[], blockless: boolean) => {
    for (const alias of aliases) {
      const found = headers.find(
        (h) => !used.has(h.index) && h.base === alias && (!blockless || h.block === 0),
      );
      if (found) {
        used.add(found.index);
        return found;
      }
    }
    return undefined;
  };

  const layout: Layout = { deliverable: {}, blocks: new Map() };

  // A sheet that splits the name into one column per field: put it back together.
  const composeFrom = (fields: readonly { key: string; label: string }[]) =>
    fields.map((f) => {
      const aliases = namePartAliases(f.key, f.label);
      return headers.find((h) => h.block === 0 && aliases.includes(normalise(h.text)));
    });

  layout.deliverable.containerName = take(DELIVERABLE_COLUMNS.containerName, true);
  if (!layout.deliverable.containerName) {
    for (const convention of standard.namingConventions) {
      const parts = composeFrom(convention.fields);
      if (parts.every((p) => p !== undefined)) {
        parts.forEach((p) => used.add(p.index));
        layout.nameParts = {
          headers: parts,
          keys: convention.fields.map((f) => f.key),
          delimiter: convention.delimiter,
          convention: convention.name,
        };
        break;
      }
    }
  }
  layout.deliverable.title = take(DELIVERABLE_COLUMNS.title, true);
  layout.deliverable.taskTeam = take(DELIVERABLE_COLUMNS.taskTeam, true);
  layout.deliverable.author = take(DELIVERABLE_COLUMNS.author, true);

  for (const h of headers) {
    if (used.has(h.index)) continue;
    for (const field of Object.keys(ISSUE_COLUMNS) as IssueField[]) {
      if (!ISSUE_COLUMNS[field].includes(h.base)) continue;
      const block = layout.blocks.get(h.block) ?? {};
      if (block[field]) continue;
      block[field] = h;
      layout.blocks.set(h.block, block);
      used.add(h.index);
      break;
    }
  }
  // With one block per gate, unnumbered columns such as a trailing "Suitability" describe the
  // current state of the container, not a target, so they are left out.
  if ([...layout.blocks.keys()].some((n) => n > 0)) layout.blocks.delete(0);
  return layout;
}

/**
 * Sheets often name each gate in a merged cell above its block of columns,
 * e.g. "GATE - 2 (Concept Design)". The label must mention the block number to be used.
 */
function gateLabels(layout: Layout, above: readonly unknown[] | undefined): Map<number, string> {
  const labels = new Map<number, string>();
  if (!above) return labels;
  const starts = [...layout.blocks.entries()]
    .filter(([n]) => n > 0)
    .map(([n, block]) => [n, Math.min(...Object.values(block).map((h) => h.index))] as const)
    .sort((a, b) => a[1] - b[1]);
  starts.forEach(([n, start], i) => {
    const floor = i > 0 ? (starts[i - 1]?.[1] ?? 0) + 1 : 0;
    for (let c = start; c >= floor; c--) {
      const label = text(above[c]);
      if (!label) continue;
      if (new RegExp(`(^|\\D)${n}(\\D|$)`).test(label)) labels.set(n, label);
      break;
    }
  });
  return labels;
}

function score(layout: Layout): number {
  const named = layout.deliverable.containerName || layout.nameParts ? 1 : 0;
  if (!named && !layout.deliverable.title) return 0;
  const fields = Object.values(layout.deliverable).filter(Boolean).length;
  const issueFields = [...layout.blocks.values()].reduce((n, b) => n + Object.keys(b).length, 0);
  return fields + (layout.nameParts ? 1 : 0) + issueFields;
}

function findHeaderRow(
  sheet: SheetInput,
  standard: InformationStandard,
): { row: number; layout: Layout } | undefined {
  let best: { row: number; layout: Layout; score: number } | undefined;
  const limit = Math.min(sheet.rows.length, HEADER_SEARCH_ROWS);
  for (let row = 0; row < limit; row++) {
    const layout = planLayout(readHeaders(sheet.rows[row] ?? []), standard);
    const s = score(layout);
    if (s >= 2 && (!best || s > best.score)) best = { row, layout, score: s };
  }
  return best && { row: best.row, layout: best.layout };
}

/**
 * Reads a MIDP or TIDP exported to Excel. Every sheet is read and the deliverables are combined.
 *
 * Built for real spreadsheets: the header row does not have to be the first row, headers are
 * matched loosely, a block of columns repeated per stage gate becomes one planned issue per gate,
 * a name split into one column per field is put back together, and a missing task team is taken
 * from the originator part of the name. Rows with neither a name nor enough detail (e.g. section
 * headings) are skipped.
 */
export function readDeliveryPlanSheets(
  sheets: readonly SheetInput[],
  options: ReadOptions = {},
): PlanImport {
  const standard = options.standard ?? UK_NATIONAL_ANNEX;
  const problems: string[] = [];
  const summaries: SheetSummary[] = [];
  const milestones = new Map<string, Milestone>();
  const deliverables: Deliverable[] = [];
  const ids = new Set<string>();

  const milestoneId = (name: string) => {
    const id = slug(name);
    if (!milestones.has(id)) milestones.set(id, { id, name });
    return id;
  };

  for (const sheet of sheets) {
    const found = findHeaderRow(sheet, standard);
    if (!found) {
      summaries.push({ name: sheet.name, deliverables: 0, columns: {} });
      continue;
    }
    const { row: headerRow, layout } = found;
    const labels = gateLabels(layout, sheet.rows[headerRow - 1]);
    const summary: SheetSummary = {
      name: sheet.name,
      headerRow: headerRow + 1,
      deliverables: 0,
      columns: {},
      ...(layout.nameParts ? { composedName: layout.nameParts.convention } : {}),
    };
    const note = (field: DeliverableField | IssueField, header: Header | undefined) => {
      if (!header) return;
      (summary.columns[field] ??= []).push(header.text);
    };
    for (const [field, header] of Object.entries(layout.deliverable)) {
      note(field as DeliverableField, header);
    }
    const blocks = [...layout.blocks.entries()].sort(([a], [b]) => a - b);
    for (const [, block] of blocks) {
      for (const [field, header] of Object.entries(block)) note(field as IssueField, header);
    }

    for (let r = headerRow + 1; r < sheet.rows.length; r++) {
      const cells = sheet.rows[r] ?? [];
      const cell = (h: Header | undefined) => (h ? text(cells[h.index]) : '');
      const where = `${sheet.name}, row ${r + 1}`;

      let containerName = cell(layout.deliverable.containerName);
      // A name built by a formula from empty parts is only delimiters: an unused template row.
      if (!/[a-z0-9]/i.test(containerName)) containerName = '';
      let partialName = false;
      let originatorPart = '';
      if (!containerName && layout.nameParts) {
        const parts = layout.nameParts.headers.map(cell);
        if (parts.every(Boolean)) containerName = parts.join(layout.nameParts.delimiter);
        else partialName = parts.some(Boolean);
        originatorPart = parts[layout.nameParts.keys.indexOf('originator')] ?? '';
      }
      const title = cell(layout.deliverable.title);
      let taskTeam = cell(layout.deliverable.taskTeam) || originatorPart;
      const author = cell(layout.deliverable.author);

      const issues: PlannedIssue[] = [];
      for (const [number, block] of blocks) {
        const values = {
          milestone: cell(block.milestone),
          status: cell(block.status),
          dueRaw: block.due ? cells[block.due.index] : undefined,
          activity: cell(block.activity),
          loin: cell(block.loin),
        };
        const dueText = text(values.dueRaw);
        if (!values.milestone && !values.status && !dueText && !values.activity && !values.loin) {
          continue;
        }
        const milestoneName =
          values.milestone ||
          labels.get(number) ||
          (number > 0 ? `Gate ${number}` : DEFAULT_MILESTONE);
        const issue: PlannedIssue = { milestoneId: milestoneId(milestoneName) };
        const status = values.status.split(/[\s:-]+/)[0]?.toUpperCase();
        if (status) issue.status = status;
        if (dueText) {
          const due = parseScheduleDate(values.dueRaw);
          if (due) issue.due = due.date;
          else problems.push(`${where}: "${dueText}" is not a date that can be read.`);
        }
        if (values.activity) issue.activityId = values.activity;
        if (values.loin) issue.loin = values.loin;
        issues.push(issue);
      }

      const detail =
        [taskTeam, author].filter(Boolean).length + issues.length + (partialName ? 1 : 0);
      if (!containerName && !(title && detail > 0)) continue;

      if (!taskTeam && containerName) {
        taskTeam = checkName(containerName, standard)?.result.values.originator ?? '';
      }
      if (issues.length === 0) issues.push({ milestoneId: milestoneId(DEFAULT_MILESTONE) });

      let id = containerName || `${sheet.name}!${r + 1}`;
      if (ids.has(id)) id = `${sheet.name}!${r + 1}`;
      ids.add(id);

      const deliverable: Deliverable = { id, title, taskTeam, issues };
      if (containerName) deliverable.containerName = containerName;
      if (author) deliverable.author = author;
      deliverables.push(deliverable);
      summary.deliverables++;
    }
    summaries.push(summary);
  }

  const read = summaries.filter((s) => s.headerRow !== undefined);
  if (read.length === 0) {
    problems.unshift(
      'No deliverables found. Expected a header row with columns such as "Document Number" or "Container Name" and "Title".',
    );
  } else {
    for (const s of summaries) {
      if (s.headerRow === undefined) {
        problems.push(`Sheet "${s.name}" was skipped: no header row with deliverable columns.`);
      }
    }
  }

  return {
    plan: { milestones: [...milestones.values()], deliverables },
    sheets: summaries,
    problems,
  };
}
