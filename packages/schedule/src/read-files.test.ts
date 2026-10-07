import { describe, expect, it } from 'vitest';
import { parseMsProjectXml, parseXer, readScheduleSheets } from './read-files';

const XER = [
  'ERMHDR\t21.12\t2026-10-01\tProject\tadmin\tadmin\tdbxDatabaseNoName\tProject Management\tGBP',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\t1\tDEMO',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_type\tstatus_code\ttask_name\tact_start_date\tact_end_date\tearly_start_date\tearly_end_date\ttarget_start_date\ttarget_end_date',
  '%R\t10\t1\tWBS-1\tTT_WBS\tTK_NotStart\tCivils\t\t\t\t\t\t',
  '%R\t11\t1\tC1000\tTT_Task\tTK_Complete\tSite survey\t2026-01-05 08:00\t2026-02-20 17:00\t\t\t2026-01-05 08:00\t2026-02-13 17:00',
  '%R\t12\t1\tC1010\tTT_Task\tTK_Active\tDrainage design\t2026-03-02 08:00\t\t\t2026-07-31 17:00\t2026-03-02 08:00\t2026-06-30 17:00',
  '%R\t13\t1\tC1020\tTT_FinMile\tTK_NotStart\tStage 3 gate\t\t\t2026-09-30 17:00\t2026-09-30 17:00\t\t2026-09-30 17:00',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id',
  '%R\t1\t12',
  '%E',
].join('\r\n');

describe('parseXer', () => {
  it('reads activities with actual dates where they exist and forecasts otherwise', () => {
    const { schedule, problems } = parseXer(XER);
    expect(problems).toEqual([]);
    expect(schedule.activities).toEqual([
      {
        id: 'C1000',
        name: 'Site survey',
        start: '2026-01-05',
        finish: '2026-02-20',
        startActual: true,
        finishActual: true,
      },
      {
        id: 'C1010',
        name: 'Drainage design',
        start: '2026-03-02',
        finish: '2026-07-31',
        startActual: true,
        finishActual: false,
      },
      {
        id: 'C1020',
        name: 'Stage 3 gate',
        start: '2026-09-30',
        finish: '2026-09-30',
        startActual: false,
        finishActual: false,
      },
    ]);
  });

  it('says so when the file is not an XER export', () => {
    expect(parseXer('hello').problems[0]).toMatch(/does not look like a Primavera P6 XER/);
  });
});

const MSP = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Demo</Name>
  <Tasks>
    <Task><UID>0</UID><ID>0</ID><Name>Demo</Name><Summary>1</Summary><Start>2026-01-05T08:00:00</Start><Finish>2026-09-30T17:00:00</Finish></Task>
    <Task><UID>1</UID><ID>1</ID><Name>Survey &amp; mapping</Name><Summary>0</Summary><Start>2026-01-05T08:00:00</Start><Finish>2026-02-13T17:00:00</Finish><ActualStart>2026-01-05T08:00:00</ActualStart><ActualFinish>2026-02-20T17:00:00</ActualFinish>
      <Baseline><Number>0</Number><Start>2025-12-01T08:00:00</Start><Finish>2026-01-30T17:00:00</Finish></Baseline>
    </Task>
    <Task><UID>2</UID><ID>2</ID><Name>Drainage design</Name><Summary>0</Summary><Start>2026-03-02T08:00:00</Start><Finish>2026-07-31T17:00:00</Finish>
      <PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type></PredecessorLink>
    </Task>
  </Tasks>
</Project>`;

describe('parseMsProjectXml', () => {
  it('reads tasks, skips summaries and ignores baseline dates', () => {
    const { schedule, problems } = parseMsProjectXml(MSP);
    expect(problems).toEqual([]);
    expect(schedule.activities).toEqual([
      {
        id: '1',
        name: 'Survey & mapping',
        start: '2026-01-05',
        finish: '2026-02-20',
        startActual: true,
        finishActual: true,
      },
      {
        id: '2',
        name: 'Drainage design',
        start: '2026-03-02',
        finish: '2026-07-31',
        startActual: false,
        finishActual: false,
      },
    ]);
  });

  it('says so when the file is not Microsoft Project XML', () => {
    expect(parseMsProjectXml('<html></html>').problems[0]).toMatch(/Microsoft Project XML/);
  });
});

describe('readScheduleSheets', () => {
  it('reads a Primavera P6 Excel export with its two header rows', () => {
    const { schedule, problems } = readScheduleSheets([
      { name: 'Notes', rows: [['Exported from P6']] },
      {
        name: 'TASK',
        rows: [
          ['task_code', 'task_name', 'start_date', 'end_date'],
          ['Activity ID', 'Activity Name', 'Start', 'Finish'],
          ['C1000', 'Site survey', '05-Jan-26 A', '20-Feb-26 A'],
          ['C1010', 'Drainage design', '02-Mar-26 A', new Date(Date.UTC(2026, 6, 31))],
        ],
      },
    ]);
    expect(problems).toEqual([]);
    expect(schedule.activities.map((a) => [a.id, a.finish, a.finishActual])).toEqual([
      ['C1000', '2026-02-20', true],
      ['C1010', '2026-07-31', false],
    ]);
  });

  it('finds the header row below a title', () => {
    const { schedule } = readScheduleSheets([
      {
        name: 'Programme',
        rows: [
          ['Master programme'],
          [],
          ['Activity ID', 'Activity Name', 'Finish'],
          ['A1', 'Design', '2027-01-29'],
        ],
      },
    ]);
    expect(schedule.activities).toEqual([
      { id: 'A1', name: 'Design', finish: '2027-01-29', startActual: false, finishActual: false },
    ]);
  });

  it('explains when no programme is found', () => {
    expect(readScheduleSheets([{ name: 'S', rows: [['x']] }]).problems[0]).toMatch(
      /^No programme found/,
    );
  });
});
