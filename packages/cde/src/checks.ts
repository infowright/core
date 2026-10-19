import {
  checkName,
  checkRevisionForStatus,
  getStatusCode,
  parseRevision,
  type InformationStandard,
} from '@infowright/iso19650';
import type { Register, RegisterEntry } from './types';

/*
 * Checks every container in the CDE against the project's own rules: the name, the status code,
 * the revision, and whether the revision fits the status. Each problem is in plain language, so
 * it can go straight to the task team that owns the container.
 */

export type CheckKind = 'name' | 'status' | 'revision' | 'fit';

export interface ContainerProblem {
  kind: CheckKind;
  message: string;
}

export interface ContainerCheck {
  entry: RegisterEntry;
  problems: ContainerProblem[];
  /** The originator field of the name, when the name could be read; who to tell. */
  originator?: string;
}

export interface CheckSummary {
  checked: number;
  passed: number;
  /** Containers with at least 1 problem of the kind. */
  byKind: Record<CheckKind, number>;
  /** Whether the export had the column at all; a missing column is not every container's fault. */
  hasStatus: boolean;
  hasRevision: boolean;
}

export const CHECK_LABELS: Record<CheckKind, string> = {
  name: 'Name',
  status: 'Status',
  revision: 'Revision',
  fit: 'Revision for status',
};

/** Checks each container of the register. Containers listed more than once are each checked. */
export function checkContainers(
  register: Register,
  standard: InformationStandard,
): { checks: ContainerCheck[]; summary: CheckSummary } {
  const hasStatus = register.entries.some((e) => e.status);
  const hasRevision = register.entries.some((e) => e.revision);
  const summary: CheckSummary = {
    checked: register.entries.length,
    passed: 0,
    byKind: { name: 0, status: 0, revision: 0, fit: 0 },
    hasStatus,
    hasRevision,
  };

  const checks = register.entries.map((entry) => {
    const problems: ContainerProblem[] = [];
    const naming = checkName(entry.name, standard);
    for (const p of naming?.result.problems ?? [])
      problems.push({ kind: 'name', message: p.message });

    const status = entry.status ? getStatusCode(entry.status, standard.statusCodes) : undefined;
    if (hasStatus && !entry.status) {
      problems.push({ kind: 'status', message: 'No status code.' });
    } else if (entry.status && !status) {
      problems.push({
        kind: 'status',
        message: `"${entry.status}" is not a status code of this project.`,
      });
    } else if (status?.withdrawn) {
      problems.push({
        kind: 'status',
        message: `Status code ${entry.status} has been withdrawn and should not be used.`,
      });
    }

    const revision = entry.revision ? parseRevision(entry.revision, standard.revisions) : undefined;
    if (hasRevision && !entry.revision) {
      problems.push({ kind: 'revision', message: 'No revision.' });
    } else if (entry.revision && !revision) {
      const [message] = checkRevisionForStatus(
        entry.revision,
        status ? (entry.status ?? '') : '',
        standard,
      ).filter((m) => m.startsWith(`"${entry.revision}"`));
      problems.push({
        kind: 'revision',
        message: message ?? `"${entry.revision}" is not a valid revision.`,
      });
    }

    // Only when both are valid on their own, so 1 mistake is not reported twice.
    if (status && !status.withdrawn && revision && entry.revision && entry.status) {
      for (const message of checkRevisionForStatus(entry.revision, entry.status, standard)) {
        problems.push({ kind: 'fit', message });
      }
    }

    const kinds = new Set(problems.map((p) => p.kind));
    for (const kind of kinds) summary.byKind[kind]++;
    if (problems.length === 0) summary.passed++;

    // When the name cannot be read field by field, the second part is still most likely the
    // originator, e.g. DMO_ARC_ZZ_... gives ARC.
    const originator =
      naming?.result.values.originator ||
      entry.name
        .trim()
        .split(/[-_ .]/)[1]
        ?.toUpperCase() ||
      undefined;
    return { entry, problems, ...(originator ? { originator } : {}) };
  });

  return { checks, summary };
}
