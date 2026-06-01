import type { BoardGraph } from './board';
import { buildBoardGraph } from './board';
import type { Building, Route, Resource, GameState, Move } from './types';
import { RESOURCES, BUILDING_COST } from './types';

export function buildingAt(buildings: Building[], vertexId: string): Building | undefined {
  return buildings.find((b) => b.vertexId === vertexId);
}

export function routeAt(routes: Route[], edgeId: string): Route | undefined {
  return routes.find((r) => r.edgeId === edgeId);
}

// Set of vertices that are an endpoint of any of the player's routes.
export function playerRouteEndpoints(
  g: BoardGraph,
  routes: Route[],
  playerId: string,
): Set<string> {
  const set = new Set<string>();
  for (const r of routes) {
    if (r.ownerId !== playerId) continue;
    const [a, b] = g.edgeVertices[r.edgeId];
    set.add(a);
    set.add(b);
  }
  return set;
}

// True if any building (any owner) sits on the vertex or a graph-adjacent vertex.
export function violatesDistanceRule(
  g: BoardGraph,
  buildings: Building[],
  vertexId: string,
): boolean {
  if (buildingAt(buildings, vertexId)) return true;
  for (const n of g.vertexNeighbors[vertexId]) {
    if (buildingAt(buildings, n)) return true;
  }
  return false;
}

export function canAfford(
  resources: Record<Resource, number>,
  cost: Partial<Record<Resource, number>>,
): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(
    ([res, amt]) => resources[res] >= amt,
  );
}

// Returns a NEW record with the cost subtracted. Does not mutate the input.
export function payCost(
  resources: Record<Resource, number>,
  cost: Partial<Record<Resource, number>>,
): Record<Resource, number> {
  const out = { ...resources };
  for (const [res, amt] of Object.entries(cost) as [Resource, number][]) {
    out[res] -= amt;
  }
  return out;
}

// Enumerate the legal moves for a player in the current state. Mirrors the
// reducer's legality checks; used by the UI and by property tests.
export function legalMoves(state: GameState, playerId: string): Move[] {
  if (state.phase !== 'play') return [];
  if (playerId !== state.activePlayerId && state.turnPhase !== 'DISCARD') return [];
  const g = buildBoardGraph();
  const moves: Move[] = [];
  const me = state.players.find((p) => p.id === playerId)!;

  if (state.turnPhase === 'AWAIT_ROLL') {
    if (playerId === state.activePlayerId) moves.push({ type: 'ROLL', roll: [1, 1] });
    return moves;
  }

  if (state.turnPhase === 'DISCARD') {
    // Surface the obligation; the UI builds the concrete discard. Not enumerated.
    return moves;
  }

  if (state.turnPhase === 'MOVE_STORM') {
    if (playerId !== state.activePlayerId) return [];
    for (const h of g.hexIds) {
      if (h !== state.dustStormHexId) moves.push({ type: 'MOVE_DUST_STORM', hexId: h });
    }
    return moves;
  }

  // ACTIONS
  moves.push({ type: 'END_TURN' });

  // Routes
  for (const e of g.edges) {
    if (routeAt(state.routes, e)) continue;
    const [a, b] = g.edgeVertices[e];
    const eps = playerRouteEndpoints(g, state.routes, playerId);
    const touches =
      eps.has(a) ||
      eps.has(b) ||
      [a, b].some((v) => buildingAt(state.buildings, v)?.ownerId === playerId);
    if (touches && canAfford(me.resources, BUILDING_COST.ROUTE)) {
      moves.push({ type: 'BUILD_ROUTE', edgeId: e });
    }
  }

  // Habitats
  if (canAfford(me.resources, BUILDING_COST.HABITAT)) {
    const eps = playerRouteEndpoints(g, state.routes, playerId);
    for (const v of eps) {
      if (!violatesDistanceRule(g, state.buildings, v)) {
        moves.push({ type: 'BUILD', building: 'HABITAT', locationId: v });
      }
    }
  }

  // Domes (upgrade own habitats)
  if (canAfford(me.resources, BUILDING_COST.DOME)) {
    for (const bld of state.buildings) {
      if (bld.ownerId === playerId && bld.kind === 'HABITAT') {
        moves.push({ type: 'BUILD', building: 'DOME', locationId: bld.vertexId });
      }
    }
  }

  // Comm Tower
  if (!me.hasCommTower && canAfford(me.resources, BUILDING_COST.COMM_TOWER)) {
    for (const v of g.vertices) {
      if (buildingAt(state.buildings, v)) continue;
      const adj = g.vertexNeighbors[v].filter(
        (n) => buildingAt(state.buildings, n)?.ownerId === playerId,
      ).length;
      if (adj >= 2) moves.push({ type: 'BUILD', building: 'COMM_TOWER', locationId: v });
    }
  }

  // Market trades
  const rate = me.hasCommTower ? 2 : 3;
  for (const give of RESOURCES) {
    if (me.resources[give] < rate) continue;
    for (const receive of RESOURCES) {
      if (give !== receive) moves.push({ type: 'TRADE_MARKET', give, receive });
    }
  }

  return moves;
}
