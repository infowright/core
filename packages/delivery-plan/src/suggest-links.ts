import { daysBetween } from '@infowright/common';
import { checkName, UK_NA_ROLE_CODES, type InformationStandard } from '@infowright/iso19650';
import type { Activity, Schedule } from '@infowright/schedule';
import type { DeliveryPlan } from './types';
import { resolveDueDate } from './validate';

/*
 * Suggests which programme activity each planned delivery belongs to, for deliveries not linked
 * yet. Nothing is linked automatically: a person confirms each suggestion. The reasons are kept
 * so the person can see why an activity was picked.
 *
 * The signals, strongest first:
 * - other deliveries of the same task team at the same milestone already link to the activity;
 * - the activity names the same stage or gate as the milestone, e.g. "Stage 3";
 * - the activity names the discipline or task team of the delivery, e.g. "Structural";
 * - the activity name shares words with the deliverable title;
 * - the activity finishes shortly before the delivery is due.
 */

export interface LinkCandidate {
  activityId: string;
  activityName: string;
  finish?: string;
  /** 0 to 1. */
  score: number;
  reasons: string[];
}

export interface LinkSuggestion {
  deliverableId: string;
  milestoneId: string;
  /** Best first. At least 1. */
  candidates: LinkCandidate[];
}

export interface SuggestOptions {
  standard?: InformationStandard;
  /** Task team codes and names, e.g. ARC: Acme Architects, to recognise them in activity names. */
  teams?: readonly { code: string; name?: string }[];
  /** Below this a candidate is not offered. */
  threshold?: number;
  /** How many candidates to keep per delivery. */
  limit?: number;
}

/** A score from here up is shown as a strong match. */
export const STRONG_LINK = 0.6;

const STOP = new Set([
  'and',
  'the',
  'of',
  'for',
  'to',
  'in',
  'on',
  'a',
  'an',
  'with',
  'by',
  'zz',
  'stage',
  'gate',
  'phase',
]);

/** Words cut to their first 5 letters, so architect and architecture meet. */
function stems(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w))
      .map((w) => w.slice(0, 5)),
  );
}

/** "Stage 3", "RIBA 4", "Gate 2", "WS3": the kind and the number. */
function stages(text: string): { kind: string; n: string }[] {
  const out: { kind: string; n: string }[] = [];
  const re = /\b(stage|gate|phase|riba|ws|work\s*stage)\s*-?\s*(\d{1,2})\b/gi;
  for (const m of text.matchAll(re)) {
    const kind = (m[1] ?? '').toLowerCase().replace(/\s+/g, '');
    out.push({ kind: kind === 'workstage' || kind === 'ws' ? 'stage' : kind, n: m[2] ?? '' });
  }
  return out;
}

const SERVICES = ['servi', 'mep', 'build'];
const EXTRA: Record<string, string[]> = {
  E: SERVICES,
  H: SERVICES,
  M: SERVICES,
  P: SERVICES,
  D: ['drain', 'highw'],
};

function disciplineWords(role: string | undefined): Set<string> {
  if (!role) return new Set();
  const out = new Set<string>();
  for (const letter of role.toUpperCase()) {
    const label = UK_NA_ROLE_CODES[letter];
    if (label) for (const s of stems(label.replace(/engineer|designer|surveyor/gi, ''))) out.add(s);
    for (const s of EXTRA[letter] ?? []) out.add(s);
  }
  return out;
}

const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x));

