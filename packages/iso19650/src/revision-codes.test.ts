import { describe, expect, it } from 'vitest';
import { checkRevisionForStatus, parseRevision } from './revision-codes';

describe('parseRevision', () => {
  it('parses work in progress revisions with a version', () => {
    expect(parseRevision('P01.03')).toEqual({
      raw: 'P01.03',
      type: 'preliminary',
      revision: 1,
      version: 3,
    });
  });

  it('parses preliminary and contractual revisions', () => {
    expect(parseRevision('P02')).toEqual({ raw: 'P02', type: 'preliminary', revision: 2 });
    expect(parseRevision('C12')).toEqual({ raw: 'C12', type: 'contractual', revision: 12 });
  });

  it('rejects malformed revisions', () => {
    for (const code of ['P1', 'P001', 'p01', 'C01.1', 'X01', 'P00', 'P01.00', 'P01-01', '', 'C']) {
      expect(parseRevision(code)).toBeUndefined();
    }
  });
});

describe('checkRevisionForStatus', () => {
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
    expect(checkRevisionForStatus('P01', 'A2')[0]).toContain('contractual');
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
  });
});
