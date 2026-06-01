import type { BoardGraph } from './board';
import { buildBoardGraph } from './board';
import type { GameState, Move, Resource } from './types';
import { TERRAIN_RESOURCE, DUST_DISCARD_THRESHOLD, totalResources, BUILDING_COST } from './types';
import {
  routeAt,
  violatesDistanceRule,
  buildingAt,
  playerRouteEndpoints,
  canAfford,
  payCost,
} from './rules';
import { produce } from './production';

export interface ApplyResult {
  state: GameState;
  error?: string;
}

function fail(state: GameState, error: string): ApplyResult {
  return { state, error };
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function playerIndex(state: GameState, id: string): number {
  return state.players[0].id === id ? 0 : 1;
}

// What the setup phase expects next, derived from placement counts.
export function setupExpectation(
  state: GameState,
): { playerId: string; kind: 'HABITAT' | 'ROUTE' } | null {
  const p1 = state.players[0].id;
  const p2 = state.players[1].id;
  const b = state.buildings.length;
  const r = state.routes.length;
  if (state.phase === 'setup1') {
    if (b === 0 && r === 0) return { playerId: p1, kind: 'HABITAT' };
    if (b === 1 && r === 0) return { playerId: p1, kind: 'ROUTE' };
    if (b === 1 && r === 1) return { playerId: p2, kind: 'HABITAT' };
    if (b === 2 && r === 1) return { playerId: p2, kind: 'ROUTE' };
  }
  if (state.phase === 'setup2') {
    if (b === 2 && r === 2) return { playerId: p2, kind: 'HABITAT' };
    if (b === 3 && r === 2) return { playerId: p2, kind: 'ROUTE' };
    if (b === 3 && r === 3) return { playerId: p1, kind: 'HABITAT' };
    if (b === 4 && r === 3) return { playerId: p1, kind: 'ROUTE' };
  }
  return null;
}

// Grant 1 resource per adjacent producing hex of the given vertex.
function grantStartingResources(
  g: BoardGraph,
  state: GameState,
  playerId: string,
  vertexId: string,
): void {
  const player = state.players[playerIndex(state, playerId)];
  for (const hid of g.vertexHexes[vertexId]) {
    const hex = state.board.hexes.find((h) => h.id === hid);
    if (!hex) continue;
    const res = TERRAIN_RESOURCE[hex.terrain] as Resource | undefined;
    if (res) player.resources[res] += 1;
  }
}

function applySetup(g: BoardGraph, state: GameState, move: Move, playerId: string): ApplyResult {
  const exp = setupExpectation(state);
  if (!exp) return fail(state, 'Setup is complete.');
  if (playerId !== exp.playerId) return fail(state, `It is ${exp.playerId}'s setup turn.`);

  if (exp.kind === 'HABITAT') {
    if (move.type !== 'BUILD' || move.building !== 'HABITAT') {
      return fail(state, 'You must place a Habitat now.');
    }
    const v = move.locationId;
    if (!g.vertices.includes(v)) return fail(state, 'Unknown vertex.');
    if (violatesDistanceRule(g, state.buildings, v)) {
      return fail(state, 'Too close to another building.');
    }
    const next = clone(state);
    next.buildings.push({ vertexId: v, ownerId: playerId, kind: 'HABITAT' });
    if (state.phase === 'setup2') grantStartingResources(g, next, playerId, v);
    return advanceSetup(next);
  }

  // ROUTE
  if (move.type !== 'BUILD_ROUTE') return fail(state, 'You must place a Rover Route now.');
  const e = move.edgeId;
  if (!g.edges.includes(e)) return fail(state, 'Unknown edge.');
  if (routeAt(state.routes, e)) return fail(state, 'Edge already has a route.');
  const myBuildings = state.buildings.filter((b) => b.ownerId === playerId);
  const lastHab = myBuildings[myBuildings.length - 1];
  if (!g.edgeVertices[e].includes(lastHab.vertexId)) {
    return fail(state, 'Route must touch your new Habitat.');
  }
  const next = clone(state);
  next.routes.push({ edgeId: e, ownerId: playerId });
  return advanceSetup(next);
}

// After a setup placement, recompute phase / active player / transition to play.
function advanceSetup(state: GameState): ApplyResult {
  if (state.phase === 'setup1' && state.buildings.length === 2 && state.routes.length === 2) {
    state.phase = 'setup2';
  }
  if (state.phase === 'setup2' && state.buildings.length === 4 && state.routes.length === 4) {
    state.phase = 'play';
    state.turn = 1;
    state.activePlayerId = state.players[0].id;
    state.turnPhase = 'AWAIT_ROLL';
    return { state };
  }
  const exp = setupExpectation(state);
  if (exp) state.activePlayerId = exp.playerId;
  return { state };
}

export function applyMove(state: GameState, move: Move, playerId: string): ApplyResult {
  const g = buildBoardGraph();
  if (state.phase === 'setup1' || state.phase === 'setup2') {
    return applySetup(g, state, move, playerId);
  }
  if (state.phase === 'gameover') return fail(state, 'Game is over.');
  if (state.phase === 'lobby') return fail(state, 'Game has not started.');
  return applyPlay(g, state, move, playerId);
}

function applyPlay(g: BoardGraph, state: GameState, move: Move, playerId: string): ApplyResult {
  switch (move.type) {
    case 'ROLL':
      return handleRoll(g, state, move, playerId);
    case 'DISCARD':
      return handleDiscard(state, move, playerId);
    case 'MOVE_DUST_STORM':
      return handleMoveDustStorm(g, state, move, playerId);
    case 'BUILD':
      return handleBuild(g, state, move, playerId);
    case 'BUILD_ROUTE':
      return handleBuildRoute(g, state, move, playerId);
    default:
      return fail(state, `Move ${move.type} not handled yet.`);
  }
}

function handleRoll(
  g: BoardGraph,
  state: GameState,
  move: Extract<Move, { type: 'ROLL' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'AWAIT_ROLL') return fail(state, 'You have already rolled.');
  const [d1, d2] = move.roll;
  if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) return fail(state, 'Invalid dice.');
  const sum = d1 + d2;
  const next = clone(state);
  next.lastRoll = [d1, d2];

  if (sum === 7) {
    const pending: Record<string, number> = {};
    for (const p of next.players) {
      const n = totalResources(p.resources);
      if (n > DUST_DISCARD_THRESHOLD) pending[p.id] = Math.floor(n / 2);
    }
    next.pendingDiscards = pending;
    next.turnPhase = Object.keys(pending).length > 0 ? 'DISCARD' : 'MOVE_STORM';
    return { state: next };
  }

  const delta = produce(g, next, sum);
  for (const p of next.players) {
    const d = delta[p.id];
    (Object.keys(d) as Resource[]).forEach((r) => (p.resources[r] += d[r]));
  }
  next.turnPhase = 'ACTIONS';
  return { state: next };
}

