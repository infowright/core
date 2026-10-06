import {
  matchNamingConventions,
  UK_NA_NAMING_CONVENTION,
  type NamingConvention,
  type NamingMatch,
} from './naming';
import {
  exampleRevision,
  parseRevision,
  UK_NA_REVISION_SCHEME,
  type RevisionScheme,
} from './revision-codes';
import { getStatusCode, UK_NA_STATUS_CODES, type StatusCodeDefinition } from './status-codes';

/**
 * Everything a project agrees on about naming and statuses, in one place.
 * Plain data: it can be stored as JSON, edited in a form and copied between projects.
 */
export interface InformationStandard {
  name: string;
  /** One or more naming variants, e.g. drawings and documents. A name must fit one of them. */
  namingConventions: NamingConvention[];
  statusCodes: StatusCodeDefinition[];
  revisions: RevisionScheme;
}

/** UK National Annex to BS EN ISO 19650-2. A starting point to copy and adjust. */
export const UK_NATIONAL_ANNEX: InformationStandard = {
  name: 'UK National Annex',
  namingConventions: [UK_NA_NAMING_CONVENTION],
  statusCodes: [...UK_NA_STATUS_CODES],
  revisions: UK_NA_REVISION_SCHEME,
};

/**
 * Checks that a revision code fits the status code it is issued with, under a project's standard.
 * Returns a list of problems in plain language. An empty list means the pair is valid.
 */
export function checkRevisionForStatus(
  revisionCode: string,
  statusCode: string,
  standard: InformationStandard = UK_NATIONAL_ANNEX,
): string[] {
  const problems: string[] = [];
  const scheme = standard.revisions;
  const status = getStatusCode(statusCode, standard.statusCodes);
  const revision = parseRevision(revisionCode, scheme);

  if (!status) {
    problems.push(`"${statusCode}" is not a recognised status code.`);
  } else if (status.withdrawn) {
    problems.push(`Status code ${statusCode} has been withdrawn and should not be used.`);
  }

  if (!revision) {
    const examples = [
      scheme.wipVersions
        ? `${exampleRevision(scheme, 'preliminary', true)} in work in progress`
        : '',
      `${exampleRevision(scheme, 'preliminary')} for preliminary`,
      `${exampleRevision(scheme, 'contractual')} for contractual issues`,
    ].filter(Boolean);
    problems.push(`"${revisionCode}" is not a valid revision. Expected ${examples.join(', ')}.`);
  }

  if (!status || !revision) return problems;

  const pre = exampleRevision(scheme, 'preliminary');
  const con = exampleRevision(scheme, 'contractual');

  if (status.state === 'wip') {
    if (revision.type !== 'preliminary') {
      problems.push(
        `Work in progress (${statusCode}) must use a preliminary revision, e.g. ${pre}.`,
      );
    }
    if (scheme.wipVersions && revision.version === undefined) {
      problems.push(
        `Work in progress (${statusCode}) needs a version after the revision, e.g. ${exampleRevision(scheme, 'preliminary', true)} instead of ${revisionCode}.`,
      );
    }
    return problems;
  }

  if (revision.version !== undefined) {
    problems.push(
      `Versions are only used in work in progress. Use a revision without a version, e.g. ${pre} or ${con}, for ${statusCode}.`,
    );
  }
  if (status.revisionType === 'contractual' && revision.type !== 'contractual') {
    problems.push(`Status code ${statusCode} requires a contractual revision, e.g. ${con}.`);
  }
  if (status.revisionType === 'preliminary' && revision.type !== 'preliminary') {
    problems.push(`Status code ${statusCode} requires a preliminary revision, e.g. ${pre}.`);
  }
  return problems;
}

/**
 * Checks a project's standard before it is used, so mistakes in the setup
 * are caught when someone enters them, not later on real data.
 * Returns a list of problems in plain language. An empty list means the standard is usable.
 */