export function suggestActivityLinks(
  plan: DeliveryPlan,
  schedule: Schedule,
  options: SuggestOptions = {},
): LinkSuggestion[] {
  const threshold = options.threshold ?? 0.35;
  const limit = options.limit ?? 3;
  const teamNames = new Map((options.teams ?? []).map((t) => [t.code.toUpperCase(), t.name ?? '']));
  const milestones = new Map(plan.milestones.map((m) => [m.id, m]));
  const activities = schedule.activities.map((a) => ({
    activity: a,
    words: stems(a.name),
    stages: stages(a.name),
    upper: ` ${a.name.toUpperCase().replace(/[^A-Z0-9]+/g, ' ')} `,
  }));
  const byId = new Map(schedule.activities.map((a) => [a.id, a]));

  // What each task team already links to at each milestone.
  const usage = new Map<string, Map<string, number>>();
  for (const d of plan.deliverables) {
    for (const issue of d.issues) {
      if (!issue.activityId || !byId.has(issue.activityId)) continue;
      const key = `${d.taskTeam ?? ''}\n${issue.milestoneId}`;
      const counts = usage.get(key) ?? new Map<string, number>();
      counts.set(issue.activityId, (counts.get(issue.activityId) ?? 0) + 1);
      usage.set(key, counts);
    }
  }

  const suggestions: LinkSuggestion[] = [];
  for (const d of plan.deliverables) {
    const team = (d.taskTeam ?? '').toUpperCase();
    const role =
      d.containerName && options.standard
        ? checkName(d.containerName, options.standard)?.result.values.role
        : d.containerName?.split('-').at(-2);
    const discipline = disciplineWords(role);
    const teamWords = stems(teamNames.get(team) ?? '');
    const titleWords = stems(d.title ?? '');

    for (const issue of d.issues) {
      if (issue.activityId && byId.has(issue.activityId)) continue;
      const milestone = milestones.get(issue.milestoneId);
      const milestoneStages = stages(milestone?.name ?? '');
      const milestoneWords = stems(milestone?.name ?? '');
      const due = resolveDueDate(issue, plan);
      const siblings = usage.get(`${d.taskTeam ?? ''}\n${issue.milestoneId}`);
      const siblingTotal = siblings ? [...siblings.values()].reduce((n, x) => n + x, 0) : 0;

      const candidates: LinkCandidate[] = [];
      for (const a of activities) {
        let score = 0;
        const reasons: string[] = [];

        const used = siblings?.get(a.activity.id) ?? 0;
        if (used > 0) {
          score += 0.5 * (used / siblingTotal) + 0.1;
          reasons.push(
            `${used === 1 ? '1 other deliverable' : `${used} other deliverables`} of ${d.taskTeam} at ${milestone?.name ?? 'this milestone'} ${used === 1 ? 'links' : 'link'} to it`,
          );
        }

        const sameStage = milestoneStages.find((m) =>
          a.stages.some((s) => s.n === m.n && s.kind === m.kind),
        );
        const sameNumber = milestoneStages.find((m) => a.stages.some((s) => s.n === m.n));
        if (sameStage) {
          score += 0.3;
          reasons.push(`same ${sameStage.kind} ${sameStage.n}`);
        } else if (sameNumber) {
          score += 0.15;
          reasons.push(`same number as ${milestone?.name ?? 'the milestone'}`);
        } else if (milestoneStages.length > 0 && a.stages.length > 0) {
          score -= 0.3; // Another stage: almost certainly not this one.
        } else if (overlap(milestoneWords, a.words).length > 0) {
          score += 0.1;
          reasons.push('shares words with the milestone');
        }

        const byTeamCode = team.length >= 2 && a.upper.includes(` ${team} `);
        const byDiscipline = overlap(discipline, a.words).length > 0;
        const byTeamName = overlap(teamWords, a.words).length > 0;
        if (byTeamCode || byDiscipline || byTeamName) {
          score += 0.25;
          reasons.push(
            byTeamCode
              ? `names task team ${d.taskTeam}`
              : byTeamName
                ? 'names the task team'
                : 'same discipline',
          );
        }

        const shared = overlap(titleWords, a.words).filter((w) => !discipline.has(w));
        if (shared.length > 0) {
          score += Math.min(0.2, 0.08 * shared.length);
          reasons.push('shares words with the title');
        }

        if (due && a.activity.finish) {
          const gap = daysBetween(a.activity.finish, due);
          if (gap >= 0 && gap <= 60) {
            score += 0.1;
            reasons.push('finishes before the due date');
          } else if (gap < -30) {
            score -= 0.1;
          }
        }

        if (score >= threshold) {
          candidates.push(toCandidate(a.activity, Math.min(1, score), reasons));
        }
      }
      if (candidates.length === 0) continue;
      candidates.sort((x, y) => y.score - x.score || x.activityId.localeCompare(y.activityId));
      // Alternatives far behind the best one only add noise.
      const top = candidates[0]?.score ?? 0;
      suggestions.push({
        deliverableId: d.id,
        milestoneId: issue.milestoneId,
        candidates: candidates.filter((c) => c.score >= top - 0.2).slice(0, limit),
      });
    }
  }
  return suggestions;
}

function toCandidate(a: Activity, score: number, reasons: string[]): LinkCandidate {
  return {
    activityId: a.id,
    activityName: a.name,
    ...(a.finish ? { finish: a.finish } : {}),
    score: Math.round(score * 100) / 100,
    reasons,
  };
}

/** The plan with the chosen activities linked. Choices are keyed by deliverable and milestone. */
export function applyActivityLinks(
  plan: DeliveryPlan,
  choices: readonly { deliverableId: string; milestoneId: string; activityId: string }[],
): DeliveryPlan {
  const chosen = new Map(
    choices.map((c) => [`${c.deliverableId}\n${c.milestoneId}`, c.activityId]),
  );
  return {
    ...plan,
    deliverables: plan.deliverables.map((d) => {
      if (!d.issues.some((i) => chosen.has(`${d.id}\n${i.milestoneId}`))) return d;
      return {
        ...d,
        issues: d.issues.map((i) => {
          const activityId = chosen.get(`${d.id}\n${i.milestoneId}`);
          return activityId ? { ...i, activityId } : i;
        }),
      };
    }),
  };
}
