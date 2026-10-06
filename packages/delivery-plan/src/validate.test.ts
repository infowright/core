import { UK_NA_NAMING_CONVENTION } from '@infowright/iso19650';
import { describe, expect, it } from 'vitest';
import type { DeliveryPlan } from './types';
import { isIsoDate, resolveDueDate, validateDeliveryPlan } from './validate';

function samplePlan(): DeliveryPlan {
  return {
    milestones: [
      { id: 'G2', name: 'Concept design', date: '2027-03-31' },
      { id: 'G3', name: 'Developed design', date: '2027-09-30' },
    ],
    deliverables: [
      {
        id: 'd1',
        title: 'Ground floor general arrangement',
        taskTeam: 'ACME',
        containerName: 'DEMO-ACME-ZZ-00-DR-A-0001',
        issues: [
          { milestoneId: 'G2', status: 'S3', loin: 'LOIN-ARC-G2' },
          { milestoneId: 'G3', status: 'A1', due: '2027-09-15', activityId: 'DES-1040' },
        ],
      },
      {
        id: 'd2',
        title: 'Structural calculations',
        taskTeam: 'BETA',
        predecessors: ['d1'],
        issues: [{ milestoneId: 'G3', status: 'S4' }],
      },
    ],
  };
}

describe('validateDeliveryPlan', () => {
  it('accepts a valid plan', () => {
    expect(validateDeliveryPlan(samplePlan())).toEqual([]);
  });

  it('accepts container names that match the naming convention', () => {
    expect(
      validateDeliveryPlan(samplePlan(), { namingConvention: UK_NA_NAMING_CONVENTION }),
    ).toEqual([]);
  });

  it('reports container names that break the naming convention', () => {
    const plan = samplePlan();
    plan.deliverables[0]!.containerName = 'DEMO-ACME-ZZ-00-DR-A-01';
    const problems = validateDeliveryPlan(plan, { namingConvention: UK_NA_NAMING_CONVENTION });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('expected 4 to 6');
  });

  it('rejects work in progress as a delivery target', () => {
    const plan = samplePlan();
    plan.deliverables[1]!.issues[0]!.status = 'S0';
    const problems = validateDeliveryPlan(plan);
    expect(problems[0]?.message).toContain('work in progress is never a delivery');
  });

  it('rejects unknown and withdrawn status codes', () => {
    const plan = samplePlan();
    plan.deliverables[0]!.issues[0]!.status = 'S9';
    plan.deliverables[1]!.issues[0]!.status = 'S5';
    const messages = validateDeliveryPlan(plan).map((p) => p.message);
    expect(messages[0]).toContain('unknown target status "S9"');
    expect(messages[1]).toContain('withdrawn status S5');
  });

  it('reports references to milestones that do not exist', () => {
    const plan = samplePlan();
    plan.deliverables[1]!.issues[0]!.milestoneId = 'G9';
    const problems = validateDeliveryPlan(plan);
    expect(problems).toEqual([
      {
        deliverableId: 'd2',
        milestoneId: 'G9',
        message: '"Structural calculations" is planned for unknown milestone "G9".',
      },
    ]);
  });

  it('reports a deliverable planned twice for the same milestone', () => {
    const plan = samplePlan();
    plan.deliverables[1]!.issues.push({ milestoneId: 'G3', status: 'A1' });
    expect(validateDeliveryPlan(plan)[0]?.message).toContain('more than once for milestone');
  });

  it('reports duplicate container names', () => {
    const plan = samplePlan();
    plan.deliverables[1]!.containerName = 'DEMO-ACME-ZZ-00-DR-A-0001';
    expect(validateDeliveryPlan(plan)[0]?.message).toContain('planned twice');
  });

  it('reports duplicate ids', () => {
    const plan = samplePlan();
    plan.deliverables[1]!.id = 'd1';
    plan.milestones[1]!.id = 'G2';
    const messages = validateDeliveryPlan(plan).map((p) => p.message);
    expect(messages).toContain('Milestone id "G2" is used more than once.');
    expect(messages).toContain('Deliverable id "d1" is used more than once.');
  });

  it('reports missing title, task team and planned deliveries', () => {
    const plan = samplePlan();
    plan.deliverables[1] = { id: 'd2', title: '', taskTeam: ' ', issues: [] };
    const messages = validateDeliveryPlan(plan).map((p) => p.message);
    expect(messages).toEqual([
      '"d2" has no title.',
      '"d2" has no task team.',
      '"d2" has no planned delivery at any milestone.',
    ]);
  });

  it('reports bad predecessors', () => {
    const plan = samplePlan();
    plan.deliverables[1]!.predecessors = ['d2', 'd7'];
    const messages = validateDeliveryPlan(plan).map((p) => p.message);
    expect(messages).toEqual([
      '"Structural calculations" lists itself as a predecessor.',
      '"Structural calculations" depends on unknown deliverable "d7".',
    ]);
  });

  it('reports invalid dates', () => {
    const plan = samplePlan();
    plan.milestones[0]!.date = '31/03/2027';
    plan.deliverables[0]!.issues[1]!.due = '2027-02-30';
    const messages = validateDeliveryPlan(plan).map((p) => p.message);
    expect(messages[0]).toContain('invalid date "31/03/2027"');
    expect(messages[1]).toContain('invalid due date "2027-02-30"');
  });
});

describe('resolveDueDate', () => {
  it('uses the issue date when set, otherwise the milestone date', () => {
    const plan = samplePlan();
    const [first, second] = plan.deliverables[0]!.issues;
    expect(resolveDueDate(first!, plan)).toBe('2027-03-31');
    expect(resolveDueDate(second!, plan)).toBe('2027-09-15');
  });

  it('returns undefined for an unknown milestone without its own date', () => {
    expect(resolveDueDate({ milestoneId: 'X', status: 'S2' }, samplePlan())).toBeUndefined();
  });
});

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2027-13-01')).toBe(false);
    expect(isIsoDate('2027-1-01')).toBe(false);
  });
});
