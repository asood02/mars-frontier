import type { GameState } from './types';

const BUILDING_VP: Record<string, number> = { HABITAT: 1, DOME: 2, COMM_TOWER: 1 };

export function buildingVP(state: GameState, playerId: string): number {
  return state.buildings
    .filter((b) => b.ownerId === playerId)
    .reduce((sum, b) => sum + (BUILDING_VP[b.kind] ?? 0), 0);
}

// Plan 2 total VP = buildings only. Plan 3 adds tech, missions, and longest route.
export function playerVP(state: GameState, playerId: string): number {
  return buildingVP(state, playerId);
}
