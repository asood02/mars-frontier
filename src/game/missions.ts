// Mission card IDs (spec §3.8). Full definitions (conditions + rewards) are
// implemented in Plan 2; Plan 1 only needs stable ids to build a valid deck.
export const MISSION_IDS: readonly string[] = [
  'pioneer', // First to build 3 Habitats — 2 VP
  'ice-baron', // Control 3 Ice-adjacent buildings — 2 VP
  'engineer', // Own Comm Tower — 1 VP + 2 ENG
  'cartographer', // Routes touching all 4 terrains — 2 VP
  'geologist', // Own a building in all 4 producing terrains — 3 VP
  'long-haul', // Build 4 Route segments in one turn — 1 VP + 2 ENG
  'researcher', // Own 2 Tech Cards — 2 VP
  'industrialist', // Have 2 Domes — 2 VP
  'dustkeeper', // Place Dust Storm 3 times — 1 VP
  'stockpile', // Hold 10 resources at end of your turn — 1 VP
  'alchemist', // Trade with opponent 3 times — 1 VP + 1 RES
  'sprinter', // Win Longest Route (>=5 segments) — 2 VP
  'diversified', // Own 1 of each building type — 3 VP
  'astronomer', // Roll three 7s during the game — 1 VP
  'solar-mogul', // Control 3 Crater-adjacent buildings — 2 VP
  'networker', // Build 2nd Route extension to opponent's edge — 1 VP
  'survivor', // Take Dust Storm damage 3 times — 1 VP
  'first-light', // First to research T1 of any track — 1 VP
];

import type { GameState, PlayerState, Resource, Terrain } from './types';
import type { BoardGraph } from './board';
import { buildBoardGraph, boardConfigForPlayers } from './board';

export interface MissionCtx {
  state: GameState;
  g: BoardGraph;
  player: PlayerState;
  playerId: string;
}

export interface MissionDef {
  id: string;
  vp: number;
  desc: string;
  bonus?: Partial<Record<Resource, number>>;
  condition: (ctx: MissionCtx) => boolean;
}

// --- predicate helpers -------------------------------------------------------

function myBuildings(ctx: MissionCtx) {
  return ctx.state.buildings.filter((b) => b.ownerId === ctx.playerId);
}

function terrainsAround(ctx: MissionCtx, vertexId: string): Set<Terrain> {
  const out = new Set<Terrain>();
  for (const hid of ctx.g.vertexHexes[vertexId]) {
    const hex = ctx.state.board.hexes.find((h) => h.id === hid);
    if (hex) out.add(hex.terrain);
  }
  return out;
}

function buildingsAdjacentToTerrain(ctx: MissionCtx, terrain: Terrain): number {
  return myBuildings(ctx).filter((b) => terrainsAround(ctx, b.vertexId).has(terrain)).length;
}

const PRODUCING: Terrain[] = ['PLAIN', 'RIDGE', 'CRATER', 'ICE'];

function routeTerrains(ctx: MissionCtx): Set<Terrain> {
  const out = new Set<Terrain>();
  for (const r of ctx.state.routes) {
    if (r.ownerId !== ctx.playerId) continue;
    for (const v of ctx.g.edgeVertices[r.edgeId]) {
      for (const t of terrainsAround(ctx, v)) out.add(t);
    }
  }
  return out;
}

function ownsKinds(ctx: MissionCtx) {
  return new Set(myBuildings(ctx).map((b) => b.kind));
}

function touchesOpponent(ctx: MissionCtx): boolean {
  // Any other player counts as an opponent (2–4 players).
  const isOpp = (ownerId: string) => ownerId !== ctx.playerId;
  const oppVerts = new Set<string>();
  for (const b of ctx.state.buildings) if (isOpp(b.ownerId)) oppVerts.add(b.vertexId);
  for (const r of ctx.state.routes) {
    if (!isOpp(r.ownerId)) continue;
    for (const v of ctx.g.edgeVertices[r.edgeId]) oppVerts.add(v);
  }
  for (const r of ctx.state.routes) {
    if (r.ownerId !== ctx.playerId) continue;
    for (const v of ctx.g.edgeVertices[r.edgeId]) if (oppVerts.has(v)) return true;
  }
  return false;
}

