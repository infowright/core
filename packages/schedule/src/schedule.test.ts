import { describe, expect, it } from 'vitest';
import { guessDayFirst, parseScheduleDate } from './dates';
import { findActivity, parseScheduleRows } from './parse-rows';

describe('parseScheduleDate', () => {
  it('reads Primavera P6 dates with and without the actual marker', () => {
    expect(parseScheduleDate('23-Mar-26 A')).toEqual({ date: '2026-03-23', actual: true });
    expect(parseScheduleDate('05-Nov-27')).toEqual({ date: '2027-11-05', actual: false });
    expect(parseScheduleDate('05-Nov-27*')).toEqual({ date: '2027-11-05', actual: false });
    expect(parseScheduleDate('5-nov-2027 08:00')).toEqual({ date: '2027-11-05', actual: false });
  });

  it('reads ISO dates and date-times', () => {
    expect(parseScheduleDate('2026-03-23')).toEqual({ date: '2026-03-23', actual: false });
    expect(parseScheduleDate('2026-03-23 00:00:00')).toEqual({ date: '2026-03-23', actual: false });
  });

  it('reads Excel serial numbers and Date objects', () => {
    expect(parseScheduleDate(46104)).toEqual({ date: '2026-03-23', actual: false });
    expect(parseScheduleDate(new Date(2026, 2, 23))).toEqual({ date: '2026-03-23', actual: false });
  });

  it('returns undefined for empty or unreadable values', () => {
    for (const value of ['', '  ', null, undefined, 'TBC', '31-Feb-26', '23/23/2026', true]) {
      expect(parseScheduleDate(value)).toBeUndefined();
    }
  });
});

describe('parseScheduleRows', () => {
  const rows = [
    {
      'Activity ID': 'DES-1000',
      'Activity Name': 'Concept design',
      Start: '01-Feb-27 A',
      Finish: '31-Mar-27',
    },
    { 'Activity ID': '', 'Activity Name': 'WBS: Design', Start: '', Finish: '' },
    {
      'Activity ID': 'DES-1040',
      'Activity Name': 'Developed design',
      Start: '2027-04-01',
      Finish: 46660,
    },
    { 'Activity ID': 'DES-1050', 'Activity Name': 'Survey', Start: 'TBC', Finish: '' },
    { 'Activity ID': 'DES-1000', 'Activity Name': 'Duplicate', Start: '', Finish: '' },
  ];

  it('reads activities and skips rows without an ID', () => {
    const { schedule } = parseScheduleRows(rows);
    expect(schedule.activities.map((a) => a.id)).toEqual(['DES-1000', 'DES-1040', 'DES-1050']);
    expect(findActivity(schedule, 'DES-1000')).toEqual({
      id: 'DES-1000',
      name: 'Concept design',
      start: '2027-02-01',
      finish: '2027-03-31',
      startActual: true,
      finishActual: false,
    });
    expect(findActivity(schedule, 'DES-1040')?.finish).toBe('2027-09-30');
  });

  it('reports duplicate IDs', () => {
    const { problems } = parseScheduleRows(rows);
    // TBC is read as no date yet, not as a problem.
    expect(problems).toEqual([
      'Activity DES-1000 appears more than once (row 5). The first one is used.',
    ]);
  });

  it('matches headers loosely', () => {
    const { schedule, problems } = parseScheduleRows([
      { activity_id: 'A1', 'TASK NAME': 'Something', 'Finish Date': '2027-01-15' },
    ]);
    expect(problems).toEqual([]);
    expect(schedule.activities[0]).toMatchObject({
      id: 'A1',
      name: 'Something',
      finish: '2027-01-15',
    });
  });

  it('explains a missing ID column', () => {
    const { schedule, problems } = parseScheduleRows([{ Name: 'x', Finish: '2027-01-01' }]);
    expect(schedule.activities).toEqual([]);
    expect(problems[0]).toContain('No activity ID column');
  });

  it('warns when there is no finish date column', () => {
    const { problems } = parseScheduleRows([{ 'Activity ID': 'A1', Start: '2027-01-01' }]);
    expect(problems).toEqual([
      'No finish date column found. Delivery dates cannot be taken from this programme.',
    ]);
  });
});

describe('dates from CDE and programme exports', () => {
  const read = (v: unknown, dayFirst?: boolean) => parseScheduleDate(v, { dayFirst })?.date;
  it('reads the common ways of writing a date', () => {
    expect(read('2026-10-15T14:22:05Z')).toBe('2026-10-15');
    expect(read('2026-10-15 14:22:05.123+02:00')).toBe('2026-10-15');
    expect(read('15/10/2026')).toBe('2026-10-15');
    expect(read('15/10/2026 14:22')).toBe('2026-10-15');
    expect(read('10/15/2026 3:24 PM')).toBe('2026-10-15');
    expect(read('15.10.2026')).toBe('2026-10-15');
    expect(read('15.10.26 08:00')).toBe('2026-10-15');
    expect(read('2026/10/15')).toBe('2026-10-15');
    expect(read('15-Oct-26 A')).toBe('2026-10-15');
    expect(read('15 Oct 2026')).toBe('2026-10-15');
    expect(read('15 October 2026 08:00')).toBe('2026-10-15');
    expect(read('Oct 15, 2026 3:24 PM')).toBe('2026-10-15');
    expect(read('October 15, 2026')).toBe('2026-10-15');
    expect(read('Thu 15/10/26')).toBe('2026-10-15');
    expect(read('Thursday, 15 October 2026')).toBe('2026-10-15');
  });
  it('reads day and month as asked when both could be either', () => {
    expect(read('03/04/2026')).toBe('2026-04-03');
    expect(read('03/04/2026', false)).toBe('2026-03-04');
    expect(guessDayFirst(['03/04/2026', '13/04/2026'])).toBe(true);
    expect(guessDayFirst(['03/04/2026', '04/23/2026 1:00 PM'])).toBe(false);
    expect(guessDayFirst(['03/04/2026'])).toBeUndefined();
  });
  it('leaves out what is not a date', () => {
    expect(read('Not started')).toBeUndefined();
    expect(read('31/02/2026')).toBeUndefined();
  });
});
