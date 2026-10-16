/**
 * Splits CSV text into rows of cells. Handles quoted cells with commas, line breaks and
 * doubled quotes. The delimiter (comma, semicolon or tab) is the one the first lines use
 * most, since European exports often use semicolons and pasted lists use tabs. A title line
 * above the header does not decide it.
 */
export function parseCsv(text: string): string[][] {
  const content = text.replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/, 20);
  const most = (ch: string) => Math.max(0, ...lines.map((l) => l.split(ch).length - 1));
  const delimiter = ['\t', ';', ','].reduce((best, ch) => (most(ch) > most(best) ? ch : best), ',');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (quoted) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
