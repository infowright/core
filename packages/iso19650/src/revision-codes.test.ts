import { describe, expect, it } from 'vitest';
import { exampleRevision, parseRevision, type RevisionScheme } from './revision-codes';

describe('parseRevision (UK National Annex)', () => {
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

describe('parseRevision (custom scheme)', () => {
  const scheme: RevisionScheme = {
    preliminaryPrefix: 'T',
    contractualPrefix: 'R',
    digits: 1,
    wipVersions: false,
    versionSeparator: '.',
    versionDigits: 2,
  };

  it('follows the project scheme', () => {
    expect(parseRevision('T3', scheme)).toEqual({ raw: 'T3', type: 'preliminary', revision: 3 });
    expect(parseRevision('R1', scheme)).toEqual({ raw: 'R1', type: 'contractual', revision: 1 });
  });

  it('rejects codes from other schemes', () => {
    expect(parseRevision('P01', scheme)).toBeUndefined();
    expect(parseRevision('T3.01', scheme)).toBeUndefined();
  });

  it('builds examples in the scheme', () => {
    expect(exampleRevision(scheme, 'contractual')).toBe('R1');
  });
});
