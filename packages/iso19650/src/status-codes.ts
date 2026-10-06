import type { ContainerState } from './container-states';

export type RevisionType = 'preliminary' | 'contractual';

export interface StatusCode {
  /** Code as written on the container, e.g. "S2", "A1", "CR". */
  code: string;
  description: string;
  /** CDE state the code belongs to. */
  state: Exclude<ContainerState, 'archived'>;
  /** Shared sub-group used by the UK National Annex. */
  group: 'wip' | 'shared-non-contractual' | 'published-contractual' | 'published-aim';
  revisionType: RevisionType;
  withdrawn: boolean;
}

const FIXED_CODES: readonly StatusCode[] = [
  {
    code: 'S0',
    description: 'Initial status',
    state: 'wip',
    group: 'wip',
    revisionType: 'preliminary',
    withdrawn: false,
  },
  {
    code: 'S1',
    description: 'Suitable for coordination',
    state: 'shared',
    group: 'shared-non-contractual',
    revisionType: 'preliminary',
    withdrawn: false,
  },
  {
    code: 'S2',
    description: 'Suitable for information',
    state: 'shared',
    group: 'shared-non-contractual',
    revisionType: 'preliminary',
    withdrawn: false,
  },
  {
    code: 'S3',
    description: 'Suitable for review and comment',
    state: 'shared',
    group: 'shared-non-contractual',
    revisionType: 'preliminary',
    withdrawn: false,
  },
  {
    code: 'S4',
    description: 'Suitable for stage approval',
    state: 'shared',
    group: 'shared-non-contractual',
    revisionType: 'preliminary',
    withdrawn: false,
  },
  {
    code: 'S5',
    description: 'Withdrawn',
    state: 'shared',
    group: 'shared-non-contractual',
    revisionType: 'preliminary',
    withdrawn: true,
  },
  {
    code: 'S6',
    description: 'Suitable for PIM authorization',
    state: 'shared',
    group: 'shared-non-contractual',
    revisionType: 'preliminary',
    withdrawn: false,
  },
  {
    code: 'S7',
    description: 'Suitable for AIM authorization',
    state: 'shared',
    group: 'shared-non-contractual',
    revisionType: 'preliminary',
    withdrawn: false,
  },
  {
    code: 'CR',
    description: 'As constructed record document',
    state: 'published',
    group: 'published-aim',
    revisionType: 'contractual',
    withdrawn: false,
  },
];

const FIXED_BY_CODE = new Map(FIXED_CODES.map((s) => [s.code, s]));

/** Status codes from the UK National Annex to BS EN ISO 19650-2 (Table NA.1). */
export const UK_NA_FIXED_STATUS_CODES = FIXED_CODES;

/**
 * Looks up a UK National Annex status code.
 * Handles the numbered families A1, A2 ... An and B1, B2 ... Bn.
 * Returns undefined for anything that is not a valid code.
 */
export function getStatusCode(code: string): StatusCode | undefined {
  const fixed = FIXED_BY_CODE.get(code);
  if (fixed) return fixed;

  const numbered = /^([AB])([1-9][0-9]*)$/.exec(code);
  if (!numbered) return undefined;

  if (numbered[1] === 'A') {
    return {
      code,
      description: 'Authorized and accepted',
      state: 'published',
      group: 'published-contractual',
      revisionType: 'contractual',
      withdrawn: false,
    };
  }
  return {
    code,
    description: 'Partial sign-off (with comments)',
    state: 'published',
    group: 'published-contractual',
    revisionType: 'preliminary',
    withdrawn: false,
  };
}

/** True when `code` is a status code that can still be used (S5 is withdrawn). */
export function isUsableStatusCode(code: string): boolean {
  const status = getStatusCode(code);
  return status !== undefined && !status.withdrawn;
}
