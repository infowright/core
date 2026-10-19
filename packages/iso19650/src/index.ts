export {
  CONTAINER_STATES,
  CONTAINER_STATE_LABELS,
  isContainerState,
  type ContainerState,
} from './container-states';

export {
  getStatusCode,
  isUsableStatusCode,
  UK_NA_STATUS_CODES,
  type RevisionType,
  type StatusCode,
  type StatusCodeDefinition,
} from './status-codes';

export {
  exampleRevision,
  parseRevision,
  UK_NA_REVISION_SCHEME,
  type Revision,
  type RevisionScheme,
} from './revision-codes';

export {
  describeConvention,
  inferConvention,
  matchNamingConventions,
  UK_NA_NAMING_CONVENTION,
  UK_NA_ROLE_CODES,
  UK_NA_TYPE_CODES,
  validateContainerName,
  validateNamingField,
  type NamingConvention,
  type NamingField,
  type NamingMatch,
  type NamingProblem,
  type NamingResult,
} from './naming';

export {
  checkName,
  checkRevisionForStatus,
  UK_NATIONAL_ANNEX,
  validateStandard,
  type InformationStandard,
} from './standard';
export {
  FACILITY_KINDS,
  formatChainage,
  inferLocations,
  locate,
  NO_LOCATION,
  validateLocations,
  type Facility,
  type FacilityKind,
  type FacilityKindInfo,
  type LocationBreakdown,
  type LocationPart,
  type Located,
  type Site,
} from './locations';
