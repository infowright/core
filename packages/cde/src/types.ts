/** A list of information containers exported from a CDE, as it was at one moment. */
export interface Register {
  entries: RegisterEntry[];
}

/** One container (or one revision of it) as listed in the CDE. */
export interface RegisterEntry {
  /** Container name or file name, as listed. */
  name: string;
  title?: string;
  /** Revision code, e.g. P01, P01.02 or C01. */
  revision?: string;
  /** Status (suitability) code, e.g. S2 or A1. */
  status?: string;
  /** Last change, YYYY-MM-DD. */
  date?: string;
}
