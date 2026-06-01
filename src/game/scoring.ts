import type { BoardGraph } from './board';
import type { GameState, Route } from './types';

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

// Longest contiguous chain (trail; no edge reused) of a player's routes.
export function longestRouteLength(g: BoardGraph, routes: Route[], playerId: string): number {
  const owned = routes.filter((r) => r.ownerId === playerId).map((r) => r.edgeId);
  if (owned.length === 0) return 0;
  const ownedSet = new Set(owned);

  const incident: Record<string, string[]> = {};
  for (const e of owned) {
    const [a, b] = g.edgeVertices[e];
    (incident[a] ??= []).push(e);
    (incident[b] ??= []).push(e);
  }

  let best = 0;
  const dfs = (vertex: string, used: Set<string>, len: number) => {
    if (len > best) best = len;
    for (const e of incident[vertex] ?? []) {
      if (used.has(e) || !ownedSet.has(e)) continue;
      const [a, b] = g.edgeVertices[e];
      const next = a === vertex ? b : a;
      used.add(e);
      dfs(next, used, len + 1);
      used.delete(e);
    }
  };

  for (const e of owned) {
    const [a, b] = g.edgeVertices[e];
    dfs(a, new Set(), 0);
    dfs(b, new Set(), 0);
  }
  return best;
}
