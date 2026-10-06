import { describe, expect, it } from 'vitest';
import { CONTAINER_STATE_LABELS, CONTAINER_STATES, isContainerState } from './container-states';

describe('container states', () => {
  it('lists the four ISO 19650 states in lifecycle order', () => {
    expect(CONTAINER_STATES).toEqual(['wip', 'shared', 'published', 'archived']);
  });

  it('has a readable label for every state', () => {
    for (const state of CONTAINER_STATES) {
      expect(CONTAINER_STATE_LABELS[state]).toBeTruthy();
    }
    expect(CONTAINER_STATE_LABELS.wip).toBe('Work in progress');
  });

  it('recognises valid states', () => {
    expect(isContainerState('shared')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isContainerState('Shared')).toBe(false);
    expect(isContainerState('approved')).toBe(false);
    expect(isContainerState(undefined)).toBe(false);
    expect(isContainerState(2)).toBe(false);
  });
});
