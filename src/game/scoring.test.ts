import { describe, it, expect } from 'vitest';
import { buildingVP } from './scoring';
import type { GameState } from './types';

function withBuildings(buildings: GameState['buildings']): GameState {
  return { buildings } as GameState;
}

describe('buildingVP', () => {
  it('scores Habitat 1, Dome 2, Comm Tower 1', () => {
    const s = withBuildings([
      { vertexId: 'v1', ownerId: 'p1', kind: 'HABITAT' },
      { vertexId: 'v2', ownerId: 'p1', kind: 'DOME' },
      { vertexId: 'v3', ownerId: 'p1', kind: 'COMM_TOWER' },
      { vertexId: 'v4', ownerId: 'p2', kind: 'DOME' },
    ]);
    expect(buildingVP(s, 'p1')).toBe(1 + 2 + 1);
    expect(buildingVP(s, 'p2')).toBe(2);
  });
});