function handleDiscard(
  state: GameState,
  move: Extract<Move, { type: 'DISCARD' }>,
  playerId: string,
): ApplyResult {
  if (state.turnPhase !== 'DISCARD') return fail(state, 'No discard required.');
  const owed = state.pendingDiscards[playerId];
  if (!owed) return fail(state, 'You owe no discard.');
  const cards = move.cards;
  const idx = playerIndex(state, playerId);
  const res = state.players[idx].resources;
  let total = 0;
  for (const [r, amt] of Object.entries(cards) as [Resource, number][]) {
    if (amt < 0) return fail(state, 'Negative discard.');
    if (res[r] < amt) return fail(state, `Not enough ${r} to discard.`);
    total += amt;
  }
  if (total !== owed) return fail(state, `You must discard exactly ${owed} cards.`);

  const next = clone(state);
  const nres = next.players[idx].resources;
  for (const [r, amt] of Object.entries(cards) as [Resource, number][]) nres[r] -= amt;
  delete next.pendingDiscards[playerId];
  if (Object.keys(next.pendingDiscards).length === 0) next.turnPhase = 'MOVE_STORM';
  return { state: next };
}

function handleMoveDustStorm(
  g: BoardGraph,
  state: GameState,
  move: Extract<Move, { type: 'MOVE_DUST_STORM' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'MOVE_STORM') return fail(state, 'Not time to move the Dust Storm.');
  if (!g.hexIds.includes(move.hexId)) return fail(state, 'Unknown hex.');
  if (move.hexId === state.dustStormHexId) return fail(state, 'Dust Storm cannot stay put.');
  const next = clone(state);
  next.dustStormHexId = move.hexId;
  next.turnPhase = 'ACTIONS';
  return { state: next };
}

