import type { BoardGraph } from './board';
import { buildBoardGraph } from './board';
import type { GameState, Move, Resource } from './types';
import {
  TERRAIN_RESOURCE,
  DUST_DISCARD_THRESHOLD,
  totalResources,
  BUILDING_COST,
  MARKET_RATE_DEFAULT,
  MARKET_RATE_COMM,
} from './types';
import {
  routeAt,
  violatesDistanceRule,
  buildingAt,
  playerRouteEndpoints,
  canAfford,
  payCost,
} from './rules';
import { produce, produceOnSeven } from './production';
import { playerVP, recomputeLongestRoute } from './scoring';
import { WIN_VP } from './types';
import { techById, nextResearchable } from './tech';

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

function otherId(state: GameState, id: string): string {
  return state.players[0].id === id ? state.players[1].id : state.players[0].id;
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
  next.longestRouteHolderId = recomputeLongestRoute(g, next);
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
    case 'TRADE_MARKET':
      return handleTradeMarket(state, move, playerId);
    case 'TRADE_PLAYER':
      return handleTradePlayer(state, move, playerId);
    case 'END_TURN':
      return handleEndTurn(state, playerId);
    case 'RESEARCH':
      return handleResearch(state, move, playerId);
    case 'CLAIM_MISSION':
      return fail(state, 'Missions arrive in Plan 3.');
    default: {
      const _exhaustive: never = move;
      return fail(state, `Unhandled move: ${JSON.stringify(_exhaustive)}`);
    }
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
    next.stats[playerId].sevensRolled += 1;
    const pending: Record<string, number> = {};
    for (const p of next.players) {
      if (p.techs.includes('BIO2')) continue; // Storm Shelter: ignore discard
      const n = totalResources(p.resources);
      if (n > DUST_DISCARD_THRESHOLD) pending[p.id] = Math.floor(n / 2);
    }
    next.pendingDiscards = pending;
    // BIO3: each owner's buildings produce on the 7 (stacks with BIO2).
    for (const p of next.players) {
      const bonus = produceOnSeven(g, next, p.id);
      (Object.keys(bonus) as Resource[]).forEach((r) => (p.resources[r] += bonus[r]));
    }
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
  next.stats[playerId].dustDamageTaken += 1;
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
  next.stats[playerId].dustPlacements += 1;
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
    const domeCost = me.techs.includes('ENG2') ? { ORE: 1, ENG: 3 } : BUILDING_COST.DOME;
    if (!canAfford(me.resources, domeCost)) return fail(state, 'Cannot afford Dome.');
    const next = clone(state);
    next.players[idx].resources = payCost(me.resources, domeCost);
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
  const free = me.techs.includes('ENG3') && state.stats[playerId].routesThisTurn < 2;
  if (!free && !canAfford(me.resources, BUILDING_COST.ROUTE)) {
    return fail(state, 'Cannot afford Route.');
  }
  const next = clone(state);
  if (!free) next.players[idx].resources = payCost(me.resources, BUILDING_COST.ROUTE);
  next.routes.push({ edgeId: e, ownerId: playerId });
  next.stats[playerId].routesThisTurn += 1;
  next.longestRouteHolderId = recomputeLongestRoute(g, next);
  return { state: next };
}

function handleTradeMarket(
  state: GameState,
  move: Extract<Move, { type: 'TRADE_MARKET' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before trading.');
  if (move.give === move.receive) return fail(state, 'Cannot trade a resource for itself.');
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];
  const rate =
    me.hasCommTower || me.techs.includes('ASTRO3') ? MARKET_RATE_COMM : MARKET_RATE_DEFAULT;
  if (me.resources[move.give] < rate) return fail(state, `Need ${rate} ${move.give}.`);
  const next = clone(state);
  next.players[idx].resources[move.give] -= rate;
  next.players[idx].resources[move.receive] += 1;
  return { state: next };
}

function handleTradePlayer(
  state: GameState,
  move: Extract<Move, { type: 'TRADE_PLAYER' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before trading.');
  if (!move.accepted) return { state }; // declined offer: no-op
  const meIdx = playerIndex(state, playerId);
  const oppIdx = meIdx === 0 ? 1 : 0;
  const me = state.players[meIdx];
  const opp = state.players[oppIdx];
  for (const [r, amt] of Object.entries(move.offer) as [Resource, number][]) {
    if (me.resources[r] < amt) return fail(state, `You lack ${r}.`);
  }
  for (const [r, amt] of Object.entries(move.want) as [Resource, number][]) {
    if (opp.resources[r] < amt) return fail(state, `Opponent lacks ${r}.`);
  }
  const next = clone(state);
  for (const [r, amt] of Object.entries(move.offer) as [Resource, number][]) {
    next.players[meIdx].resources[r] -= amt;
    next.players[oppIdx].resources[r] += amt;
  }
  for (const [r, amt] of Object.entries(move.want) as [Resource, number][]) {
    next.players[oppIdx].resources[r] -= amt;
    next.players[meIdx].resources[r] += amt;
  }
  return { state: next };
}

function handleResearch(
  state: GameState,
  move: Extract<Move, { type: 'RESEARCH' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before researching.');
  const def = techById(move.techId);
  if (!def) return fail(state, 'Unknown tech.');
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];
  if (me.techs.includes(def.id)) return fail(state, 'Already researched.');
  const next = nextResearchable(me, def.track);
  if (!next || next.id !== def.id) return fail(state, 'Must research techs in order.');
  if (me.resources.RES < def.cost) return fail(state, `Need ${def.cost} RES.`);
  const nextState = clone(state);
  nextState.players[idx].resources.RES -= def.cost;
  nextState.players[idx].techs.push(def.id);
  return { state: nextState };
}

function handleEndTurn(state: GameState, playerId: string): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'You must roll before ending your turn.');
  const next = clone(state);
  next.activePlayerId = otherId(state, playerId);
  next.turn += 1;
  next.turnPhase = 'AWAIT_ROLL';
  next.lastRoll = null;
  next.stats[playerId].routesThisTurn = 0;
  // Win is checked at the START of a turn (spec §3.10).
  if (playerVP(next, next.activePlayerId) >= WIN_VP) {
    next.phase = 'gameover';
    next.winnerId = next.activePlayerId;
  }
  return { state: next };
}
