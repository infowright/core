import { describe, expect, it } from 'vitest';
import { compareWithProgramme } from './programme';
import type { DeliveryPlan } from './types';

const plan: DeliveryPlan = {
  milestones: [{ id: 'g3', name: 'Gate 3', date: '2027-03-31' }],
  deliverables: [
    {
      id: 'a',
      title: 'On time',
      taskTeam: 'ACM',
      issues: [{ milestoneId: 'g3', activityId: 'C1' }],
    },
    {
      id: 'b',
      title: 'Late against its own date',
      taskTeam: 'ACM',
      issues: [{ milestoneId: 'g3', activityId: 'C2', due: '2027-02-01' }],
    },
    {
      id: 'c',
      title: 'Broken link',
      taskTeam: 'ACM',
      issues: [{ milestoneId: 'g3', activityId: 'X9' }],
    },
    { id: 'd', title: 'Not linked', taskTeam: 'ACM', issues: [{ milestoneId: 'g3' }] },
  ],
};

const schedule = {
  activities: [
    { id: 'C1', name: 'Design', finish: '2027-03-15', startActual: false, finishActual: false },
    { id: 'C2', name: 'Review', finish: '2027-02-11', startActual: true, finishActual: false },
  ],
};

describe('compareWithProgramme', () => {
  it('flags broken links and activities finishing after the due date', () => {
    expect(compareWithProgramme(plan, schedule)).toEqual([
      {
        deliverableId: 'a',
        milestoneId: 'g3',
        activityId: 'C1',
        result: 'ok',
        finish: '2027-03-15',
        finishActual: false,
        due: '2027-03-31',
      },
      {
        deliverableId: 'b',
        milestoneId: 'g3',
        activityId: 'C2',
        result: 'late',
        finish: '2027-02-11',
        finishActual: false,
        due: '2027-02-01',
        daysLate: 10,
      },
      { deliverableId: 'c', milestoneId: 'g3', activityId: 'X9', result: 'missing' },
    ]);
  });
});
