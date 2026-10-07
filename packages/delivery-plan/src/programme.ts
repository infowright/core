import { daysBetween } from '@infowright/common';
import type { Schedule } from '@infowright/schedule';
import type { DeliveryPlan } from './types';

export interface ProgrammeCheck {
  deliverableId: string;
  milestoneId: string;
  activityId: string;
  /**
   * missing: the activity is not in the programme.
   * late: the programme finishes the activity after the date the deliverable is due.
   * ok: the activity exists and finishes in time, or there is no date to compare with.
   */
  result: 'missing' | 'late' | 'ok';
  /** Finish of the activity in the programme. */
  finish?: string;
  finishActual?: boolean;
  /** Due date from the plan itself: the issue's own date, otherwise the milestone date. */
  due?: string;
  /** How many days the activity finishes after the due date. Set when late. */
  daysLate?: number;
}

/**
 * Compares every planned delivery that is linked to a programme activity with the programme.
 * Only links are checked; deliveries without an activity are left out.
 */
export function compareWithProgramme(plan: DeliveryPlan, schedule: Schedule): ProgrammeCheck[] {
  const byId = new Map(schedule.activities.map((a) => [a.id, a]));
  const milestoneDates = new Map(plan.milestones.map((m) => [m.id, m.date]));
  const checks: ProgrammeCheck[] = [];

  for (const d of plan.deliverables) {
    for (const issue of d.issues) {
      if (!issue.activityId) continue;
      const base = {
        deliverableId: d.id,
        milestoneId: issue.milestoneId,
        activityId: issue.activityId,
      };
      const activity = byId.get(issue.activityId);
      if (!activity) {
        checks.push({ ...base, result: 'missing' });
        continue;
      }
      const due = issue.due ?? milestoneDates.get(issue.milestoneId);
      const check: ProgrammeCheck = { ...base, result: 'ok', finishActual: activity.finishActual };
      if (activity.finish) check.finish = activity.finish;
      if (due) check.due = due;
      if (due && activity.finish) {
        const late = daysBetween(due, activity.finish);
        if (late > 0) {
          check.result = 'late';
          check.daysLate = late;
        }
      }
      checks.push(check);
    }
  }
  return checks;
}
