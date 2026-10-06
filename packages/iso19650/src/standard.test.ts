import { describe, expect, it } from 'vitest';
import { validateContainerName } from './naming';
import {
  checkName,
  checkRevisionForStatus,
  UK_NATIONAL_ANNEX,
  validateStandard,
  type InformationStandard,
} from './standard';

describe('checkRevisionForStatus (UK National Annex)', () => {
  it('accepts valid pairs', () => {
    expect(checkRevisionForStatus('P01.01', 'S0')).toEqual([]);
    expect(checkRevisionForStatus('P03', 'S2')).toEqual([]);
    expect(checkRevisionForStatus('P02', 'B1')).toEqual([]);
    expect(checkRevisionForStatus('C01', 'A1')).toEqual([]);
    expect(checkRevisionForStatus('C04', 'CR')).toEqual([]);
  });

  it('requires a version in work in progress', () => {
    const problems = checkRevisionForStatus('P01', 'S0');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('P01.01');
  });

  it('does not allow versions outside work in progress', () => {
    const problems = checkRevisionForStatus('P01.02', 'S3');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('only used in work in progress');
  });

  it('requires contractual revisions for A codes and CR', () => {
    expect(checkRevisionForStatus('P01', 'A2')).toEqual([
      'Status code A2 requires a contractual revision, e.g. C01.',
    ]);
    expect(checkRevisionForStatus('P05', 'CR')[0]).toContain('contractual');
  });

  it('requires preliminary revisions for shared and B codes', () => {
    expect(checkRevisionForStatus('C01', 'S2')[0]).toContain('preliminary');
    expect(checkRevisionForStatus('C01', 'B1')[0]).toContain('preliminary');
  });

  it('flags the withdrawn S5 code', () => {
    expect(checkRevisionForStatus('P01', 'S5')[0]).toContain('withdrawn');
  });

  it('reports unknown status codes and invalid revisions together', () => {
    const problems = checkRevisionForStatus('P1', 'S9');
    expect(problems).toHaveLength(2);
    expect(problems[1]).toBe(
      '"P1" is not a valid revision. Expected P01.01 in work in progress, P01 for preliminary, C01 for contractual issues.',
    );
  });
});

describe('a project with its own standard', () => {
  const project: InformationStandard = {
    name: 'Example project',
    namingConventions: [
      {
        name: 'Example project',
        delimiter: '_',
        fields: [
          {
            key: 'originator',
            label: 'Originator',
            minLength: 3,
            maxLength: 3,
            charset: 'alphanumeric',
          },
          { key: 'project', label: 'Project', minLength: 3, maxLength: 3, charset: 'alphanumeric' },
          {
            key: 'type',
            label: 'Document type',
            minLength: 3,
            maxLength: 3,
            charset: 'alphanumeric',
            allowedCodes: { PLN: 'Plan', REP: 'Report', DWG: 'Drawing' },
          },
          { key: 'number', label: 'Number', minLength: 6, maxLength: 6, charset: 'numeric' },
        ],
      },
    ],
    statusCodes: [
      { code: 'WIP', description: 'Work in progress', state: 'wip', revisionType: 'preliminary' },
      { code: 'FC', description: 'For comment', state: 'shared', revisionType: 'preliminary' },
      {
        code: 'IFC',
        description: 'Issued for construction',
        state: 'published',
        revisionType: 'contractual',
      },
    ],
    revisions: {
      preliminaryPrefix: 'T',
      contractualPrefix: 'R',
      digits: 1,
      wipVersions: false,
      versionSeparator: '.',
      versionDigits: 2,
    },
  };

  it('is a valid standard', () => {
    expect(validateStandard(project)).toEqual([]);
  });

  it('checks names against its own variants', () => {
    expect(checkName('ABC_XYZ_PLN_000003', project)?.result.valid).toBe(true);
  });

  it('validates names with its own convention', () => {
    expect(validateContainerName('ABC_XYZ_PLN_000003', project.namingConventions[0]).valid).toBe(
      true,
    );
    expect(validateContainerName('ABC-XYZ-PLN-000003', project.namingConventions[0]).valid).toBe(
      false,
    );
  });

  it('checks revisions against its own status codes', () => {
    expect(checkRevisionForStatus('T2', 'FC', project)).toEqual([]);
    expect(checkRevisionForStatus('R1', 'IFC', project)).toEqual([]);
    expect(checkRevisionForStatus('T2', 'IFC', project)).toEqual([
      'Status code IFC requires a contractual revision, e.g. R1.',
    ]);
    expect(checkRevisionForStatus('C01', 'A1', project)).toHaveLength(2);
  });
});

