import type { ContainerState } from './container-states';

export type RevisionType = 'preliminary' | 'contractual';

/** One entry in a project's list of status codes. Plain data, so it can be stored and edited. */
export interface StatusCodeDefinition {
  /** The code, e.g. "S2". For a numbered family this is the prefix, e.g. "A" for A1, A2 ... */
  code: string;
  description: string;
  state: Exclude<ContainerState, 'archived'>;
  revisionType: RevisionType;
  /** True for a family of codes written as prefix plus number: A1, A2 ... An. */
  numbered?: boolean;
  /** Withdrawn codes are recognised but must not be used. */
  withdrawn?: boolean;
}

/** A status code as found on a container, resolved against a project's definitions. */
export interface StatusCode {
  code: string;
  description: string;
  state: Exclude<ContainerState, 'archived'>;
  revisionType: RevisionType;
  withdrawn: boolean;
}

/** Status codes from the UK National Annex to BS EN ISO 19650-2 (Table NA.1). */
export const UK_NA_STATUS_CODES: readonly StatusCodeDefinition[] = [
  { code: 'S0', description: 'Initial status', state: 'wip', revisionType: 'preliminary' },
  {
    code: 'S1',
    description: 'Suitable for coordination',
    state: 'shared',
    revisionType: 'preliminary',
  },
  {
    code: 'S2',
    description: 'Suitable for information',
    state: 'shared',
    revisionType: 'preliminary',
  },
  {
    code: 'S3',
    description: 'Suitable for review and comment',
    state: 'shared',
    revisionType: 'preliminary',
  },
  {
    code: 'S4',
    description: 'Suitable for stage approval',
    state: 'shared',
    revisionType: 'preliminary',
  },
  {
    code: 'S5',
    description: 'Withdrawn',
    state: 'shared',
    revisionType: 'preliminary',
    withdrawn: true,
  },
  {
    code: 'S6',
    description: 'Suitable for PIM authorization',
    state: 'shared',
    revisionType: 'preliminary',
  },
  {
    code: 'S7',
    description: 'Suitable for AIM authorization',
    state: 'shared',
    revisionType: 'preliminary',
  },
  {
    code: 'A',
    description: 'Authorized and accepted',
    state: 'published',
    revisionType: 'contractual',
    numbered: true,
  },
  {
    code: 'B',
    description: 'Partial sign-off (with comments)',
    state: 'published',
    revisionType: 'preliminary',
    numbered: true,
  },
  {
    code: 'CR',
    description: 'As constructed record document',
    state: 'published',
    revisionType: 'contractual',
  },
];

function resolve(code: string, def: StatusCodeDefinition): StatusCode {
  return {
    code,
    description: def.description,
    state: def.state,
    revisionType: def.revisionType,
    withdrawn: def.withdrawn === true,
  };
}

/**
 * Looks up a status code in a project's definitions (UK National Annex by default).
 * Numbered families such as A1, A2 ... An are matched by prefix.
 * Returns undefined for anything that is not a valid code.
 */
export function getStatusCode(
  code: string,
  definitions: readonly StatusCodeDefinition[] = UK_NA_STATUS_CODES,
): StatusCode | undefined {
  const fixed = definitions.find((d) => !d.numbered && d.code === code);
  if (fixed) return resolve(code, fixed);

  for (const def of definitions) {
    if (!def.numbered || !code.startsWith(def.code)) continue;
    if (/^[1-9][0-9]*$/.test(code.slice(def.code.length))) return resolve(code, def);
  }
  return undefined;
}

/** True when `code` exists in the definitions and has not been withdrawn. */
export function isUsableStatusCode(
  code: string,
  definitions: readonly StatusCodeDefinition[] = UK_NA_STATUS_CODES,
): boolean {
  const status = getStatusCode(code, definitions);
  return status !== undefined && !status.withdrawn;
}
