import {
  checkName,
  inferLocations,
  type InformationStandard,
  type LocationBreakdown,
} from '@infowright/iso19650';
import type { Schedule } from '@infowright/schedule';
import type { Deliverable, DeliveryPlan } from './types';

/*
 * Plans laid out by location: the facilities of a project (buildings, bridges, roads, railways)
 * and their parts, read from the container names. A plan made for 1 facility can be repeated
 * for the others, e.g. the buildings of a campus or the bridges of a road scheme.
 */

/** The value of a name field of a deliverable, e.g. its facility code, if the name can be read. */
export function fieldOf(
  d: Deliverable,
  field: string,
  standard: InformationStandard,
): string | undefined {
  if (!d.containerName) return undefined;
  const value = checkName(d.containerName, standard)?.result.values[field];
  return value ? value.toUpperCase() : undefined;
}

/**
 * The project's locations, completed with every facility and part code used in the plan, so
 * nothing in the plan is left out even before the breakdown is set up.
 */
export function planLocations(
  plan: DeliveryPlan,
  standard: InformationStandard,
): LocationBreakdown {
  const names = plan.deliverables.map((d) => d.containerName ?? '').filter(Boolean);
  return inferLocations(names, standard.namingConventions, {
    ...(standard.locations ? { previous: standard.locations } : {}),
  });
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
  /** The name field with the facility code. Defaults to the project's facility field. */
  field?: string;
  /** The facility whose deliverables are copied, e.g. B1. */
  from: string;
  /** The facilities to copy them to, e.g. B2, B3. */
  to: string[];
  standard: InformationStandard;
  /** Used to find the same activity for the new building, e.g. ARC-B1-S3 becomes ARC-B2-S3. */
  schedule?: Schedule | null;
  /** Days each later facility runs behind the one before it, when they are built in turn. */
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

/** Copies the deliverables of 1 facility to others, changing the facility code in the names. */
export function repeatForFacilities(plan: DeliveryPlan, options: RepeatOptions): RepeatResult {
  const { standard, schedule } = options;
  const field = options.field ?? standard.locations?.facilityField ?? 'volume';
  const from = options.from.toUpperCase();
  const existing = new Set(
    plan.deliverables.map((d) => (d.containerName ?? '').toUpperCase()).filter(Boolean),
  );
  const ids = new Set(plan.deliverables.map((d) => d.id));
  const source = plan.deliverables.filter((d) => fieldOf(d, field, standard) === from);

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
