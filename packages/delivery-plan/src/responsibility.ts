import {
  checkName,
  UK_NA_ROLE_CODES,
  UK_NA_TYPE_CODES,
  type InformationStandard,
} from '@infowright/iso19650';
import type { Deliverable, DeliveryPlan, Responsibility, Duty } from './types';

/*
 * The responsibility matrix (ISO 19650-2, 5.3.2): for each scope of information, which task
 * team produces it, which accepts it, which reviews it and which is kept informed. A scope is a
 * discipline (the role code in names), narrowed if needed by a document type or a facility.
 * The plan is then checked against it: every scope has 1 producer, deliverables are planned by
 * the team that produces their scope, and no producer is left with nothing planned.
 */

export const DUTIES: Readonly<Record<Duty, { label: string; hint: string }>> = {
  R: { label: 'Produces', hint: 'Responsible for producing the information' },
  A: { label: 'Accepts', hint: 'Reviews and accepts it, e.g. the lead appointed party' },
  C: { label: 'Reviews', hint: 'Consulted: comments before it is shared' },
  I: { label: 'Informed', hint: 'Kept informed when it is shared or published' },
};

const valuesOf = (d: Deliverable, standard: InformationStandard) =>
  d.containerName ? (checkName(d.containerName, standard)?.result.values ?? {}) : {};

const up = (v: string | undefined) => (v ?? '').trim().toUpperCase();

/** The most specific row whose scope fits the deliverable, if any. */
export function scopeOf(
  d: Deliverable,
  rows: readonly Responsibility[],
  standard: InformationStandard,
): Responsibility | undefined {
  const values = valuesOf(d, standard);
  const facilityField = standard.locations?.facilityField ?? 'volume';
  let best: Responsibility | undefined;
  let bestScore = -1;
  for (const row of rows) {
    const checks: [string | undefined, string | undefined][] = [
      [row.role, values.role],
      [row.type, values.type],
      [row.facility, values[facilityField]],
    ];
    if (checks.every(([want]) => !want)) continue;
    if (checks.some(([want, got]) => want && up(want) !== up(got))) continue;
    const score = checks.filter(([want]) => want).length;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

/** A label for a scope, e.g. "Structural engineer, Drawing, R1". */
export function describeScope(row: Pick<Responsibility, 'role' | 'type' | 'facility'>): string {
  return [
    row.role ? (UK_NA_ROLE_CODES[up(row.role)] ?? `Role ${row.role}`) : '',
    row.type ? (UK_NA_TYPE_CODES[up(row.type)] ?? `Type ${row.type}`) : '',
    row.facility ?? '',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * A starting matrix from the plan: 1 row per discipline (role code) found in the names, with
 * every task team that plans deliverables of that discipline as a producer. Rows already there
 * are kept, so filling again only adds what is new.
 */
export function inferResponsibilities(
  plan: DeliveryPlan,
  standard: InformationStandard,
): Responsibility[] {
  const existing = plan.responsibilities ?? [];
  const found = new Map<string, Set<string>>();
  for (const d of plan.deliverables) {
    const role = up(valuesOf(d, standard).role);
    if (!role || !d.taskTeam) continue;
    const teams = found.get(role) ?? new Set<string>();
    teams.add(d.taskTeam);
    found.set(role, teams);
  }
  const covered = new Set(
    existing.filter((r) => r.role && !r.type && !r.facility).map((r) => up(r.role)),
  );
  const added: Responsibility[] = [...found.entries()]
    .filter(([role]) => !covered.has(role))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([role, teams]) => ({
      id: `role-${role}`,
      role,
      duties: Object.fromEntries([...teams].sort().map((t) => [t, 'R' as Duty])),
    }));
  return [...existing, ...added];
}

export interface MatrixProblem {
  /** The row it is about, when it is about a row. */
  rowId?: string;
  /** The deliverable it is about, when it is about one. */
  deliverableId?: string;
  kind: 'no-producer' | 'many-producers' | 'no-acceptor' | 'wrong-team' | 'nothing-planned';
  message: string;
}

export interface MatrixCheck {
  problems: MatrixProblem[];
  /** Deliverables whose scope is in the matrix. */
  covered: number;
  /** Deliverables no row describes. */
  uncovered: number;
}

/** Checks the matrix itself and the plan against it. */
export function checkResponsibilities(
  plan: DeliveryPlan,
  standard: InformationStandard,
): MatrixCheck {
  const rows = plan.responsibilities ?? [];
  const problems: MatrixProblem[] = [];

  for (const row of rows) {
    const name = row.label || describeScope(row) || 'A row';
    const producers = Object.entries(row.duties).filter(([, d]) => d === 'R');
    if (producers.length === 0) {
      problems.push({
        rowId: row.id,
        kind: 'no-producer',
        message: `${name}: no task team produces it.`,
      });
    } else if (producers.length > 1) {
      problems.push({
        rowId: row.id,
        kind: 'many-producers',
        message: `${name}: ${producers.map(([t]) => t).join(' and ')} both produce it. Split the row by type or facility so each part has 1 producer.`,
      });
    }
    if (!Object.values(row.duties).includes('A')) {
      problems.push({
        rowId: row.id,
        kind: 'no-acceptor',
        message: `${name}: nobody accepts it.`,
      });
    }
  }

  let covered = 0;
  let uncovered = 0;
  const planned = new Map<string, Set<string>>();
  for (const d of plan.deliverables) {
    const row = scopeOf(d, rows, standard);
    if (!row) {
      uncovered++;
      continue;
    }
    covered++;
    const teams = planned.get(row.id) ?? new Set<string>();
    teams.add(d.taskTeam);
    planned.set(row.id, teams);
    const producers = Object.entries(row.duties)
      .filter(([, duty]) => duty === 'R')
      .map(([t]) => t);
    if (producers.length > 0 && !producers.includes(d.taskTeam)) {
      problems.push({
        rowId: row.id,
        deliverableId: d.id,
        kind: 'wrong-team',
        message: `${d.containerName ?? d.title} is planned by ${d.taskTeam || 'no task team'}, but ${producers.join(' and ')} ${producers.length === 1 ? 'produces' : 'produce'} ${row.label || describeScope(row)}.`,
      });
    }
  }

  for (const row of rows) {
    for (const [team, duty] of Object.entries(row.duties)) {
      if (duty !== 'R' || planned.get(row.id)?.has(team)) continue;
      problems.push({
        rowId: row.id,
        kind: 'nothing-planned',
        message: `${team} produces ${row.label || describeScope(row)}, but has nothing planned for it.`,
      });
    }
  }

  return { problems, covered, uncovered };
}
