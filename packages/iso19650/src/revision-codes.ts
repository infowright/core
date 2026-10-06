import type { RevisionType } from './status-codes';

/** How a project writes revision codes. Plain data, so it can be stored and edited. */
export interface RevisionScheme {
  /** Prefix for preliminary (non-contractual) revisions, e.g. "P". */
  preliminaryPrefix: string;
  /** Prefix for contractual revisions, e.g. "C". */
  contractualPrefix: string;
  /** Number of digits in the revision number, e.g. 2 for P01. */
  digits: number;
  /** True when work in progress carries a version, e.g. P01.03. */
  wipVersions: boolean;
  /** Separator between revision and version, e.g. ".". */
  versionSeparator: string;
  /** Number of digits in the version, e.g. 2 for .03. */
  versionDigits: number;
}

/** Revision codes from the UK National Annex: P01.01 in WIP, P01 preliminary, C01 contractual. */
export const UK_NA_REVISION_SCHEME: RevisionScheme = {
  preliminaryPrefix: 'P',
  contractualPrefix: 'C',
  digits: 2,
  wipVersions: true,
  versionSeparator: '.',
  versionDigits: 2,
};

export interface Revision {
  raw: string;
  type: RevisionType;
  /** Revision number, e.g. 1 for P01 or C01. */
  revision: number;
  /** Version within work in progress, e.g. 3 for P01.03. Undefined outside WIP. */
  version?: number;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds an example code in the scheme, e.g. "P01" or "P01.01". */
export function exampleRevision(
  scheme: RevisionScheme,
  type: RevisionType,
  withVersion = false,
): string {
  const prefix = type === 'contractual' ? scheme.contractualPrefix : scheme.preliminaryPrefix;
  const base = prefix + '1'.padStart(scheme.digits, '0');
  return withVersion
    ? base + scheme.versionSeparator + '1'.padStart(scheme.versionDigits, '0')
    : base;
}

/**
 * Parses a revision code using a project's scheme (UK National Annex by default).
 * Returns undefined when the code does not follow the scheme.
 */
export function parseRevision(
  code: string,
  scheme: RevisionScheme = UK_NA_REVISION_SCHEME,
): Revision | undefined {
  const prefixes = [scheme.preliminaryPrefix, scheme.contractualPrefix].map(escape).join('|');
  const version = scheme.wipVersions
    ? `(?:${escape(scheme.versionSeparator)}(\\d{${scheme.versionDigits}}))?`
    : '';
  const match = new RegExp(`^(${prefixes})(\\d{${scheme.digits}})${version}$`).exec(code);
  if (!match) return undefined;

  const [, prefix, rev, ver] = match;
  const revision = Number(rev);
  if (revision === 0) return undefined;

  const parsed: Revision = {
    raw: code,
    type: prefix === scheme.contractualPrefix ? 'contractual' : 'preliminary',
    revision,
  };
  if (ver !== undefined) {
    const v = Number(ver);
    if (v === 0) return undefined;
    parsed.version = v;
  }
  return parsed;
}
