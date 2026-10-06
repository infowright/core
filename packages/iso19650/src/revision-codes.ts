import { getStatusCode, type RevisionType } from './status-codes';

export interface Revision {
  raw: string;
  type: RevisionType;
  /** Revision number, e.g. 1 for P01 or C01. */
  revision: number;
  /** Version within work in progress, e.g. 3 for P01.03. Undefined outside WIP. */
  version?: number;
}

const REVISION_PATTERN = /^([PC])(\d{2})(?:\.(\d{2}))?$/;

/**
 * Parses a revision code such as P01.01 (work in progress), P01 (shared) or C01 (published).
 * Returns undefined when the code does not follow the pattern.
 */
export function parseRevision(code: string): Revision | undefined {
  const match = REVISION_PATTERN.exec(code);
  if (!match) return undefined;

  const [, prefix, rev, ver] = match;
  const revision = Number(rev);
  if (revision === 0) return undefined;

  const parsed: Revision = {
    raw: code,
    type: prefix === 'C' ? 'contractual' : 'preliminary',
    revision,
  };
  if (ver !== undefined) {
    const version = Number(ver);
    if (version === 0) return undefined;
    parsed.version = version;
  }
  return parsed;
}

/**
 * Checks that a revision code fits the status code it is issued with.
 * Returns a list of problems in plain language. An empty list means the pair is valid.
 */
export function checkRevisionForStatus(revisionCode: string, statusCode: string): string[] {
  const problems: string[] = [];
  const status = getStatusCode(statusCode);
  const revision = parseRevision(revisionCode);

  if (!status) {
    problems.push(`"${statusCode}" is not a recognised status code.`);
  } else if (status.withdrawn) {
    problems.push(`Status code ${statusCode} has been withdrawn and should not be used.`);
  }

  if (!revision) {
    problems.push(
      `"${revisionCode}" is not a valid revision. Expected P01.01 in work in progress, P01 for preliminary or C01 for contractual issues.`,
    );
  }

  if (!status || !revision) return problems;

  if (status.state === 'wip') {
    if (revision.type !== 'preliminary') {
      problems.push(
        `Work in progress (${statusCode}) must use a preliminary revision starting with P.`,
      );
    }
    if (revision.version === undefined) {
      problems.push(
        `Work in progress (${statusCode}) needs a version after the revision, e.g. P01.01 instead of ${revisionCode}.`,
      );
    }
    return problems;
  }

  if (revision.version !== undefined) {
    problems.push(
      `Versions like .${String(revision.version).padStart(2, '0')} are only used in work in progress. Use P${String(revision.revision).padStart(2, '0')} or C${String(revision.revision).padStart(2, '0')} for ${statusCode}.`,
    );
  }

  if (status.revisionType === 'contractual' && revision.type !== 'contractual') {
    problems.push(
      `Status code ${statusCode} requires a contractual revision starting with C, e.g. C01.`,
    );
  }
  if (status.revisionType === 'preliminary' && revision.type !== 'preliminary') {
    problems.push(
      `Status code ${statusCode} requires a preliminary revision starting with P, e.g. P01.`,
    );
  }

  return problems;
}
