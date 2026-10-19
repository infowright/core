import { UK_NATIONAL_ANNEX } from '@infowright/iso19650';
import type { Schedule } from '@infowright/schedule';
import { describe, expect, it } from 'vitest';
import { applyActivityLinks, STRONG_LINK, suggestActivityLinks } from './suggest-links';
import type { DeliveryPlan } from './types';

const act = (id: string, name: string, finish: string) => ({
  id,
  name,
  finish,
  startActual: false,
  finishActual: false,
});

const schedule: Schedule = {
  activities: [
    act('A1020', 'Architecture stage 3 design', '2027-01-20'),
    act('A1030', 'Architecture stage 4 design', '2027-06-30'),
    act('S1020', 'Structural stage 3 design', '2027-01-25'),
    act('M1020', 'Building services stage 3 design', '2027-01-28'),
    act('X9000', 'Site set up', '2027-03-01'),
  ],
};

const plan: DeliveryPlan = {
  milestones: [
    { id: 's3', name: 'Stage 3 Spatial coordination', date: '2027-02-01' },
    { id: 's4', name: 'Stage 4 Technical design', date: '2027-07-01' },
  ],
  deliverables: [
    {
      id: 'arc1',
      containerName: 'DMO-ARC-ZZ-ZZ-DR-A-0001',
      title: 'General arrangement',
      taskTeam: 'ARC',
      issues: [{ milestoneId: 's3', activityId: 'A1020' }, { milestoneId: 's4' }],
    },
    {
      id: 'arc2',
      containerName: 'DMO-ARC-ZZ-ZZ-DR-A-0002',
      title: 'Sections',
      taskTeam: 'ARC',
      issues: [{ milestoneId: 's3' }],
    },
    {
      id: 'str1',
      containerName: 'DMO-STR-ZZ-ZZ-DR-S-0001',
      title: 'Foundation layout',
      taskTeam: 'STR',
      issues: [{ milestoneId: 's3' }],
    },
    {
      id: 'mep1',
      containerName: 'DMO-MEP-ZZ-ZZ-SP-M-0001',
      title: 'Ventilation specification',
      taskTeam: 'MEP',
      issues: [{ milestoneId: 's3' }],
    },
    {
      id: 'odd',
      containerName: 'DMO-CLT-ZZ-ZZ-CO-K-0001',
      title: 'Letter',
      taskTeam: 'CLT',
      issues: [{ milestoneId: 's3' }],
    },
  ],
};

const suggest = () => suggestActivityLinks(plan, schedule, { standard: UK_NATIONAL_ANNEX });
const best = (id: string, milestone: string) =>
  suggest().find((s) => s.deliverableId === id && s.milestoneId === milestone)?.candidates[0];

describe('suggestActivityLinks', () => {
  it('follows what the rest of the task team links to at the same milestone', () => {
    const c = best('arc2', 's3');
    expect(c?.activityId).toBe('A1020');
    expect(c?.score).toBeGreaterThanOrEqual(STRONG_LINK);
    expect(c?.reasons[0]).toMatch(/1 other deliverable of ARC/);
  });

  it('matches the stage and the discipline when nothing is linked yet', () => {
    expect(best('str1', 's3')?.activityId).toBe('S1020');
    expect(best('mep1', 's3')?.activityId).toBe('M1020');
    expect(best('arc1', 's4')?.activityId).toBe('A1030');
    expect(best('arc1', 's4')?.reasons).toContain('same stage 4');
  });

  it('leaves alone deliveries already linked, and suggests nothing when nothing fits', () => {
    expect(best('arc1', 's3')).toBeUndefined();
    expect(best('odd', 's3')?.activityId).not.toBe('X9000');
  });

  it('links the chosen activities and nothing else', () => {
    const next = applyActivityLinks(plan, [
      { deliverableId: 'str1', milestoneId: 's3', activityId: 'S1020' },
    ]);
    expect(next.deliverables.find((d) => d.id === 'str1')?.issues[0]?.activityId).toBe('S1020');
    expect(next.deliverables.find((d) => d.id === 'arc2')).toBe(plan.deliverables[1]);
  });
});
