import { describe, expect, it } from 'vitest';
import { getStatusCode, isUsableStatusCode, UK_NA_FIXED_STATUS_CODES } from './status-codes';

describe('status codes (UK National Annex)', () => {
  it('has S0 as the only work in progress code', () => {
    const wip = UK_NA_FIXED_STATUS_CODES.filter((s) => s.state === 'wip');
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

  it('treats CR as published, contractual, for AIM acceptance', () => {
    const status = getStatusCode('CR');
    expect(status?.state).toBe('published');
    expect(status?.group).toBe('published-aim');
    expect(status?.revisionType).toBe('contractual');
  });

  it('rejects codes that do not exist', () => {
    for (const code of ['S8', 'A0', 'B01', 'C1', 's1', 'a1', '', 'A']) {
      expect(getStatusCode(code)).toBeUndefined();
      expect(isUsableStatusCode(code)).toBe(false);
    }
  });
});
