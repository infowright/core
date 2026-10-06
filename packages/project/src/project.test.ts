import { UK_NATIONAL_ANNEX } from '@infowright/iso19650';
import { describe, expect, it } from 'vitest';
import { createProject, projectDurationDays, validateProject } from './project';

const base = {
  id: 'p1',
  code: 'DEMO',
  name: 'Demo hospital',
  type: 'Healthcare',
  client: 'Demo Health Trust',
  location: 'Manchester',
  budget: { amount: 120_000_000, currency: 'GBP' },
  startDate: '2027-01-01',
  endDate: '2029-12-31',
};

describe('createProject', () => {
  it('starts as planned with a copy of the UK National Annex', () => {
    const project = createProject(base);
    expect(project.status).toBe('planned');
    expect(project.standard).toEqual(UK_NATIONAL_ANNEX);
    expect(project.standard).not.toBe(UK_NATIONAL_ANNEX);
  });

  it('gives every project an independent standard', () => {
    const a = createProject(base);
    const b = createProject({ ...base, id: 'p2', code: 'OTHER' });
    a.standard.statusCodes.push({
      code: 'IFC',
      description: 'Issued for construction',
      state: 'published',
      revisionType: 'contractual',
    });
    a.standard.namingConventions[0]!.fields[0]!.maxLength = 8;
    expect(b.standard.statusCodes.some((s) => s.code === 'IFC')).toBe(false);
    expect(b.standard.namingConventions[0]!.fields[0]!.maxLength).toBe(6);
    expect(UK_NATIONAL_ANNEX.namingConventions[0]!.fields[0]!.maxLength).toBe(6);
  });
});

describe('validateProject', () => {
  it('accepts a complete project', () => {
    expect(validateProject(createProject(base))).toEqual([]);
  });

  it('accepts a project with only the required fields', () => {
    expect(validateProject(createProject({ id: 'p3', code: 'MIN', name: 'Minimal' }))).toEqual([]);
  });

  it('checks the project code against the naming convention', () => {
    const problems = validateProject(createProject({ ...base, code: 'demo-hospital' }));
    expect(problems[0]).toContain('Project code does not fit the naming convention');
  });

  it('reports missing name, bad budget, bad dates', () => {
    const project = createProject({
      ...base,
      name: '',
      budget: { amount: -5, currency: 'pounds' },
      startDate: '2027-06-01',
      endDate: '2027-05-01',
    });
    expect(validateProject(project)).toEqual([
      'The project needs a name.',
      'The budget must be a number of zero or more.',
      '"pounds" is not a currency code. Use three letters, e.g. GBP, EUR, PLN.',
      'The end date is before the start date.',
    ]);
  });

  it('checks the map pin', () => {
    expect(
      validateProject(createProject({ ...base, coordinates: { lat: 53.48, lng: -2.24 } })),
    ).toEqual([]);
    expect(validateProject(createProject({ ...base, coordinates: { lat: 91, lng: 200 } }))).toEqual(
      ['The map pin has an invalid latitude.', 'The map pin has an invalid longitude.'],
    );
  });

  it('includes problems in the project standard', () => {
    const project = createProject(base);
    project.standard.revisions.contractualPrefix = 'P';
    expect(validateProject(project)).toEqual([
      'Information standard: Preliminary and contractual revisions need different prefixes.',
    ]);
  });
});

describe('projectDurationDays', () => {
  it('counts both the first and last day', () => {
    expect(projectDurationDays(createProject(base))).toBe(1096);
    expect(
      projectDurationDays(
        createProject({ ...base, startDate: '2027-01-01', endDate: '2027-01-01' }),
      ),
    ).toBe(1);
  });

  it('is undefined without both dates', () => {
    expect(projectDurationDays(createProject({ ...base, endDate: undefined }))).toBeUndefined();
  });
});
