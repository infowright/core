export interface NamingField {
  key: string;
  label: string;
  minLength: number;
  maxLength: number;
  /** alphanumeric: A-Z and 0-9. numeric: 0-9 only. */
  charset: 'alphanumeric' | 'numeric';
  /** When set, only these codes are accepted. Maps code to meaning. */
  allowedCodes?: Readonly<Record<string, string>>;
}

export interface NamingConvention {
  name: string;
  delimiter: string;
  fields: readonly NamingField[];
}

export interface NamingProblem {
  /** Field key, or undefined when the problem concerns the whole name. */
  field?: string;
  message: string;
}

export interface NamingResult {
  valid: boolean;
  /** Field values by key. Empty when the name could not be split into the expected fields. */
  values: Record<string, string>;
  problems: NamingProblem[];
}

export const UK_NA_TYPE_CODES: Readonly<Record<string, string>> = {
  AF: 'Animation file',
  BQ: 'Bill of quantities',
  CA: 'Calculations',
  CM: 'Combined model',
  CO: 'Correspondence',
  CP: 'Cost plan',
  CR: 'Clash rendition',
  DB: 'Database',
  DR: 'Drawing',
  FN: 'File note',
  HS: 'Health and safety',
  IE: 'Information exchange file',
  M2: 'Two-dimensional model',
  M3: 'Three-dimensional model',
  MI: 'Minutes / action notes',
  MR: 'Model rendition',
  MS: 'Method statement',
  PP: 'Presentation',
  PR: 'Programme',
  RD: 'Room data sheet',
  RI: 'Request for information',
  RP: 'Report',
  SA: 'Schedule of accommodation',
  SH: 'Schedule',
  SN: 'Snagging list',
  SP: 'Specification',
  SU: 'Survey',
  VS: 'Visualization',
};

export const UK_NA_ROLE_CODES: Readonly<Record<string, string>> = {
  A: 'Architect',
  B: 'Building surveyor',
  C: 'Civil engineer',
  D: 'Drainage, highways engineer',
  E: 'Electrical engineer',
  F: 'Facilities manager',
  G: 'Geographical and land surveyor',
  H: 'Heating and ventilation designer',
  I: 'Interior designer',
  K: 'Client',
  L: 'Landscape architect',
  M: 'Mechanical engineer',
  P: 'Public health engineer',
  Q: 'Quantity surveyor',
  S: 'Structural engineer',
  T: 'Town and country planner',
  W: 'Contractor',
  X: 'Subcontractor',
  Y: 'Specialist designer',
  Z: 'General (non-disciplinary)',
};

/** Information container naming convention from the UK National Annex to BS EN ISO 19650-2. */
export const UK_NA_NAMING_CONVENTION: NamingConvention = {
  name: 'UK National Annex',
  delimiter: '-',
  fields: [
    { key: 'project', label: 'Project', minLength: 2, maxLength: 6, charset: 'alphanumeric' },
    { key: 'originator', label: 'Originator', minLength: 2, maxLength: 6, charset: 'alphanumeric' },
    { key: 'volume', label: 'Volume/System', minLength: 2, maxLength: 2, charset: 'alphanumeric' },
    { key: 'level', label: 'Level/Location', minLength: 2, maxLength: 2, charset: 'alphanumeric' },
    {
      key: 'type',
      label: 'Type',
      minLength: 2,
      maxLength: 2,
      charset: 'alphanumeric',
      allowedCodes: UK_NA_TYPE_CODES,
    },
    {
      key: 'role',
      label: 'Role',
      minLength: 1,
      maxLength: 2,
      charset: 'alphanumeric',
      allowedCodes: UK_NA_ROLE_CODES,
    },
    { key: 'number', label: 'Number', minLength: 4, maxLength: 6, charset: 'numeric' },
  ],
};

/** Field labels joined with the delimiter, e.g. "Project-Originator-...-Number". */
export function describeConvention(convention: NamingConvention): string {
  return convention.fields.map((f) => f.label).join(convention.delimiter);
}

const FILE_EXTENSION = /\.[A-Za-z0-9]{1,5}$/;

/**
 * Validates an information container name against a naming convention.
 * A trailing file extension (e.g. ".pdf") is ignored.
 * Every problem is explained in plain language so it can be sent straight to the author.
 */
export function validateContainerName(
  name: string,
  convention: NamingConvention = UK_NA_NAMING_CONVENTION,
): NamingResult {
  const problems: NamingProblem[] = [];
  const { delimiter, fields } = convention;

  if (name !== name.trim()) {
    problems.push({ message: 'The name starts or ends with a space.' });
  }

  const bare = name.trim().replace(FILE_EXTENSION, '');
  const parts = bare.split(delimiter);

  if (parts.length !== fields.length) {
    let message = `Expected ${fields.length} fields (${describeConvention(convention)}) separated by "${delimiter}", but found ${parts.length}.`;
    if (!bare.includes(delimiter) && /[_ .]/.test(bare)) {
      message += ` Use "${delimiter}" between fields, not underscores, spaces or dots.`;
    }
    problems.push({ message });
    return { valid: false, values: {}, problems };
  }

  const values: Record<string, string> = {};
  fields.forEach((field, i) => {
    const value = parts[i] ?? '';
    values[field.key] = value;
    problems.push(...checkField(field, value));
  });

  return { valid: problems.length === 0, values, problems };
}

function checkField(field: NamingField, value: string): NamingProblem[] {
  const problems: NamingProblem[] = [];
  const at = (message: string) => problems.push({ field: field.key, message });

  if (value.length === 0) {
    at(`${field.label} is empty.`);
    return problems;
  }

  if (field.charset === 'numeric' && !/^[0-9]+$/.test(value)) {
    at(`${field.label} "${value}" must contain digits only.`);
  } else if (field.charset === 'alphanumeric' && !/^[A-Z0-9]+$/.test(value)) {
    if (/^[A-Za-z0-9]+$/.test(value)) {
      at(`${field.label} "${value}" must be upper case: ${value.toUpperCase()}.`);
    } else {
      at(`${field.label} "${value}" may only contain letters A-Z and digits 0-9.`);
    }
  }

  if (value.length < field.minLength || value.length > field.maxLength) {
    const expected =
      field.minLength === field.maxLength
        ? `${field.minLength}`
        : `${field.minLength} to ${field.maxLength}`;
    at(`${field.label} "${value}" has ${value.length} characters; expected ${expected}.`);
  }

  if (field.allowedCodes && problems.length === 0 && !(value in field.allowedCodes)) {
    at(`${field.label} "${value}" is not a recognised code for this project.`);
  }

  return problems;
}
