import { daysBetween, isIsoDate } from '@infowright/common';
import {
  UK_NATIONAL_ANNEX,
  validateNamingField,
  validateStandard,
  type InformationStandard,
} from '@infowright/iso19650';

export const PROJECT_STATUSES = ['planned', 'active', 'on-hold', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Budget {
  amount: number;
  /** ISO 4217 currency code, e.g. GBP, EUR, PLN. */
  currency: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Project {
  id: string;
  /** Short project code, used in container names. */
  code: string;
  name: string;
  /** Free text, e.g. "Infrastructure", "Data centre", "Residential". */
  type?: string;
  client?: string;
  location?: string;
  /** Pin on the map for the site. */
  coordinates?: Coordinates;
  budget?: Budget;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  status: ProjectStatus;
  /** This project's own copy of the standard. Editing it never affects other projects. */
  standard: InformationStandard;
}

export type NewProject = Omit<Project, 'status' | 'standard'> & {
  status?: ProjectStatus;
  /** Template to copy. Defaults to the UK National Annex. */
  standard?: InformationStandard;
};

/** Creates a project with its own independent copy of the chosen standard. */
export function createProject(input: NewProject): Project {
  return {
    ...input,
    status: input.status ?? 'planned',
    standard: structuredClone(input.standard ?? UK_NATIONAL_ANNEX),
  };
}

/** Planned duration in calendar days, counting both the start and end day. */
export function projectDurationDays(project: Project): number | undefined {
  if (!project.startDate || !project.endDate) return undefined;
  if (!isIsoDate(project.startDate) || !isIsoDate(project.endDate)) return undefined;
  return daysBetween(project.startDate, project.endDate) + 1;
}

/**
 * Checks a project record and its standard.
 * Returns a list of problems in plain language. An empty list means the project is valid.
 */
export function validateProject(project: Project): string[] {
  const problems: string[] = [];

  if (!project.name.trim()) problems.push('The project needs a name.');
  if (!project.code.trim()) {
    problems.push('The project needs a code.');
  } else {
    const field = project.standard.namingConventions
      .flatMap((c) => c.fields)
      .find((f) => f.key === 'project');
    if (field) {
      for (const p of validateNamingField(field, project.code)) {
        problems.push(`Project code does not fit the naming convention: ${p.message}`);
      }
    }
  }

  if (!PROJECT_STATUSES.includes(project.status)) {
    problems.push(`"${project.status}" is not a valid project status.`);
  }

  if (project.coordinates) {
    const { lat, lng } = project.coordinates;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      problems.push('The map pin has an invalid latitude.');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      problems.push('The map pin has an invalid longitude.');
    }
  }

  if (project.budget) {
    const { amount, currency } = project.budget;
    if (!Number.isFinite(amount) || amount < 0) {
      problems.push('The budget must be a number of zero or more.');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      problems.push(`"${currency}" is not a currency code. Use three letters, e.g. GBP, EUR, PLN.`);
    }
  }

  for (const [label, value] of [
    ['Start date', project.startDate],
    ['End date', project.endDate],
  ] as const) {
    if (value !== undefined && !isIsoDate(value)) {
      problems.push(`${label} "${value}" is not a valid date. Use YYYY-MM-DD.`);
    }
  }
  const days = projectDurationDays(project);
  if (days !== undefined && days < 1) problems.push('The end date is before the start date.');

  for (const p of validateStandard(project.standard)) {
    problems.push(`Information standard: ${p}`);
  }

  return problems;
}
