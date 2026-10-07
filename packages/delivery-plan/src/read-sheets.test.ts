import { describe, expect, it } from 'vitest';
import { readDeliveryPlanSheets } from './read-sheets';
import { validateDeliveryPlan } from './validate';

describe('readDeliveryPlanSheets', () => {
  it('finds the header row below title rows and reads one deliverable per row', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Civils',
        rows: [
          ['Task Information Delivery Plan'],
          ['Project: Demo'],
          [],
          ['Document Number', 'Title', 'Originator', 'Suitability', 'Planned Issue Date'],
          [
            'DMO-ACM-ZZ-ZZ-DR-C-0001',
            'Site layout',
            'ACM',
            'S2 - Suitable for information',
            new Date(Date.UTC(2027, 2, 31)),
          ],
          ['DMO-ACM-ZZ-ZZ-DR-C-0002', 'Drainage layout', 'ACM', 'A1', '2027-04-30'],
        ],
      },
    ]);

    expect(result.problems).toEqual([]);
    expect(result.sheets[0]).toMatchObject({ name: 'Civils', headerRow: 4, deliverables: 2 });
    expect(result.plan.milestones).toEqual([{ id: 'delivery', name: 'Delivery' }]);
    expect(result.plan.deliverables[0]).toEqual({
      id: 'DMO-ACM-ZZ-ZZ-DR-C-0001',
      containerName: 'DMO-ACM-ZZ-ZZ-DR-C-0001',
      title: 'Site layout',
      taskTeam: 'ACM',
      issues: [{ milestoneId: 'delivery', status: 'S2', due: '2027-03-31' }],
    });
    expect(result.plan.deliverables[1]?.issues[0]?.due).toBe('2027-04-30');
  });

  it('turns a block of columns repeated per stage gate into one issue per gate', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Plan',
        rows: [
          [
            'Reference',
            'Description',
            'Task team',
            'Suitability 1',
            'Programme activity 1',
            'Suitability - 2',
            'Programme activity - 2',
            'Due date 2',
          ],
          [
            'DMO-ACM-ZZ-ZZ-M3-S-0001',
            'Structural model',
            'ACM',
            'S2',
            'A1000',
            'A1',
            '',
            '2028-01-15',
          ],
          ['DMO-ACM-ZZ-ZZ-M3-S-0002', 'Foundations model', 'ACM', '', 'A1010', '', '', ''],
        ],
      },
    ]);

    expect(result.plan.milestones.map((m) => m.name)).toEqual(['Gate 1', 'Gate 2']);
    expect(result.plan.deliverables[0]?.issues).toEqual([
      { milestoneId: 'gate-1', status: 'S2', activityId: 'A1000' },
      { milestoneId: 'gate-2', status: 'A1', due: '2028-01-15' },
    ]);
    expect(result.plan.deliverables[1]?.issues).toEqual([
      { milestoneId: 'gate-1', activityId: 'A1010' },
    ]);
    expect(result.sheets[0]?.columns.status).toEqual(['Suitability 1', 'Suitability - 2']);
  });

  it('reads a sheet with gate names above the columns and current-state columns at the end', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Area 1',
        rows: [
          ['Information delivery plan'],
          [null, null, null, 'GATE - 1', null, null, 'GATE - 2 (Concept Design)', null, null],
          [
            'Document Reference Number',
            'Combined Title',
            'Originator',
            'Suitability - 1',
            'Programme Activity Code - 1',
            'Delivery Milestones date - 1',
            'Suitability - 2',
            'Programme Activity Code - 2',
            'Delivery Milestones date - 2',
            'Suitability',
          ],
          [
            'DMO-ACM-ZZ-ZZ-RP-C-0001',
            'Basis of design',
            'ACM',
            'S2',
            'C1000',
            '',
            'S4',
            'C2000',
            new Date(Date.UTC(2027, 5, 30)),
            'S0',
          ],
        ],
      },
    ]);

    expect(result.plan.milestones.map((m) => m.name)).toEqual([
      'GATE - 1',
      'GATE - 2 (Concept Design)',
    ]);
    expect(result.plan.deliverables[0]).toEqual({
      id: 'DMO-ACM-ZZ-ZZ-RP-C-0001',
      containerName: 'DMO-ACM-ZZ-ZZ-RP-C-0001',
      title: 'Basis of design',
      taskTeam: 'ACM',
      issues: [
        { milestoneId: 'gate-1', status: 'S2', activityId: 'C1000' },
        {
          milestoneId: 'gate-2-concept-design',
          status: 'S4',
          activityId: 'C2000',
          due: '2027-06-30',
        },
      ],
    });
  });

  it('uses a milestone column when there is one', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Plan',
        rows: [
          ['Container name', 'Title', 'Milestone', 'Status'],
          ['DMO-ACM-ZZ-ZZ-RP-X-0001', 'Basis of design', 'Stage 3 gate', 'S4'],
          ['DMO-ACM-ZZ-ZZ-RP-X-0002', 'Design report', 'Stage 3 gate', 'S4'],
        ],
      },
    ]);
    expect(result.plan.milestones).toEqual([{ id: 'stage-3-gate', name: 'Stage 3 gate' }]);
    expect(result.plan.deliverables[1]?.issues[0]?.milestoneId).toBe('stage-3-gate');
  });

  it('puts back together a name split into one column per naming field', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Plan',
        rows: [
          ['Project', 'Originator', 'Volume', 'Level', 'Type', 'Role', 'Number', 'Title'],
          ['DMO', 'ACM', 'ZZ', '01', 'DR', 'A', '0101', 'Level 1 plan'],
          ['DMO', 'ACM', 'ZZ', '02', 'DR', 'A', '', 'Level 2 plan (number to follow)'],
        ],
      },
    ]);
    expect(result.sheets[0]?.composedName).toBe('UK National Annex');
    expect(result.plan.deliverables.map((d) => d.containerName)).toEqual([
      'DMO-ACM-ZZ-01-DR-A-0101',
      undefined,
    ]);
    // No task team column: taken from the originator part of the name.
    expect(result.plan.deliverables[0]?.taskTeam).toBe('ACM');
  });

  it('skips section headings and empty rows', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Plan',
        rows: [
          ['Document No.', 'Title', 'Originator'],
          ['', 'Area 1 - Civils', ''],
          [],
          ['------', '', ''],
          ['DMO-ACM-ZZ-ZZ-DR-C-0001', 'Site layout', 'ACM'],
        ],
      },
    ]);
    expect(result.plan.deliverables.map((d) => d.title)).toEqual(['Site layout']);
  });

  it('combines sheets, keeps duplicate names apart and reports what it could not read', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Area A',
        rows: [
          ['Document Number', 'Title', 'Planned issue date'],
          ['DMO-ACM-ZZ-ZZ-DR-C-0001', 'Site layout', 'next week'],
        ],
      },
      {
        name: 'Area B',
        rows: [
          ['Document Number', 'Title'],
          ['DMO-ACM-ZZ-ZZ-DR-C-0001', 'Site layout again'],
        ],
      },
      { name: 'Notes', rows: [['Read me first'], ['Some notes']] },
    ]);

    expect(result.plan.deliverables.map((d) => d.id)).toEqual([
      'DMO-ACM-ZZ-ZZ-DR-C-0001',
      'Area B!2',
    ]);
    expect(result.problems).toEqual([
      'Area A, row 2: "next week" is not a date that can be read.',
      'Sheet "Notes" was skipped: no header row with deliverable columns.',
    ]);
    const planned = validateDeliveryPlan(result.plan).map((p) => p.message);
    expect(planned.some((m) => m.includes('planned twice'))).toBe(true);
  });

  it('explains when nothing could be read', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Sheet1',
        rows: [
          ['a', 'b'],
          [1, 2],
        ],
      },
    ]);
    expect(result.plan.deliverables).toEqual([]);
    expect(result.problems[0]).toMatch(/^No deliverables found/);
  });

  it('produces a plan that passes validation when the sheet is clean', () => {
    const result = readDeliveryPlanSheets([
      {
        name: 'Plan',
        rows: [
          ['Document Number', 'Title', 'Originator'],
          ['DMO-ACM-ZZ-ZZ-DR-C-0001', 'Site layout', 'ACM'],
        ],
      },
    ]);
    expect(validateDeliveryPlan(result.plan)).toEqual([]);
  });
});