function handleBuild(
  g: BoardGraph,
  state: GameState,
  move: Extract<Move, { type: 'BUILD' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before building.');
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];

  if (move.building === 'HABITAT') {
    const v = move.locationId;
    if (!g.vertices.includes(v)) return fail(state, 'Unknown vertex.');
    if (violatesDistanceRule(g, state.buildings, v)) return fail(state, 'Too close to a building.');
    const endpoints = playerRouteEndpoints(g, state.routes, playerId);
    if (!endpoints.has(v)) return fail(state, 'Habitat must sit on your Rover Route.');
    if (!canAfford(me.resources, BUILDING_COST.HABITAT)) return fail(state, 'Cannot afford Habitat.');
    const next = clone(state);
    next.players[idx].resources = payCost(me.resources, BUILDING_COST.HABITAT);
    next.buildings.push({ vertexId: v, ownerId: playerId, kind: 'HABITAT' });
    return { state: next };
  }

  if (move.building === 'DOME') {
    const existing = buildingAt(state.buildings, move.locationId);
    if (!existing || existing.ownerId !== playerId || existing.kind !== 'HABITAT') {
      return fail(state, 'Dome must upgrade your own Habitat.');
    }
    if (!canAfford(me.resources, BUILDING_COST.DOME)) return fail(state, 'Cannot afford Dome.');
    const next = clone(state);
    next.players[idx].resources = payCost(me.resources, BUILDING_COST.DOME);
    const b = buildingAt(next.buildings, move.locationId)!;
    b.kind = 'DOME';
    return { state: next };
  }

  // COMM_TOWER
  if (me.hasCommTower) return fail(state, 'You already own a Comm Tower.');
  const v = move.locationId;
  if (!g.vertices.includes(v)) return fail(state, 'Unknown vertex.');
  if (buildingAt(state.buildings, v)) return fail(state, 'Vertex is occupied.');
  const adjacentOwn = g.vertexNeighbors[v].filter((n) => {
    const b = buildingAt(state.buildings, n);
    return b && b.ownerId === playerId;
  }).length;
  if (adjacentOwn < 2) return fail(state, 'Comm Tower needs 2 adjacent friendly buildings.');
  if (!canAfford(me.resources, BUILDING_COST.COMM_TOWER)) {
    return fail(state, 'Cannot afford Comm Tower.');
  }
  const next = clone(state);
  next.players[idx].resources = payCost(me.resources, BUILDING_COST.COMM_TOWER);
  next.buildings.push({ vertexId: v, ownerId: playerId, kind: 'COMM_TOWER' });
  next.players[idx].hasCommTower = true;
  return { state: next };
}

function handleBuildRoute(
  g: BoardGraph,
  state: GameState,
  move: Extract<Move, { type: 'BUILD_ROUTE' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before building.');
  const e = move.edgeId;
  if (!g.edges.includes(e)) return fail(state, 'Unknown edge.');
  if (routeAt(state.routes, e)) return fail(state, 'Edge already has a route.');
  const [a, b] = g.edgeVertices[e];
  const eps = playerRouteEndpoints(g, state.routes, playerId);
  const touchesOwn =
    [a, b].some((v) => buildingAt(state.buildings, v)?.ownerId === playerId) ||
    eps.has(a) ||
    eps.has(b);
  if (!touchesOwn) return fail(state, 'Route must touch your network.');
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];
  if (!canAfford(me.resources, BUILDING_COST.ROUTE)) return fail(state, 'Cannot afford Route.');
  const next = clone(state);
  next.players[idx].resources = payCost(me.resources, BUILDING_COST.ROUTE);
  next.routes.push({ edgeId: e, ownerId: playerId });
  return { state: next };
}
