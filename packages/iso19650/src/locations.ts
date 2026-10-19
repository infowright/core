import { matchNamingConventions, type NamingConvention } from './naming';

/*
 * Where information belongs: the project's location breakdown, following the IFC spatial
 * structure. A project has sites; a site holds facilities (a building, a bridge, a road, a
 * railway, a tunnel); a facility has parts (storeys of a building, sections of a road or
 * railway, parts of a bridge). Linear facilities give their parts a chainage.
 *
 * Container names carry the codes: usually the facility in Volume/System and the part in
 * Level/Location, as the UK National Annex describes. Which fields hold them is set per project.
 */

export type FacilityKind =
  'building' | 'bridge' | 'road' | 'railway' | 'tunnel' | 'marine' | 'other';

export interface FacilityKindInfo {
  label: string;
  /** The IFC entity, IFC 4.3 for infrastructure. */
  ifc: string;
  part: { label: string; plural: string; ifc: string };
  /** Parts are measured along an alignment, with a chainage. */
  linear: boolean;
}

export const FACILITY_KINDS: Readonly<Record<FacilityKind, FacilityKindInfo>> = {
  building: {
    label: 'Building',
    ifc: 'IfcBuilding',
    part: { label: 'Storey', plural: 'storeys', ifc: 'IfcBuildingStorey' },
    linear: false,
  },
  bridge: {
    label: 'Bridge',
    ifc: 'IfcBridge',
    part: { label: 'Bridge part', plural: 'parts', ifc: 'IfcBridgePart' },
    linear: false,
  },
  road: {
    label: 'Road',
    ifc: 'IfcRoad',
    part: { label: 'Road section', plural: 'sections', ifc: 'IfcRoadPart' },
    linear: true,
  },
  railway: {
    label: 'Railway',
    ifc: 'IfcRailway',
    part: { label: 'Railway section', plural: 'sections', ifc: 'IfcRailwayPart' },
    linear: true,
  },
  tunnel: {
    label: 'Tunnel',
    ifc: 'IfcTunnel',
    part: { label: 'Tunnel part', plural: 'parts', ifc: 'IfcTunnelPart' },
    linear: true,
  },
  marine: {
    label: 'Marine facility',
    ifc: 'IfcMarineFacility',
    part: { label: 'Marine part', plural: 'parts', ifc: 'IfcMarinePart' },
    linear: false,
  },
  other: {
    label: 'Other facility',
    ifc: 'IfcFacility',
    part: { label: 'Facility part', plural: 'parts', ifc: 'IfcFacilityPart' },
    linear: false,
  },
};

export interface LocationPart {
  /** The code in container names, e.g. 01 for a storey or S1 for a road section. */
  code: string;
  name?: string;
  /** Chainage in metres, for parts of linear facilities. */
  from?: number;
  to?: number;
}

export interface Facility {
  code: string;
  name?: string;
  kind: FacilityKind;
  /** Code of the site it stands on, when the project has more than 1. */
  site?: string;
  parts?: LocationPart[];
}

export interface Site {
  code: string;
  name?: string;
}

export interface LocationBreakdown {
  /** The name field that holds the facility code, e.g. volume. */
  facilityField: string;
  /** The name field that holds the part code, e.g. level. Optional. */
  partField?: string;
  sites?: Site[];
  facilities: Facility[];
}

/** Codes that mean "not one particular place" in ISO 19650 names. 00 is a level (ground). */
export const NO_LOCATION = new Set(['ZZ', 'XX']);

/** "S1, km 0.000 to 1.250" style label for a chainage, in kilometres. */
export function formatChainage(from?: number, to?: number): string {
  const km = (m: number) => {
    const sign = m < 0 ? '-' : '';
    const abs = Math.abs(m);
    return `${sign}${Math.floor(abs / 1000)}+${String(Math.round(abs % 1000)).padStart(3, '0')}`;
  };
  if (from === undefined && to === undefined) return '';
  if (to === undefined) return `from ${km(from ?? 0)}`;
  if (from === undefined) return `to ${km(to)}`;
  return `${km(from)} to ${km(to)}`;
}

export interface Located {
  /** The codes as written in the name, upper case. Absent when the name has none. */
  facilityCode?: string;
  partCode?: string;
  facility?: Facility;
  part?: LocationPart;
}