export function validateStandard(standard: InformationStandard): string[] {
  const problems: string[] = [];
  const { namingConventions, statusCodes, revisions } = standard;

  if (!standard.name.trim()) problems.push('The standard needs a name.');

  // Naming conventions
  if (namingConventions.length === 0) problems.push('Add at least one naming convention.');
  const several = namingConventions.length > 1;
  const variantNames = new Set<string>();
  for (const naming of namingConventions) {
    const say = (text: string) =>
      problems.push(several ? `${naming.name || 'Unnamed variant'}: ${text}` : text);

    if (several) {
      if (!naming.name.trim()) problems.push('Every naming variant needs a name.');
      else if (variantNames.has(naming.name)) {
        problems.push(`Naming variant "${naming.name}" is defined more than once.`);
      }
      variantNames.add(naming.name);
    }
    if (naming.delimiter.length !== 1 || /[A-Za-z0-9]/.test(naming.delimiter)) {
      say('The naming delimiter must be a single character that is not a letter or digit.');
    }
    if (naming.fields.length === 0) say('The naming convention needs at least one field.');
    const fieldKeys = new Set<string>();
    for (const f of naming.fields) {
      const name = f.label || f.key;
      if (!f.key.trim()) say(`Naming field "${name}" needs a key.`);
      if (fieldKeys.has(f.key)) say(`Naming field key "${f.key}" is used more than once.`);
      fieldKeys.add(f.key);
      if (!Number.isInteger(f.minLength) || f.minLength < 1) {
        say(`Naming field "${name}": minimum length must be 1 or more.`);
      }
      if (!Number.isInteger(f.maxLength) || f.maxLength < f.minLength) {
        say(`Naming field "${name}": maximum length must not be less than the minimum.`);
      }
      for (const code of Object.keys(f.allowedCodes ?? {})) {
        const pattern = f.charset === 'numeric' ? /^[0-9]+$/ : /^[A-Z0-9]+$/;
        if (!pattern.test(code) || code.length < f.minLength || code.length > f.maxLength) {
          say(
            `Naming field "${name}": code "${code}" does not fit the field's length or characters.`,
          );
        }
      }
    }
  }

  // Status codes
  const fixed = new Set<string>();
  const families = new Set<string>();
  for (const s of statusCodes) {
    if (!/^[A-Z0-9]+$/.test(s.code)) {
      problems.push(`Status code "${s.code}" may only contain letters A-Z and digits 0-9.`);
      continue;
    }
    const pool = s.numbered ? families : fixed;
    if (pool.has(s.code)) problems.push(`Status code "${s.code}" is defined more than once.`);
    pool.add(s.code);
    if (!s.description.trim()) problems.push(`Status code "${s.code}" needs a description.`);
  }
  for (const prefix of families) {
    for (const code of fixed) {
      if (code.startsWith(prefix) && /^[1-9][0-9]*$/.test(code.slice(prefix.length))) {
        problems.push(
          `Status code "${code}" clashes with the numbered family "${prefix}1, ${prefix}2 ...".`,
        );
      }
    }
  }
  const usable = statusCodes.filter((s) => !s.withdrawn);
  if (!usable.some((s) => s.state === 'wip')) {
    problems.push('At least one status code must be for work in progress.');
  }
  if (!usable.some((s) => s.state !== 'wip')) {
    problems.push('At least one status code must be for shared or published information.');
  }

  // Revision scheme
  for (const [label, prefix] of [
    ['Preliminary', revisions.preliminaryPrefix],
    ['Contractual', revisions.contractualPrefix],
  ] as const) {
    if (!/^[A-Z]+$/.test(prefix)) {
      problems.push(`${label} revision prefix "${prefix}" must be one or more letters A-Z.`);
    }
  }
  if (revisions.preliminaryPrefix === revisions.contractualPrefix) {
    problems.push('Preliminary and contractual revisions need different prefixes.');
  }
  if (!Number.isInteger(revisions.digits) || revisions.digits < 1 || revisions.digits > 4) {
    problems.push('Revision numbers must have between 1 and 4 digits.');
  }
  if (revisions.wipVersions) {
    if (revisions.versionSeparator.length !== 1 || /[A-Za-z0-9]/.test(revisions.versionSeparator)) {
      problems.push(
        'The version separator must be a single character that is not a letter or digit.',
      );
    }
    if (
      !Number.isInteger(revisions.versionDigits) ||
      revisions.versionDigits < 1 ||
      revisions.versionDigits > 4
    ) {
      problems.push('Versions must have between 1 and 4 digits.');
    }
  }

  return problems;
}

/** Checks a container name against all of a project's naming variants. */
export function checkName(name: string, standard: InformationStandard): NamingMatch | undefined {
  return matchNamingConventions(name, standard.namingConventions);
}
