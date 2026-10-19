import { UK_NATIONAL_ANNEX } from '@infowright/iso19650';
import { describe, expect, it } from 'vitest';
import { fieldOf, planLocations, repeatForFacilities } from './locations';
import type { DeliveryPlan } from './types';

const plan: DeliveryPlan = {
  milestones: [{ id: 's3', name: 'Stage 3', date: '2027-02-01' }],
  deliverables: [
    {
      id: 'a',
      containerName: 'DC1-ARC-B1-ZZ-DR-A-0001',
      title: 'Hall layout',
      taskTeam: 'ARC',
      issues: [{ milestoneId: 's3', status: 'S2', activityId: 'ARC-B1-S3', due: '2027-01-15' }],
    },
    {
      id: 'b',
      containerName: 'DC1-ARC-B1-ZZ-DR-A-0002',
      title: 'Roof plan',
      taskTeam: 'ARC',
      issues: [{ milestoneId: 's3', activityId: 'ARC-GEN' }],
    },
    {
      id: 'c',
      containerName: 'DC1-ARC-B2-ZZ-DR-A-0001',
      title: 'Hall layout',
      taskTeam: 'ARC',
      issues: [{ milestoneId: 's3' }],
    },
    {
      id: 'd',
      containerName: 'DC1-ARC-ZZ-ZZ-RP-A-0001',
      title: 'Campus report',
      taskTeam: 'ARC',
      issues: [{ milestoneId: 's3' }],
    },
  ],
};

const schedule = {
  activities: ['ARC-B1-S3', 'ARC-B3-S3', 'ARC-GEN'].map((id) => ({
    id,
    name: id,
    startActual: false,
    finishActual: false,
  })),
};

describe('locations', () => {
  it('lists the facilities and parts used in the plan, ignoring ZZ', () => {
    expect(planLocations(plan, UK_NATIONAL_ANNEX).facilities.map((f) => f.code)).toEqual([
      'B1',
      'B2',
    ]);
    expect(fieldOf(plan.deliverables[0]!, 'volume', UK_NATIONAL_ANNEX)).toBe('B1');
  });

  it('repeats a building for others, renaming, linking the same activity and skipping what exists', () => {
    const result = repeatForFacilities(plan, {
      from: 'B1',
      to: ['B2', 'b3', 'B1'],
      standard: UK_NATIONAL_ANNEX,
      schedule,
      shiftDays: 14,
    });
    expect(result.added).toBe(3);
    expect(result.skipped).toEqual(['DC1-ARC-B2-ZZ-DR-A-0001']);
    const names = result.plan.deliverables.map((d) => d.containerName);
    expect(names.slice(4)).toEqual([
      'DC1-ARC-B2-ZZ-DR-A-0002',
      'DC1-ARC-B3-ZZ-DR-A-0001',
      'DC1-ARC-B3-ZZ-DR-A-0002',
    ]);
    const b3 = result.plan.deliverables.find((d) => d.containerName === 'DC1-ARC-B3-ZZ-DR-A-0001');
    expect(b3?.issues[0]).toEqual({
      milestoneId: 's3',
      status: 'S2',
      activityId: 'ARC-B3-S3',
      due: '2027-02-12',
    });
    // An activity whose ID names no building is shared by all of them and kept.
    expect(result.plan.deliverables[4]?.issues[0]?.activityId).toBe('ARC-GEN');
    expect(result).toMatchObject({ linked: 3, unlinked: 0 });
  });
});
