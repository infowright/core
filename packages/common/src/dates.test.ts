import { describe, expect, it } from 'vitest';
import { daysBetween, isIsoDate, toIsoDate } from './dates';

describe('dates', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2027-13-01')).toBe(false);
    expect(isIsoDate('2027-1-01')).toBe(false);
  });

  it('counts calendar days', () => {
    expect(daysBetween('2027-01-01', '2027-12-31')).toBe(364);
    expect(daysBetween('2027-03-01', '2027-02-28')).toBe(-1);
  });

  it('builds ISO dates and rejects impossible ones', () => {
    expect(toIsoDate(2027, 3, 9)).toBe('2027-03-09');
    expect(toIsoDate(2027, 2, 30)).toBeUndefined();
  });
});
