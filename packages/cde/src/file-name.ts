import { getStatusCode, parseRevision, type InformationStandard } from '@infowright/iso19650';

/** A file extension such as .pdf or .rvt at the end of a name. */
const EXTENSION = /\.[a-z0-9]{2,5}$/i;

/**
 * Reads a revision and status written into a file name after the container name, as many teams
 * do when the CDE has no fields for them: "DMO-ACM-ZZ-ZZ-DR-C-0001-P02-S2.pdf" gives the name
 * "DMO-ACM-ZZ-ZZ-DR-C-0001", revision P02 and status S2. Only the last two parts are looked at,
 * in either order. Anything else is left in the name.
 */
export function splitFileName(
  fileName: string,
  standard: InformationStandard,
): { name: string; revision?: string; status?: string } {
  let name = fileName.trim().replace(EXTENSION, '');
  let revision: string | undefined;
  let status: string | undefined;

  for (let i = 0; i < 2; i++) {
    const match = /^(.*\S)[-_ ]([A-Za-z0-9.]+)$/.exec(name);
    if (!match?.[1] || !match[2]) break;
    const part = match[2].toUpperCase();
    if (!status && getStatusCode(part, standard.statusCodes)) {
      status = part;
    } else if (!revision && parseRevision(part, standard.revisions)) {
      revision = part;
    } else {
      break;
    }
    name = match[1];
  }
  return { name, ...(revision ? { revision } : {}), ...(status ? { status } : {}) };
}
