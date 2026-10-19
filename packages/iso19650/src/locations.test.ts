import { describe, expect, it } from 'vitest';
import {
  formatChainage,
  inferLocations,
  locate,
  validateLocations,
  type LocationBreakdown,
} from './locations';
import { UK_NA_NAMING_CONVENTION } from './naming';

const conventions = [UK_NA_NAMING_CONVENTION];

const names = [
  'HS2-ARC-B1-01-DR-A-0001',
  'HS2-ARC-B1-02-DR-A-0002',
  'HS2-CIV-R1-S2-DR-C-0001',
  'HS2-CIV-R1-S1-DR-C-0002',
  'HS2-ARC-ZZ-ZZ-RP-A-0001',
];

describe('inferLocations', () => {
  it('reads facilities and their parts from the names, skipping ZZ', () => {
    expect(inferLocations(names, conventions)).toEqual({
      facilityField: 'volume',
      partField: 'level',
      facilities: [
        { code: 'B1', kind: 'building', parts: [{ code: '01' }, { code: '02' }] },
        { code: 'R1', kind: 'building', parts: [{ code: 'S1' }, { code: 'S2' }] },
      ],
    });
  });

  it('keeps kinds, names and chainages typed before', () => {
    const previous: LocationBreakdown = {
      facilityField: 'volume',
      partField: 'level',
      facilities: [
        {
          code: 'R1',
          name: 'Link road',
          kind: 'road',
          parts: [{ code: 'S1', from: 0, to: 1250 }],
        },
        { code: 'BR1', kind: 'bridge' },
      ],
    };
    const next = inferLocations(names, conventions, { previous });
    expect(next.facilities.map((f) => f.code)).toEqual(['B1', 'BR1', 'R1']);
    expect(next.facilities[2]).toEqual({
      code: 'R1',
      name: 'Link road',
      kind: 'road',
      parts: [{ code: 'S1', from: 0, to: 1250 }, { code: 'S2' }],
    });
  });
});

describe('locate', () => {
  const breakdown = inferLocations(names, conventions);
  it('finds the facility and part of a name', () => {
    const where = locate('HS2-CIV-R1-S2-DR-C-0001', breakdown, conventions);
    expect(where).toMatchObject({ facilityCode: 'R1', partCode: 'S2' });
    expect(where.facility?.code).toBe('R1');
    expect(where.part?.code).toBe('S2');
  });
  it('gives nothing for names that belong to no single place', () => {
    expect(locate('HS2-ARC-ZZ-ZZ-RP-A-0001', breakdown, conventions)).toEqual({});
  });
});

describe('validateLocations', () => {
  it('reports unknown fields, repeated codes and reversed chainage', () => {
    expect(
      validateLocations(
        {
          facilityField: 'zone',
          partField: 'level',
          facilities: [
            { code: 'R1', kind: 'road', parts: [{ code: 'S1', from: 500, to: 100 }] },
            { code: 'r1', kind: 'road' },
          ],
        },
        conventions,
      ),
    ).toEqual([
      'Locations: the facility code field is not in the naming convention.',
      'Locations: R1 S1 ends before it starts.',
      'Locations: facility R1 is listed twice.',
    ]);
  });
});

describe('formatChainage', () => {
  it('writes metres as km+m', () => {
    expect(formatChainage(0, 1250)).toBe('0+000 to 1+250');
    expect(formatChainage(12345)).toBe('from 12+345');
  });
});
