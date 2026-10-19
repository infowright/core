import { UK_NATIONAL_ANNEX } from '@infowright/iso19650';
import { describe, expect, it } from 'vitest';
import {
  checkResponsibilities,
  describeScope,
  inferResponsibilities,
  scopeOf,
} from './responsibility';
import type { DeliveryPlan } from './types';

const d = (name: string, team: string) => ({
  id: name,
  containerName: name,
  title: name,
  taskTeam: team,
  issues: [{ milestoneId: 's3' }],
});

const plan: DeliveryPlan = {
  milestones: [{ id: 's3', name: 'Stage 3' }],
  deliverables: [
    d('DMO-ARC-ZZ-ZZ-DR-A-0001', 'ARC'),
    d('DMO-ARC-ZZ-ZZ-M3-A-0002', 'ARC'),
    d('DMO-STR-ZZ-ZZ-DR-S-0001', 'STR'),
    d('DMO-ARC-ZZ-ZZ-DR-S-0009', 'ARC'),
    d('DMO-MEP-ZZ-ZZ-DR-M-0001', 'MEP'),
  ],
};

describe('responsibility matrix', () => {
  it('starts with 1 row per discipline and the teams that plan it', () => {
    expect(inferResponsibilities(plan, UK_NATIONAL_ANNEX)).toEqual([
      { id: 'role-A', role: 'A', duties: { ARC: 'R' } },
      { id: 'role-M', role: 'M', duties: { MEP: 'R' } },
      { id: 'role-S', role: 'S', duties: { ARC: 'R', STR: 'R' } },
    ]);
  });

  it('picks the most specific row for a deliverable', () => {
    const rows = [
      { id: 'a', role: 'A', duties: {} },
      { id: 'a-m3', role: 'A', type: 'M3', duties: {} },
    ];
    expect(scopeOf(plan.deliverables[1]!, rows, UK_NATIONAL_ANNEX)?.id).toBe('a-m3');
    expect(scopeOf(plan.deliverables[0]!, rows, UK_NATIONAL_ANNEX)?.id).toBe('a');
    expect(describeScope({ role: 'S', type: 'DR' })).toBe('Structural engineer, Drawing');
  });

  it('reports rows without 1 producer or an acceptor, wrong teams and producers with nothing planned', () => {
    const { problems, covered, uncovered } = checkResponsibilities(
      {
        ...plan,
        responsibilities: [
          { id: 'a', role: 'A', duties: { ARC: 'R', LEAD: 'A' } },
          { id: 's', role: 'S', duties: { STR: 'R', LEAD: 'A' } },
          { id: 'c', role: 'C', label: 'Civils', duties: { CIV: 'R', LEAD: 'A' } },
          { id: 'l', role: 'L', duties: { LEAD: 'A' } },
        ],
      },
      UK_NATIONAL_ANNEX,
    );
    expect(problems.map((p) => p.kind)).toEqual(['no-producer', 'wrong-team', 'nothing-planned']);
    expect(problems[1]?.message).toBe(
      'DMO-ARC-ZZ-ZZ-DR-S-0009 is planned by ARC, but STR produces Structural engineer.',
    );
    expect(problems[2]?.message).toBe('CIV produces Civils, but has nothing planned for it.');
    expect({ covered, uncovered }).toEqual({ covered: 4, uncovered: 1 });
  });
});