describe('validateStandard', () => {
  it('accepts the UK National Annex preset', () => {
    expect(validateStandard(UK_NATIONAL_ANNEX)).toEqual([]);
  });

  it('catches setup mistakes', () => {
    const broken: InformationStandard = {
      name: ' ',
      namingConventions: [
        {
          name: 'Broken',
          delimiter: 'x',
          fields: [
            { key: 'a', label: 'A', minLength: 3, maxLength: 2, charset: 'alphanumeric' },
            {
              key: 'a',
              label: 'B',
              minLength: 2,
              maxLength: 2,
              charset: 'alphanumeric',
              allowedCodes: { XYZ: 'Too long' },
            },
          ],
        },
      ],
      statusCodes: [
        {
          code: 'A',
          description: 'Approved',
          state: 'published',
          revisionType: 'contractual',
          numbered: true,
        },
        { code: 'A1', description: 'Clash', state: 'published', revisionType: 'contractual' },
        { code: 's1', description: 'Lower case', state: 'shared', revisionType: 'preliminary' },
      ],
      revisions: {
        preliminaryPrefix: 'P',
        contractualPrefix: 'P',
        digits: 0,
        wipVersions: true,
        versionSeparator: '',
        versionDigits: 2,
      },
    };

    expect(validateStandard(broken)).toEqual([
      'The standard needs a name.',
      'The naming delimiter must be a single character that is not a letter or digit.',
      'Naming field "A": maximum length must not be less than the minimum.',
      'Naming field key "a" is used more than once.',
      'Naming field "B": code "XYZ" does not fit the field\'s length or characters.',
      'Status code "s1" may only contain letters A-Z and digits 0-9.',
      'Status code "A1" clashes with the numbered family "A1, A2 ...".',
      'At least one status code must be for work in progress.',
      'Preliminary and contractual revisions need different prefixes.',
      'Revision numbers must have between 1 and 4 digits.',
      'The version separator must be a single character that is not a letter or digit.',
    ]);
  });
});

describe('several naming variants', () => {
  const standard: InformationStandard = {
    ...UK_NATIONAL_ANNEX,
    namingConventions: [
      UK_NATIONAL_ANNEX.namingConventions[0]!,
      {
        name: 'Documents',
        delimiter: '-',
        fields: [
          { key: 'project', label: 'Project', minLength: 2, maxLength: 6, charset: 'alphanumeric' },
          {
            key: 'originator',
            label: 'Originator',
            minLength: 2,
            maxLength: 6,
            charset: 'alphanumeric',
          },
          { key: 'type', label: 'Type', minLength: 2, maxLength: 3, charset: 'alphanumeric' },
          { key: 'number', label: 'Number', minLength: 4, maxLength: 6, charset: 'numeric' },
        ],
      },
    ],
  };

  it('accepts a name that fits any variant and says which one', () => {
    expect(checkName('DEMO-ACME-ZZ-01-DR-A-0001', standard)?.convention.name).toBe(
      'UK National Annex',
    );
    const doc = checkName('DEMO-ACME-PLN-000003', standard);
    expect(doc?.result.valid).toBe(true);
    expect(doc?.convention.name).toBe('Documents');
  });

  it('reports against the closest variant when nothing fits', () => {
    const match = checkName('DEMO-ACME-PLAN-000003', standard);
    expect(match?.result.valid).toBe(false);
    expect(match?.convention.name).toBe('Documents');
    expect(match?.result.problems[0]?.field).toBe('type');
  });

  it('requires distinct variant names', () => {
    const twice = {
      ...standard,
      namingConventions: [standard.namingConventions[1]!, standard.namingConventions[1]!],
    };
    expect(validateStandard(twice)).toEqual([
      'Naming variant "Documents" is defined more than once.',
    ]);
  });
});
