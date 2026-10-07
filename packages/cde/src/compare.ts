import type { DeliveryPlan } from '@infowright/delivery-plan';
import { resolveDueDate } from '@infowright/delivery-plan';
import {
  checkRevisionForStatus,
  getStatusCode,
  UK_NATIONAL_ANNEX,
  type InformationStandard,
} from '@infowright/iso19650';
import type { Schedule } from '@infowright/schedule';
import type { Register, RegisterEntry } from './types';

/**
 * delivered: in the CDE with the target status, or a further one (shared before published).
 * in-progress: in the CDE, but not yet at the target status, or only in a version from before
 * the previous gate.
 * missing: not in the CDE.
 */
export type DeliveryState = 'delivered' | 'in-progress' | 'missing';

export interface DeliveryCheck {
  deliverableId: string;
  milestoneId: string;
  state: DeliveryState;
  /** The most advanced entry for the container in the CDE. */
  entry?: RegisterEntry;
  /** When the delivery is due: its own date, the programme finish, or the milestone date. */
  due?: string;
  /** Due date has passed and it is not delivered. */
  overdue: boolean;
  /** Problems with the entry in the CDE, e.g. a revision that does not fit its status. */
  problems: string[];
}

export interface RegisterComparison {
  checks: DeliveryCheck[];
  /** Entries in the CDE that do not belong to any planned deliverable. */
  unplanned: RegisterEntry[];
}

export interface CompareOptions {
  standard?: InformationStandard;
  schedule?: Schedule;
  /** Today, YYYY-MM-DD. Defaults to the current date. */
  today?: string;
}

const RANK = { wip: 0, shared: 1, published: 2 } as const;

const key = (name: string) => name.trim().toUpperCase();

/** Removes the last segment after - _ . or a space, e.g. a revision added to a file name. */
const shorten = (name: string) => {
  const cut = Math.max(
    name.lastIndexOf('-'),
    name.lastIndexOf('_'),
    name.lastIndexOf('.'),
    name.lastIndexOf(' '),
  );
  return cut > 0 ? name.slice(0, cut) : '';
};

function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Compares the delivery plan with what is in the CDE. Each planned delivery that has a container
 * name is matched to the CDE by name. Names in the CDE may carry a file extension or extra parts
 * such as a revision ("...-0001-P02"); those are tolerated.
 */
export function compareWithRegister(
  plan: DeliveryPlan,
  register: Register,
  options: CompareOptions = {},
): RegisterComparison {
  const standard = options.standard ?? UK_NATIONAL_ANNEX;
  const today = options.today ?? localToday();

  const planned = new Map<string, string>();
  for (const d of plan.deliverables) {
    if (d.containerName) planned.set(key(d.containerName), d.id);
  }

  const rankOf = (entry: RegisterEntry) => {
    if (!entry.status) return -1;
    const def = getStatusCode(entry.status, standard.statusCodes);
    if (!def || def.withdrawn) return -1;
    return RANK[def.state];
  };
  const better = (a: RegisterEntry, b: RegisterEntry) => {
    const byRank = rankOf(a) - rankOf(b);
    if (byRank !== 0) return byRank > 0;
    const byDate = (a.date ?? '').localeCompare(b.date ?? '');
    if (byDate !== 0) return byDate > 0;
    return (a.revision ?? '').localeCompare(b.revision ?? '') > 0;
  };

  const latest = new Map<string, RegisterEntry>();
  const unplanned: RegisterEntry[] = [];
  for (const entry of register.entries) {
    let candidate = key(entry.name);
    let id = planned.get(candidate);
    for (let i = 0; i < 2 && id === undefined && candidate; i++) {
      candidate = shorten(candidate);
      id = candidate ? planned.get(candidate) : undefined;
    }
    if (id === undefined) {
      unplanned.push(entry);
      continue;
    }
    const current = latest.get(id);
    if (!current || better(entry, current)) latest.set(id, entry);
  }

  const checks: DeliveryCheck[] = [];
  for (const d of plan.deliverables) {
    const entry = latest.get(d.id);
    // Later gates need a newer issue: an entry from before the previous gate's due date
    // only counts for that earlier gate.
    const dues = d.issues.map((issue) => resolveDueDate(issue, plan, options.schedule));
    const order = d.issues
      .map((_, i) => i)
      .sort((a, b) => (dues[a] ?? '9999').localeCompare(dues[b] ?? '9999'));
    const previousDue = new Map<number, string | undefined>();
    order.forEach((index, position) => {
      previousDue.set(index, position > 0 ? dues[order[position - 1] ?? -1] : undefined);
    });

    d.issues.forEach((issue, index) => {
      const due = dues[index];
      let state: DeliveryState = 'missing';
      const problems: string[] = [];

      if (entry) {
        const before = previousDue.get(index);
        const tooOld = before !== undefined && entry.date !== undefined && entry.date <= before;
        if (!entry.status) {
          // The export has no status: being in the CDE is all that can be told.
          state = tooOld ? 'in-progress' : 'delivered';
        } else {
          const actual = getStatusCode(entry.status, standard.statusCodes);
          const target = issue.status
            ? getStatusCode(issue.status, standard.statusCodes)
            : undefined;
          const needed = target && !target.withdrawn ? RANK[target.state] : RANK.shared;
          if (!actual) problems.push(`"${entry.status}" is not a status code of this project.`);
          const meets = actual && !actual.withdrawn && RANK[actual.state] >= needed;
          state = meets && !tooOld ? 'delivered' : 'in-progress';
          if (actual && entry.revision) {
            problems.push(...checkRevisionForStatus(entry.revision, entry.status, standard));
          }
        }
      }

      const check: DeliveryCheck = {
        deliverableId: d.id,
        milestoneId: issue.milestoneId,
        state,
        overdue: state !== 'delivered' && due !== undefined && due < today,
        problems,
      };
      if (entry) check.entry = entry;
      if (due) check.due = due;
      checks.push(check);
    });
  }

  return { checks, unplanned };
}
