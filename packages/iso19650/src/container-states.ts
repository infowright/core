/**
 * The four states an information container passes through in a
 * common data environment (CDE), as defined in ISO 19650-1.
 */
export const CONTAINER_STATES = ['wip', 'shared', 'published', 'archived'] as const;

export type ContainerState = (typeof CONTAINER_STATES)[number];

export const CONTAINER_STATE_LABELS: Readonly<Record<ContainerState, string>> = {
  wip: 'Work in progress',
  shared: 'Shared',
  published: 'Published',
  archived: 'Archived',
};

/** Returns true when `value` is one of the four ISO 19650 container states. */
export function isContainerState(value: unknown): value is ContainerState {
  return typeof value === 'string' && (CONTAINER_STATES as readonly string[]).includes(value);
}
