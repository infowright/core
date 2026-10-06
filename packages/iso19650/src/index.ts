export {
  CONTAINER_STATES,
  CONTAINER_STATE_LABELS,
  isContainerState,
  type ContainerState,
} from './container-states';

export {
  getStatusCode,
  isUsableStatusCode,
  UK_NA_FIXED_STATUS_CODES,
  type RevisionType,
  type StatusCode,
} from './status-codes';

export { checkRevisionForStatus, parseRevision, type Revision } from './revision-codes';

export {
  describeConvention,
  UK_NA_NAMING_CONVENTION,
  UK_NA_ROLE_CODES,
  UK_NA_TYPE_CODES,
  validateContainerName,
  type NamingConvention,
  type NamingField,
  type NamingProblem,
  type NamingResult,
} from './naming';