function totalRes(p: PlayerState): number {
  return (Object.values(p.resources) as number[]).reduce((a, b) => a + b, 0);
}

// --- the 18 missions (spec §3.8) --------------------------------------------

export const MISSIONS: MissionDef[] = [
  {
    id: 'pioneer',
    vp: 2,
    desc: 'Build 3 Habitats',
    condition: (c) =>
      myBuildings(c).filter((b) => b.kind === 'HABITAT' || b.kind === 'DOME').length >= 3,
  },
  {
    id: 'ice-baron',
    vp: 2,
    desc: '3 buildings beside Ice',
    condition: (c) => buildingsAdjacentToTerrain(c, 'ICE') >= 3,
  },
  {
    id: 'engineer',
    vp: 1,
    desc: 'Own a Comm Tower',
    bonus: { ENG: 2 },
    condition: (c) => c.player.hasCommTower,
  },
  {
    id: 'cartographer',
    vp: 2,
    desc: 'Routes touching all 4 terrains',
    condition: (c) => {
      const t = routeTerrains(c);
      return PRODUCING.every((x) => t.has(x));
    },
  },
  {
    id: 'geologist',
    vp: 3,
    desc: 'A building beside all 4 terrains',
    condition: (c) => PRODUCING.every((t) => buildingsAdjacentToTerrain(c, t) >= 1),
  },
  {
    id: 'long-haul',
    vp: 1,
    desc: 'Build 4 routes in one turn',
    bonus: { ENG: 2 },
    condition: (c) => c.state.stats[c.playerId].routesThisTurn >= 4,
  },
  { id: 'researcher', vp: 2, desc: 'Own 2 Tech cards', condition: (c) => c.player.techs.length >= 2 },
  {
    id: 'industrialist',
    vp: 2,
    desc: 'Own 2 Domes',
    condition: (c) => myBuildings(c).filter((b) => b.kind === 'DOME').length >= 2,
  },
  {
    id: 'dustkeeper',
    vp: 1,
    desc: 'Move the Dust Storm 3 times',
    condition: (c) => c.state.stats[c.playerId].dustPlacements >= 3,
  },
  { id: 'stockpile', vp: 1, desc: 'Hold 10 resources', condition: (c) => totalRes(c.player) >= 10 },
  {
    id: 'alchemist',
    vp: 1,
    desc: 'Trade with opponent 3 times',
    bonus: { RES: 1 },
    condition: (c) => c.state.stats[c.playerId].tradesWithOpponent >= 3,
  },
  {
    id: 'sprinter',
    vp: 2,
    desc: 'Hold the Longest Route (5+)',
    condition: (c) => c.player.longestRoute >= 5 && c.state.longestRouteHolderId === c.playerId,
  },
  {
    id: 'diversified',
    vp: 3,
    desc: 'Own all 3 building types',
    condition: (c) => {
      const k = ownsKinds(c);
      return k.has('HABITAT') && k.has('DOME') && k.has('COMM_TOWER');
    },
  },
  {
    id: 'astronomer',
    vp: 1,
    desc: 'Roll three 7s',
    condition: (c) => c.state.stats[c.playerId].sevensRolled >= 3,
  },
  {
    id: 'solar-mogul',
    vp: 2,
    desc: '3 buildings beside Craters',
    condition: (c) => buildingsAdjacentToTerrain(c, 'CRATER') >= 3,
  },
  {
    id: 'networker',
    vp: 1,
    desc: 'A route touching your opponent',
    condition: (c) => touchesOpponent(c),
  },
  {
    id: 'survivor',
    vp: 1,
    desc: 'Take storm damage 3 times',
    condition: (c) => c.state.stats[c.playerId].dustDamageTaken >= 3,
  },
  {
    id: 'first-light',
    vp: 1,
    desc: 'Be first to research a Tech',
    condition: (c) => c.player.techs.length >= 1,
  },
];

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

// Build a MissionCtx for a player (used by the reducer when claiming).
export function missionCtx(state: GameState, playerId: string): MissionCtx {
  const cfg = boardConfigForPlayers(state.players.length);
  const g = buildBoardGraph(cfg.radius, cfg.removed);
  const player = state.players.find((p) => p.id === playerId) ?? state.players[0];
  return { state, g, player, playerId };
}
