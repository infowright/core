import { describe, expect, it } from 'vitest';
import {
  describeConvention,
  UK_NA_NAMING_CONVENTION,
  validateContainerName,
  type NamingConvention,
} from './naming';

describe('validateContainerName (UK National Annex)', () => {
  it('accepts a correct name and splits it into fields', () => {
    const result = validateContainerName('123456-ORG-A1-ZZ-M3-A-0001');
    expect(result.valid).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.values).toEqual({
      project: '123456',
      originator: 'ORG',
      volume: 'A1',
      level: 'ZZ',
      type: 'M3',
      role: 'A',
      number: '0001',
    });
  });

  it('ignores a file extension', () => {
    expect(validateContainerName('PRJ-ORG-ZZ-01-DR-S-000123.pdf').valid).toBe(true);
  });

  it('explains a wrong number of fields', () => {
    const result = validateContainerName('PRJ-ORG-ZZ-01-DR-0001');
    expect(result.valid).toBe(false);
    expect(result.problems[0]?.message).toContain('Expected 7 fields');
    expect(result.problems[0]?.message).toContain('found 6');
  });

  it('suggests the right delimiter when underscores are used', () => {
    const result = validateContainerName('PRJ_ORG_ZZ_01_DR_S_0001');
    expect(result.problems[0]?.message).toContain('not underscores');
  });

  it('asks for upper case', () => {
    const result = validateContainerName('prj-ORG-ZZ-01-DR-S-0001');
    expect(result.problems).toEqual([
      { field: 'project', message: 'Project "prj" must be upper case: PRJ.' },
    ]);
  });

  it('rejects special characters', () => {
    const result = validateContainerName('PR&J-ORG-ZZ-01-DR-S-0001');
    expect(result.problems[0]?.message).toContain('letters A-Z and digits 0-9');
  });

  it('checks field lengths', () => {
    const result = validateContainerName('PROJECT7-ORG-ZZ-01-DR-S-001');
    expect(result.problems.map((p) => p.field)).toEqual(['project', 'number']);
    expect(result.problems[0]?.message).toContain('expected 2 to 6');
    expect(result.problems[1]?.message).toContain('expected 4 to 6');
  });

  it('requires a numeric number field', () => {
    const result = validateContainerName('PRJ-ORG-ZZ-01-DR-S-00A1');
    expect(result.problems[0]).toEqual({
      field: 'number',
      message: 'Number "00A1" must contain digits only.',
    });
  });

  it('rejects unknown type and role codes', () => {
    const result = validateContainerName('PRJ-ORG-ZZ-01-XX-N-0001');
    expect(result.problems.map((p) => p.field)).toEqual(['type', 'role']);
    expect(result.problems[0]?.message).toContain('not a recognised code');
  });

  it('flags leading or trailing spaces', () => {
    const result = validateContainerName(' PRJ-ORG-ZZ-01-DR-S-0001');
    expect(result.valid).toBe(false);
    expect(result.problems[0]?.message).toContain('space');
  });

  it('reports an empty field', () => {
    const result = validateContainerName('PRJ--ZZ-01-DR-S-0001');
    expect(result.problems).toEqual([{ field: 'originator', message: 'Originator is empty.' }]);
  });
});

describe('custom conventions', () => {
  const custom: NamingConvention = {
    name: 'Example project',
    delimiter: '-',
    fields: [
      { key: 'project', label: 'Project', minLength: 3, maxLength: 3, charset: 'alphanumeric' },
      {
        key: 'role',
        label: 'Role',
        minLength: 2,
        maxLength: 2,
        charset: 'alphanumeric',
        allowedCodes: { AR: 'Architect', ST: 'Structural' },
      },
      { key: 'number', label: 'Number', minLength: 5, maxLength: 5, charset: 'numeric' },
    ],
  };

  it('validates names against a project-specific convention', () => {
    expect(validateContainerName('LKP-ST-00042', custom).valid).toBe(true);
    expect(validateContainerName('LKP-ME-00042', custom).valid).toBe(false);
  });

  it('describes the convention in error messages', () => {
    expect(describeConvention(custom)).toBe('Project-Role-Number');
    expect(describeConvention(UK_NA_NAMING_CONVENTION)).toBe(
      'Project-Originator-Volume/System-Level/Location-Type-Role-Number',
    );
  });
});
