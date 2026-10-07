import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('reads quoted cells with commas, quotes and line breaks', () => {
    expect(parseCsv('Name,Title\r\nA-1,"Plan, level 1"\nA-2,"Say ""hi""\nsecond line"\n')).toEqual([
      ['Name', 'Title'],
      ['A-1', 'Plan, level 1'],
      ['A-2', 'Say "hi"\nsecond line'],
    ]);
  });

  it('detects semicolons and tabs, and drops a byte order mark', () => {
    expect(parseCsv('\uFEFFName;Rev\nA-1;P01')).toEqual([
      ['Name', 'Rev'],
      ['A-1', 'P01'],
    ]);
    expect(parseCsv('Name\tRev\nA-1\tP01')).toEqual([
      ['Name', 'Rev'],
      ['A-1', 'P01'],
    ]);
  });
});
