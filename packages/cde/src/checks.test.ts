import { UK_NATIONAL_ANNEX } from '@infowright/iso19650';
import { describe, expect, it } from 'vitest';
import { checkContainers } from './checks';

const check = (entries: { name: string; revision?: string; status?: string }[]) =>
  checkContainers({ entries }, UK_NATIONAL_ANNEX);

describe('checkContainers', () => {
  it('passes a container whose name, status and revision follow the standard', () => {
    const { checks, summary } = check([
      { name: 'DMO-ACM-ZZ-ZZ-DR-C-0001', revision: 'P02', status: 'S2' },
      { name: 'DMO-ACM-ZZ-ZZ-DR-C-0002.pdf', revision: 'C01', status: 'A1' },
    ]);
    expect(checks.map((c) => c.problems)).toEqual([[], []]);
    expect(checks[0]?.originator).toBe('ACM');
    expect(summary).toMatchObject({ checked: 2, passed: 2 });
  });

  it('reports each kind of problem once, in plain words', () => {
    const { checks, summary } = check([
      { name: 'DMO_ACM_ZZ_ZZ_DR_C_0003', revision: 'P01', status: 'S2' },
      { name: 'DMO-ACM-ZZ-ZZ-DR-C-0004', revision: 'P01', status: 'X9' },
      { name: 'DMO-ACM-ZZ-ZZ-DR-C-0005', revision: 'Q1', status: 'S2' },
      { name: 'DMO-ACM-ZZ-ZZ-DR-C-0006', revision: 'P01', status: 'A1' },
      { name: 'DMO-ACM-ZZ-ZZ-DR-C-0007' },
    ]);
    expect(checks.map((c) => c.problems.map((p) => p.kind))).toEqual([
      ['name'],
      ['status'],
      ['revision'],
      ['fit'],
      ['status', 'revision'],
    ]);
    expect(checks[0]?.problems[0]?.message).toMatch(/not underscores/);
    expect(checks[0]?.originator).toBe('ACM');
    expect(checks[3]?.problems[0]?.message).toMatch(/contractual revision/);
    expect(summary).toMatchObject({
      passed: 0,
      byKind: { name: 1, status: 2, revision: 2, fit: 1 },
    });
  });

  it('does not blame every container when the export has no status or revision column', () => {
    const { checks, summary } = check([{ name: 'DMO-ACM-ZZ-ZZ-DR-C-0001' }]);
    expect(checks[0]?.problems).toEqual([]);
    expect(summary).toMatchObject({ hasStatus: false, hasRevision: false, passed: 1 });
  });
});
