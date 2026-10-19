import { checkName, type InformationStandard } from '@infowright/iso19650';
import type { Schedule } from '@infowright/schedule';
import type { Deliverable, DeliveryPlan } from './types';

/*
 * Projects with repeated buildings: a campus, an estate, a set of schools. The building is read
 * from a field of the container name, usually Volume/System (B1, B2 ...). A plan made for 1
 * building can be repeated for the others, and progress compared building by building.
 */

/** Codes that mean "no particular building" in ISO 19650 names. */
const NOT_A_BUILDING = new Set(['ZZ', 'XX', '00']);

/** The value of the building field in a deliverable's name, if the name can be read. */
export function buildingOf(
  d: Deliverable,
  field: string,
  standard: InformationStandard,
): string | undefined {
  if (!d.containerName) return undefined;
  const value = checkName(d.containerName, standard)?.result.values[field];
  return value ? value.toUpperCase() : undefined;
}

export interface BuildingField {
  key: string;
  label: string;
  /** Distinct values, e.g. B1, B2, B3, most used first. */
  values: string[];
}

/**
 * Name fields that could identify buildings: fields with at least 2 values that are not
 * ZZ or XX, excluding the project, originator, type, role and number. Volume first.
 */
export function buildingFields(plan: DeliveryPlan, standard: InformationStandard): BuildingField[] {
  const skip = new Set(['project', 'originator', 'type', 'role', 'number']);
  const counts = new Map<string, Map<string, number>>();
  const labels = new Map<string, string>();
  for (const convention of standard.namingConventions) {
    for (const f of convention.fields) if (!skip.has(f.key)) labels.set(f.key, f.label);
  }
  for (const d of plan.deliverables) {
    if (!d.containerName) continue;
    const values = checkName(d.containerName, standard)?.result.values ?? {};
    for (const [key, raw] of Object.entries(values)) {
      if (!labels.has(key)) continue;
      const value = raw.toUpperCase();
      if (!value || NOT_A_BUILDING.has(value)) continue;
      const byValue = counts.get(key) ?? new Map<string, number>();
      byValue.set(value, (byValue.get(value) ?? 0) + 1);
      counts.set(key, byValue);
    }
  }
  return [...counts.entries()]
    .filter(([, byValue]) => byValue.size >= 2)
    .map(([key, byValue]) => ({
      key,
      label: labels.get(key) ?? key,
      values: [...byValue.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
        .map(([v]) => v),
    }))
    .sort((a, b) => (a.key === 'volume' ? -1 : b.key === 'volume' ? 1 : 0));
}

/** The name with 1 field replaced, keeping the delimiter and the other fields. */
function replaceField(
  name: string,
  field: string,
  value: string,
  standard: InformationStandard,
): string | undefined {
  const match = checkName(name, standard);
  if (!match || Object.keys(match.result.values).length === 0) return undefined;
  const { delimiter, fields } = match.convention;
  return fields
    .map((f) => (f.key === field ? value : (match.result.values[f.key] ?? '')))
    .join(delimiter);
}

export interface RepeatOptions {
  field: string;
  /** The building whose deliverables are copied, e.g. B1. */
  from: string;
  /** The buildings to copy them to, e.g. B2, B3. */
  to: string[];
  standard: InformationStandard;
  /** Used to find the same activity for the new building, e.g. ARC-B1-S3 becomes ARC-B2-S3. */
  schedule?: Schedule | null;
  /** Days each later building runs behind the one before it, for staggered buildings. */
  shiftDays?: number;
}

export interface RepeatResult {
  plan: DeliveryPlan;
  added: number;
  /** Names that were in the plan already, so not added again. */
  skipped: string[];
  /** Links to the programme found for the new buildings, and those left empty. */
  linked: number;
  unlinked: number;
}

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The activity for the new building: the same ID with the building code swapped when the
 * programme has it; the same activity when its ID names no building (shared by all of them);
 * none when it names the building but the new building has no such activity.
 */
function activityFor(
  activityId: string,
  from: string,
  to: string,
  schedule: Schedule | null | undefined,
): string | undefined {
  const re = new RegExp(`(^|[^A-Za-z0-9])${from}(?=$|[^A-Za-z0-9])`, 'gi');
  const swapped = activityId.replace(re, (_, before: string) => `${before}${to}`);
  if (swapped === activityId) return activityId;
  if (!schedule) return undefined;
  return schedule.activities.some((a) => a.id === swapped) ? swapped : undefined;
}

/** Copies the deliverables of 1 building to others, renaming the building field. */
export function repeatForBuildings(plan: DeliveryPlan, options: RepeatOptions): RepeatResult {
  const { field, standard, schedule } = options;
  const from = options.from.toUpperCase();
  const existing = new Set(
    plan.deliverables.map((d) => (d.containerName ?? '').toUpperCase()).filter(Boolean),
  );
  const ids = new Set(plan.deliverables.map((d) => d.id));
  const source = plan.deliverables.filter((d) => buildingOf(d, field, standard) === from);

  const added: Deliverable[] = [];
  const skipped: string[] = [];
  let linked = 0;
  let unlinked = 0;

  options.to
    .map((t) => t.trim().toUpperCase())
    .filter((t, i, all) => t && t !== from && all.indexOf(t) === i)
    .forEach((to, index) => {
      const shift = (options.shiftDays ?? 0) * (index + 1);
      for (const d of source) {
        const name = replaceField(d.containerName ?? '', field, to, standard);
        if (!name) continue;
        if (existing.has(name.toUpperCase())) {
          skipped.push(name);
          continue;
        }
        existing.add(name.toUpperCase());
        let id = name;
        for (let n = 2; ids.has(id); n++) id = `${name}-${n}`;
        ids.add(id);

        const issues = d.issues.map((issue) => {
          const next = { ...issue };
          if (next.due && shift) next.due = addDays(next.due, shift);
          if (issue.activityId) {
            const activityId = activityFor(issue.activityId, from, to, schedule);
            if (activityId) {
              next.activityId = activityId;
              linked++;
            } else {
              delete next.activityId;
              unlinked++;
            }
          }
          return next;
        });
        added.push({
          ...d,
          id,
          containerName: name,
          issues,
          ...(d.predecessors ? { predecessors: [] } : {}),
        });
      }
    });

  return {
    plan: { ...plan, deliverables: [...plan.deliverables, ...added] },
    added: added.length,
    skipped,
    linked,
    unlinked,
  };
}
