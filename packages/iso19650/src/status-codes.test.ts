import { describe, expect, it } from 'vitest';
import {
  getStatusCode,
  isUsableStatusCode,
  UK_NA_STATUS_CODES,
  type StatusCodeDefinition,
} from './status-codes';

describe('status codes (UK National Annex)', () => {
  it('has S0 as the only work in progress code', () => {
    const wip = UK_NA_STATUS_CODES.filter((s) => s.state === 'wip');
    expect(wip.map((s) => s.code)).toEqual(['S0']);
  });

  it('maps S1-S7 to shared with preliminary revisions', () => {
    for (const code of ['S1', 'S2', 'S3', 'S4', 'S6', 'S7']) {
      const status = getStatusCode(code);
      expect(status?.state).toBe('shared');
      expect(status?.revisionType).toBe('preliminary');
    }
  });

  it('marks S5 as withdrawn', () => {
    expect(getStatusCode('S5')?.withdrawn).toBe(true);
    expect(isUsableStatusCode('S5')).toBe(false);
  });

  it('resolves numbered A codes as published and contractual', () => {
    for (const code of ['A1', 'A2', 'A10']) {
      const status = getStatusCode(code);
      expect(status?.state).toBe('published');
      expect(status?.revisionType).toBe('contractual');
      expect(status?.code).toBe(code);
    }
  });

  it('resolves numbered B codes as published with preliminary revisions', () => {
    const status = getStatusCode('B3');
    expect(status?.state).toBe('published');
    expect(status?.revisionType).toBe('preliminary');
    expect(status?.description).toBe('Partial sign-off (with comments)');
  });

  it('treats CR as published and contractual', () => {
    const status = getStatusCode('CR');
    expect(status?.state).toBe('published');
    expect(status?.revisionType).toBe('contractual');
  });

  it('rejects codes that do not exist', () => {
    for (const code of ['S8', 'A0', 'B01', 'C1', 's1', 'a1', '', 'A', 'B']) {
      expect(getStatusCode(code)).toBeUndefined();
      expect(isUsableStatusCode(code)).toBe(false);
    }
  });
});

describe('status codes (custom project list)', () => {
  const custom: StatusCodeDefinition[] = [
    { code: 'WIP', description: 'Work in progress', state: 'wip', revisionType: 'preliminary' },
    { code: 'FC', description: 'For comment', state: 'shared', revisionType: 'preliminary' },
    {
      code: 'IFC',
      description: 'Issued for construction',
      state: 'published',
      revisionType: 'contractual',
    },
  ];

  it('uses only the project definitions', () => {
    expect(getStatusCode('FC', custom)?.state).toBe('shared');
    expect(getStatusCode('IFC', custom)?.revisionType).toBe('contractual');
    expect(getStatusCode('S2', custom)).toBeUndefined();
  });
});
