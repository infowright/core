import { UK_NATIONAL_ANNEX } from '@infowright/iso19650';
import { describe, expect, it } from 'vitest';
import { splitFileName } from './file-name';

describe('splitFileName', () => {
  it('reads revision and status after the container name, in either order', () => {
    expect(splitFileName('DMO-ACM-ZZ-ZZ-DR-C-0001-P02-S2.pdf', UK_NATIONAL_ANNEX)).toEqual({
      name: 'DMO-ACM-ZZ-ZZ-DR-C-0001',
      revision: 'P02',
      status: 'S2',
    });
    expect(splitFileName('DMO-ACM-ZZ-ZZ-DR-C-0001_A1_C01.pdf', UK_NATIONAL_ANNEX)).toEqual({
      name: 'DMO-ACM-ZZ-ZZ-DR-C-0001',
      revision: 'C01',
      status: 'A1',
    });
    expect(splitFileName('DMO-ACM-ZZ-ZZ-M3-C-0001 P01.03.rvt', UK_NATIONAL_ANNEX)).toEqual({
      name: 'DMO-ACM-ZZ-ZZ-M3-C-0001',
      revision: 'P01.03',
    });
  });

  it('leaves plain container names alone', () => {
    expect(splitFileName('DMO-ACM-ZZ-ZZ-DR-C-0001.pdf', UK_NATIONAL_ANNEX)).toEqual({
      name: 'DMO-ACM-ZZ-ZZ-DR-C-0001',
    });
    expect(splitFileName('Meeting notes.docx', UK_NATIONAL_ANNEX)).toEqual({
      name: 'Meeting notes',
    });
  });
});
