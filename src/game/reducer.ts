import type { BoardGraph } from './board';
import { buildBoardGraph } from './board';
import type { GameState, Move, Resource } from './types';
import { TERRAIN_RESOURCE } from './types';
import { routeAt, violatesDistanceRule } from './rules';

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
  // play-phase handlers are added in later tasks
  return fail(state, `Move ${move.type} not handled yet.`);
}
