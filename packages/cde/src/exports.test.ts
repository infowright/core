import { parseCsv } from '@infowright/common';
import { UK_NATIONAL_ANNEX } from '@infowright/iso19650';
import { describe, expect, it } from 'vitest';
import { readRegisterSheets, statusFromCell } from './read-register';

/*
 * The container lists each common CDE exports, as described in their own help, laid out the way
 * they arrive: title rows above the header, extra columns, their own date and status formats.
 */

const NAME = 'DMO-ACM-ZZ-ZZ-DR-C-0001';
const NAME2 = 'DMO-ACM-ZZ-ZZ-M3-C-0002';
const standard = UK_NATIONAL_ANNEX;
const read = (sheets: Parameters<typeof readRegisterSheets>[0]) =>
  readRegisterSheets(sheets, { standard });

describe('container lists from common CDEs', () => {
  it('Autodesk Docs files log (.xlsx, with a Folders sheet and custom attributes)', () => {
    const result = read([
      {
        name: 'Files',
        rows: [
          ['Files log'],
          ['Project: Demo'],
          [],
          [
            'Folder Name and Path',
            'Name',
            'Software version',
            'Model type',
            'Revision',
            'Description',
            'Version number',
            'Published to',
            'Markup',
            'Size',
            'Shared',
            'Last Updated',
            'Updated By',
            'Review Status',
            'Status Code',
          ],
          [
            'Project Files/WIP',
            `${NAME}.pdf`,
            '',
            '',
            'P02',
            'General arrangement',
            'V3',
            '',
            0,
            '1.2 MB',
            'No',
            'Oct 15, 2026 3:24 PM',
            'A Person',
            'Approved',
            'S2 - Suitable for information',
          ],
          [
            'Project Files/Shared',
            `${NAME2}.rvt`,
            '2026',
            'Revit',
            'P01',
            'Model',
            'V1',
            '',
            0,
            '80 MB',
            'Yes',
            new Date(Date.UTC(2026, 9, 2)),
            'A Person',
            '',
            'S1',
          ],
        ],
      },
      {
        name: 'Folders',
        rows: [
          ['Name', 'Last Updated'],
          ['WIP', 'Oct 1, 2026'],
        ],
      },
    ]);
    expect(result.problems).toEqual([]);
    expect(result.register.entries).toEqual([
      {
        name: NAME,
        title: 'General arrangement',
        revision: 'P02',
        status: 'S2',
        date: '2026-10-15',
      },
      { name: NAME2, title: 'Model', revision: 'P01', status: 'S1', date: '2026-10-02' },
    ]);
    expect(result.sheets[0]).toMatchObject({
      headerRow: 4,
      containers: 2,
      columns: {
        name: 'Name',
        title: 'Description',
        revision: 'Revision',
        status: 'Status Code',
        date: 'Last Updated',
      },
    });
  });

  it('Aconex document register (Document No, UK dates, status with words)', () => {
    const result = read([
      {
        name: 'Documents',
        rows: [
          ['Document Register'],
          ['Document No', 'Revision', 'Title', 'Type', 'Status', 'Date Modified'],
          [NAME, 'C01', 'Layout', 'Drawing', 'A1 - Accepted', '15/10/2026'],
          [NAME2, 'P03', 'Model', 'Model', 'Shared (S2)', '03/10/2026'],
        ],
      },
    ]);
    expect(result.problems).toEqual([]);
    expect(result.register.entries).toEqual([
      { name: NAME, title: 'Layout', revision: 'C01', status: 'A1', date: '2026-10-15' },
      { name: NAME2, title: 'Model', revision: 'P03', status: 'S2', date: '2026-10-03' },
    ]);
  });

  it('Viewpoint For Projects report (CSV with semicolons and times)', () => {
    const csv = [
      'Report;Items',
      'Name;Description;Revision;Status;Modified',
      `${NAME}.pdf;Layout;P02;S3;15/10/2026 14:22`,
      `${NAME2}.ifc;"Model; federated";P01;S1;02/10/2026 09:00`,
    ].join('\r\n');
    const result = read([{ name: 'export.csv', rows: parseCsv(csv) }]);
    expect(result.problems).toEqual([]);
    expect(result.register.entries.map((e) => [e.name, e.title, e.status, e.date])).toEqual([
      [NAME, 'Layout', 'S3', '2026-10-15'],
      [NAME2, 'Model; federated', 'S1', '2026-10-02'],
    ]);
  });

  it('Asite document register (Doc Ref and Rev)', () => {
    const result = read([
      {
        name: 'Register',
        rows: [
          ['Doc Ref', 'Rev', 'Title', 'Status', 'Upload Date'],
          [NAME, 'P02', 'Layout', 'S2', '15-Oct-2026'],
        ],
      },
    ]);
    expect(result.register.entries).toEqual([
      { name: NAME, title: 'Layout', revision: 'P02', status: 'S2', date: '2026-10-15' },
    ]);
  });

  it('Trimble Connect file list (no revision column: read from the file name)', () => {
    const result = read([
      {
        name: 'Files',
        rows: [
          [
            'File ID',
            'File Version ID',
            'File name',
            'File location',
            'Size',
            'Tags',
            'Created by user',
            'Creation date',
            'Last modified by user',
            'Last modified date',
          ],
          [
            'abc',
            'def',
            `${NAME}-P02-S2.pdf`,
            '/Shared',
            1000,
            '',
            'A',
            '2026-10-01T08:00:00.000Z',
            'A',
            '2026-10-15T12:22:05.000Z',
          ],
        ],
      },
    ]);
    expect(result.problems).toEqual([]);
    expect(result.register.entries).toEqual([
      { name: NAME, revision: 'P02', status: 'S2', date: '2026-10-15' },
    ]);
    expect(result.sheets[0]?.columns.date).toBe('Last modified date');
  });

  it('SharePoint library (US dates, Suitability column)', () => {
    const csv = [
      'Name,Modified,Modified By,Suitability,Revision',
      `${NAME}.pdf,10/15/2026 3:24 PM,A Person,S2,P02`,
      `${NAME2}.pdf,10/2/2026 9:00 AM,A Person,S1,P01`,
    ].join('\n');
    const result = read([{ name: 'query.csv', rows: parseCsv(csv) }]);
    expect(result.register.entries.map((e) => e.date)).toEqual(['2026-10-15', '2026-10-02']);
  });

  it('Procore document management (Number over the file name)', () => {
    const result = read([
      {
        name: 'documents.csv',
        rows: [
          ['Name', 'Number', 'Revision', 'Status', 'Title', 'Last Modified'],
          ['layout final.pdf', NAME, 'C01', 'A1', 'Layout', '2026-10-15'],
        ],
      },
    ]);
    expect(result.register.entries).toEqual([
      { name: NAME, title: 'Layout', revision: 'C01', status: 'A1', date: '2026-10-15' },
    ]);
  });

  it('ProjectWise list pasted from the clipboard (tab separated)', () => {
    const text = [
      'Name\tDescription\tDocument Number\tRevision\tSuitability\tUpdated',
      `${NAME}\tLayout\t${NAME}\tP02\tS2\t15/10/2026 10:00`,
    ].join('\n');
    const result = read([{ name: 'Pasted', rows: parseCsv(text) }]);
    expect(result.register.entries).toEqual([
      { name: NAME, title: 'Layout', revision: 'P02', status: 'S2', date: '2026-10-15' },
    ]);
  });

  it('says how many dates and statuses could not be read', () => {
    const result = read([
      {
        name: 'S',
        rows: [
          ['Name', 'Status', 'Updated'],
          [NAME, 'For information', 'yesterday'],
        ],
      },
    ]);
    expect(result.problems).toEqual([
      '1 date in the Updated column could not be read, e.g. "yesterday". Those containers have no date.',
      '1 status in the Status column holds no status code such as S2. The code at the end of the name is used where there is one.',
    ]);
  });
});

describe('statusFromCell', () => {
  it('picks the code out of longer text', () => {
    const codes = standard.statusCodes.map((c) => c.code);
    expect(statusFromCell('S2 - Suitable for information', codes)).toBe('S2');
    expect(statusFromCell('Shared (S3)', codes)).toBe('S3');
    expect(statusFromCell('a1', codes)).toBe('A1');
    expect(statusFromCell('For information', codes)).toBeUndefined();
    expect(statusFromCell('X9 whatever')).toBe('X9');
  });
});
