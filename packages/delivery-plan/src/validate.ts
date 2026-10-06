import { getStatusCode, validateContainerName, type NamingConvention } from '@infowright/iso19650';
import type { Deliverable, DeliveryPlan, PlannedIssue } from './types';

export interface PlanProblem {
  deliverableId?: string;
  milestoneId?: string;
  message: string;
}

export interface ValidateOptions {
  /** When set, planned container names are checked against this convention. */
  namingConvention?: NamingConvention;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The date an issue is due: its own date if set, otherwise the milestone date. */
export function resolveDueDate(issue: PlannedIssue, plan: DeliveryPlan): string | undefined {
  if (issue.due) return issue.due;
  return plan.milestones.find((m) => m.id === issue.milestoneId)?.date;
}

function label(d: Deliverable): string {
  return d.containerName || d.title || d.id;
}

/**
 * Checks a delivery plan for problems that would make it unreliable.
 * Returns a list of problems in plain language. An empty list means the plan is valid.
 */
export function validateDeliveryPlan(
  plan: DeliveryPlan,
  options: ValidateOptions = {},
): PlanProblem[] {
  const problems: PlanProblem[] = [];

  const milestoneIds = new Set<string>();
  for (const m of plan.milestones) {
    if (!m.id.trim()) {
      problems.push({ message: `Milestone "${m.name}" has no id.` });
      continue;
    }
    if (milestoneIds.has(m.id)) {
      problems.push({
        milestoneId: m.id,
        message: `Milestone id "${m.id}" is used more than once.`,
      });
    }
    milestoneIds.add(m.id);
    if (!m.name.trim()) {
      problems.push({ milestoneId: m.id, message: `Milestone "${m.id}" has no name.` });
    }
    if (!isIsoDate(m.date)) {
      problems.push({
        milestoneId: m.id,
        message: `Milestone "${m.name || m.id}" has an invalid date "${m.date}". Use YYYY-MM-DD.`,
      });
    }
  }

  const deliverableIds = new Set(plan.deliverables.map((d) => d.id));
  const seenIds = new Set<string>();
  const seenNames = new Map<string, string>();

  for (const d of plan.deliverables) {
    const at = (message: string, milestoneId?: string) =>
      problems.push({ deliverableId: d.id, ...(milestoneId ? { milestoneId } : {}), message });
    const name = label(d);

    if (seenIds.has(d.id)) at(`Deliverable id "${d.id}" is used more than once.`);
    seenIds.add(d.id);

    if (!d.title.trim()) at(`"${name}" has no title.`);
    if (!d.taskTeam.trim()) at(`"${name}" has no task team.`);

    if (d.containerName) {
      const other = seenNames.get(d.containerName);
      if (other !== undefined) {
        at(`Container name ${d.containerName} is planned twice (also on deliverable "${other}").`);
      } else {
        seenNames.set(d.containerName, d.id);
      }
      if (options.namingConvention) {
        for (const p of validateContainerName(d.containerName, options.namingConvention).problems) {
          at(`${d.containerName}: ${p.message}`);
        }
      }
    }

    for (const pre of d.predecessors ?? []) {
      if (pre === d.id) at(`"${name}" lists itself as a predecessor.`);
      else if (!deliverableIds.has(pre)) at(`"${name}" depends on unknown deliverable "${pre}".`);
    }

    if (d.issues.length === 0) at(`"${name}" has no planned delivery at any milestone.`);

    const issueMilestones = new Set<string>();
    for (const issue of d.issues) {
      const mid = issue.milestoneId;
      if (!milestoneIds.has(mid)) {
        at(`"${name}" is planned for unknown milestone "${mid}".`, mid);
      }
      if (issueMilestones.has(mid)) {
        at(`"${name}" is planned more than once for milestone "${mid}".`, mid);
      }
      issueMilestones.add(mid);

      const status = getStatusCode(issue.status);
      if (!status) {
        at(`"${name}" has an unknown target status "${issue.status}" for "${mid}".`, mid);
      } else if (status.withdrawn) {
        at(`"${name}" targets withdrawn status ${issue.status} for "${mid}".`, mid);
      } else if (status.state === 'wip') {
        at(
          `"${name}" targets ${issue.status} for "${mid}", but work in progress is never a delivery. Use a shared or published status.`,
          mid,
        );
      }

      if (issue.due !== undefined && !isIsoDate(issue.due)) {
        at(`"${name}" has an invalid due date "${issue.due}" for "${mid}". Use YYYY-MM-DD.`, mid);
      }
    }
  }

  return problems;
}
