import type { BoardGraph } from './board';
import type { GameState, Route } from './types';
import { missionById } from './missions';

export function buildingVP(state: GameState, playerId: string): number {
  const me = state.players?.find((p) => p.id === playerId);
  const fortified = me?.techs.includes('ENG4') ?? false; // ENG4: Domes worth 3
  return state.buildings
    .filter((b) => b.ownerId === playerId)
    .reduce((sum, b) => {
      if (b.kind === 'HABITAT') return sum + 1;
      if (b.kind === 'COMM_TOWER') return sum + 1;
      return sum + (fortified ? 3 : 2); // DOME
    }, 0);
}

export function techVP(state: GameState, playerId: string): number {
  const me = state.players?.find((p) => p.id === playerId);
  return Math.min(me?.techs.length ?? 0, 4); // max 4 counted (spec §3.7)
}

export function missionVP(state: GameState, playerId: string): number {
  const me = state.players?.find((p) => p.id === playerId);
  if (!me) return 0;
  return me.missions.reduce((sum, id) => sum + (missionById(id)?.vp ?? 0), 0);
}

// Total VP = buildings + longest route + tech + missions (spec §3.10).
export function playerVP(state: GameState, playerId: string): number {
  return (
    buildingVP(state, playerId) +
    longestRouteVP(state, playerId) +
    techVP(state, playerId) +
    missionVP(state, playerId)
  );
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

export const LONGEST_ROUTE_MIN = 5;
export const LONGEST_ROUTE_VP = 2;

// Recompute lengths and update the holder. The title only changes hands when a
// challenger is STRICTLY longer than the current holder (first keeps ties).
// Mutates player.longestRoute and returns the new holder id (or null).
export function recomputeLongestRoute(g: BoardGraph, state: GameState): string | null {
  const lengths: Record<string, number> = {};
  for (const p of state.players) {
    p.longestRoute = longestRouteLength(g, state.routes, p.id);
    lengths[p.id] = p.longestRoute;
  }
  const current = state.longestRouteHolderId;
  const eligible = state.players.filter((p) => lengths[p.id] >= LONGEST_ROUTE_MIN);
  if (eligible.length === 0) return null;
  if (current && lengths[current] >= LONGEST_ROUTE_MIN) {
    const challenger = state.players.find(
      (p) => p.id !== current && lengths[p.id] > lengths[current],
    );
    return challenger ? challenger.id : current;
  }
  let holder = eligible[0];
  for (const p of eligible) if (lengths[p.id] > lengths[holder.id]) holder = p;
  return holder.id;
}

export function longestRouteVP(state: GameState, playerId: string): number {
  return state.longestRouteHolderId === playerId ? LONGEST_ROUTE_VP : 0;
}
