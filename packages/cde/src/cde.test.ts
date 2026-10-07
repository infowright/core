import { UK_NATIONAL_ANNEX } from '@infowright/iso19650';
import type { DeliveryPlan } from '@infowright/delivery-plan';
import { describe, expect, it } from 'vitest';
import { compareWithRegister } from './compare';
import { readRegisterSheets } from './read-register';

describe('readRegisterSheets', () => {
  it('reads an export with a title row, file extensions and long status names', () => {
    const { register, problems } = readRegisterSheets([
      {
        name: 'Export',
        rows: [
          ['Folder: WIP / Civils'],
          ['Name', 'Title', 'Version', 'Revision', 'Status', 'Last updated'],
          [
            'DMO-ACM-ZZ-ZZ-DR-C-0001.pdf',
            'Site layout',
            'V3',
            'p02',
            'S2 - Suitable for information',
            '2026-10-01 14:20',
          ],
          [
            'DMO-ACM-ZZ-ZZ-DR-C-0002.dwg',
            'Drainage',
            'V1',
            '',
            '',
            new Date(Date.UTC(2026, 8, 30)),
          ],
          ['', '', '', '', '', ''],
        ],
      },
    ]);
    expect(problems).toEqual([]);
    expect(register.entries).toEqual([
      {
        name: 'DMO-ACM-ZZ-ZZ-DR-C-0001',
        title: 'Site layout',
        revision: 'P02',
        status: 'S2',
        date: '2026-10-01',
      },
      { name: 'DMO-ACM-ZZ-ZZ-DR-C-0002', title: 'Drainage', date: '2026-09-30' },
    ]);
  });

  it('takes revision and status from file names when the export has no columns for them', () => {
    const { register } = readRegisterSheets(
      [
        {
          name: 'Export',
          rows: [
            ['Name', 'Last updated'],
            ['DMO-ACM-ZZ-ZZ-DR-C-0001-P02-S2.pdf', '2026-10-01'],
          ],
        },
      ],
      { standard: UK_NATIONAL_ANNEX },
    );
    expect(register.entries).toEqual([
      { name: 'DMO-ACM-ZZ-ZZ-DR-C-0001', revision: 'P02', status: 'S2', date: '2026-10-01' },
    ]);
  });

  it('explains when nothing could be read', () => {
    expect(readRegisterSheets([{ name: 'S', rows: [['hello']] }]).problems[0]).toMatch(
      /^No containers found/,
    );
  });
});

const plan: DeliveryPlan = {
  milestones: [{ id: 'g2', name: 'Gate 2', date: '2026-09-30' }],
  deliverables: [
    {
      id: 'a',
      containerName: 'DMO-ACM-ZZ-ZZ-DR-C-0001',
      title: 'Layout',
      taskTeam: 'ACM',
      issues: [{ milestoneId: 'g2', status: 'S2' }],
    },
    {
      id: 'b',
      containerName: 'DMO-ACM-ZZ-ZZ-DR-C-0002',
      title: 'Drainage',
      taskTeam: 'ACM',
      issues: [{ milestoneId: 'g2', status: 'A1', due: '2026-12-01' }],
    },
    {
      id: 'c',
      containerName: 'DMO-ACM-ZZ-ZZ-DR-C-0003',
      title: 'Sections',
      taskTeam: 'ACM',
      issues: [{ milestoneId: 'g2' }],
    },
    {
      id: 'd',
      title: 'Not numbered yet',
      taskTeam: 'ACM',
      issues: [{ milestoneId: 'g2', due: '2027-01-01' }],
    },
  ],
};

describe('compareWithRegister', () => {
  it('tells what is delivered, in progress, missing and overdue', () => {
    const { checks, unplanned } = compareWithRegister(
      plan,
      {
        entries: [
          { name: 'DMO-ACM-ZZ-ZZ-DR-C-0001', revision: 'P01.03', status: 'S0', date: '2026-09-01' },
          {
            name: 'DMO-ACM-ZZ-ZZ-DR-C-0001-P01',
            revision: 'P01',
            status: 'S2',
            date: '2026-09-20',
          },
          { name: 'DMO-ACM-ZZ-ZZ-DR-C-0002', revision: 'P02', status: 'S3', date: '2026-10-01' },
          { name: 'DMO-ACM-ZZ-ZZ-DR-C-0099', revision: 'P01', status: 'S2' },
        ],
      },
      { today: '2026-10-07' },
    );

    expect(checks.map((c) => [c.deliverableId, c.state, c.overdue, c.entry?.revision])).toEqual([
      ['a', 'delivered', false, 'P01'],
      ['b', 'in-progress', false, 'P02'],
      ['c', 'missing', true, undefined],
      ['d', 'missing', false, undefined],
    ]);
    expect(unplanned.map((e) => e.name)).toEqual(['DMO-ACM-ZZ-ZZ-DR-C-0099']);
  });

  it('flags a revision that does not fit its status', () => {
    const { checks } = compareWithRegister(
      plan,
      { entries: [{ name: 'DMO-ACM-ZZ-ZZ-DR-C-0001', revision: 'C01', status: 'S2' }] },
      { today: '2026-10-07' },
    );
    expect(checks[0]?.state).toBe('delivered');
    expect(checks[0]?.problems.length).toBeGreaterThan(0);
  });

  it('counts a container as delivered when the export has no status at all', () => {
    const { checks } = compareWithRegister(
      plan,
      { entries: [{ name: 'DMO-ACM-ZZ-ZZ-DR-C-0003' }] },
      { today: '2026-10-07' },
    );
    expect(checks.find((c) => c.deliverableId === 'c')?.state).toBe('delivered');
  });

  it('needs a newer issue for a later gate', () => {
    const twoGates: DeliveryPlan = {
      milestones: [
        { id: 'g2', name: 'Gate 2', date: '2026-09-30' },
        { id: 'g3', name: 'Gate 3', date: '2027-03-31' },
      ],
      deliverables: [
        {
          id: 'a',
          containerName: 'DMO-ACM-ZZ-ZZ-DR-C-0001',
          title: 'Layout',
          taskTeam: 'ACM',
          issues: [
            { milestoneId: 'g3', status: 'S2' },
            { milestoneId: 'g2', status: 'S2' },
          ],
        },
      ],
    };
    const states = (date: string) =>
      compareWithRegister(
        twoGates,
        { entries: [{ name: 'DMO-ACM-ZZ-ZZ-DR-C-0001', revision: 'P01', status: 'S2', date }] },
        { today: '2026-10-07' },
      ).checks.map((c) => [c.milestoneId, c.state]);

    expect(states('2026-09-20')).toEqual([
      ['g3', 'in-progress'],
      ['g2', 'delivered'],
    ]);
    expect(states('2026-10-05')).toEqual([
      ['g3', 'delivered'],
      ['g2', 'delivered'],
    ]);
  });
});