/** Reads the facility and part of a container name. Codes not in the breakdown are still given. */
export function locate(
  name: string,
  breakdown: LocationBreakdown,
  conventions: readonly NamingConvention[],
): Located {
  const values = matchNamingConventions(name, conventions)?.result.values ?? {};
  const out: Located = {};
  const facilityCode = values[breakdown.facilityField]?.toUpperCase();
  if (facilityCode && !NO_LOCATION.has(facilityCode)) {
    out.facilityCode = facilityCode;
    const facility = breakdown.facilities.find((f) => f.code.toUpperCase() === facilityCode);
    if (facility) out.facility = facility;
  }
  const partCode = breakdown.partField ? values[breakdown.partField]?.toUpperCase() : undefined;
  if (partCode && !NO_LOCATION.has(partCode)) {
    out.partCode = partCode;
    const part = out.facility?.parts?.find((p) => p.code.toUpperCase() === partCode);
    if (part) out.part = part;
  }
  return out;
}

/**
 * A breakdown read from container names: every facility code found, with the part codes used
 * with it. Kinds, names and chainages are kept from `previous` where codes match, so filling in
 * again after a new import never loses what was typed.
 */
export function inferLocations(
  names: readonly string[],
  conventions: readonly NamingConvention[],
  options: { facilityField?: string; partField?: string; previous?: LocationBreakdown } = {},
): LocationBreakdown {
  const facilityField = options.facilityField ?? options.previous?.facilityField ?? 'volume';
  const partField = options.partField ?? options.previous?.partField ?? 'level';
  const found = new Map<string, Set<string>>();
  for (const name of names) {
    const values = matchNamingConventions(name, conventions)?.result.values ?? {};
    const f = values[facilityField]?.toUpperCase();
    if (!f || NO_LOCATION.has(f)) continue;
    const parts = found.get(f) ?? new Set<string>();
    const p = values[partField]?.toUpperCase();
    if (p && !NO_LOCATION.has(p)) parts.add(p);
    found.set(f, parts);
  }
  const byCode = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
  const previous = new Map(
    (options.previous?.facilities ?? []).map((f) => [f.code.toUpperCase(), f]),
  );
  const codes = [...new Set([...found.keys(), ...previous.keys()])].sort(byCode);
  return {
    facilityField,
    partField,
    ...(options.previous?.sites ? { sites: options.previous.sites } : {}),
    facilities: codes.map((code) => {
      const before = previous.get(code);
      const keptParts = new Map((before?.parts ?? []).map((p) => [p.code.toUpperCase(), p]));
      const partCodes = [...new Set([...(found.get(code) ?? []), ...keptParts.keys()])].sort(
        byCode,
      );
      const facility: Facility = {
        ...(before ?? { kind: 'building' as const }),
        code: before?.code ?? code,
      };
      if (partCodes.length > 0) {
        facility.parts = partCodes.map((p) => keptParts.get(p) ?? { code: p });
      } else {
        delete facility.parts;
      }
      return facility;
    }),
  };
}

/** Problems with a breakdown in plain words; empty when it is usable. */
export function validateLocations(
  breakdown: LocationBreakdown,
  conventions: readonly NamingConvention[],
): string[] {
  const problems: string[] = [];
  const fields = new Set(conventions.flatMap((c) => c.fields.map((f) => f.key)));
  if (!fields.has(breakdown.facilityField)) {
    problems.push('Locations: the facility code field is not in the naming convention.');
  }
  if (breakdown.partField && !fields.has(breakdown.partField)) {
    problems.push('Locations: the part code field is not in the naming convention.');
  }
  if (breakdown.partField && breakdown.partField === breakdown.facilityField) {
    problems.push('Locations: facilities and parts need different name fields.');
  }
  const seen = new Set<string>();
  for (const f of breakdown.facilities) {
    const code = f.code.trim().toUpperCase();
    if (!code) problems.push('Locations: every facility needs a code.');
    else if (seen.has(code)) problems.push(`Locations: facility ${code} is listed twice.`);
    seen.add(code);
    const parts = new Set<string>();
    for (const p of f.parts ?? []) {
      const pc = p.code.trim().toUpperCase();
      if (!pc) problems.push(`Locations: every part of ${code} needs a code.`);
      else if (parts.has(pc)) problems.push(`Locations: ${code} lists ${pc} twice.`);
      parts.add(pc);
      if (p.from !== undefined && p.to !== undefined && p.to < p.from) {
        problems.push(`Locations: ${code} ${pc} ends before it starts.`);
      }
    }
  }
  return problems;
}
