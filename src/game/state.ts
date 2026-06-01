import type { GameState, PlayerState, PlayerStats } from './types';
import { emptyResources, emptyStats, MIN_PLAYERS, MAX_PLAYERS } from './types';
import { generateBoard, boardConfigForPlayers } from './board';
import { MISSION_IDS } from './missions';
import { mulberry32, shuffle } from './rng';

export function makePlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
    resources: emptyResources(),
    techs: [],
    missions: [],
    longestRoute: 0,
    hasCommTower: false,
  };
}

export interface CreateGameOptions {
  id: string;
  code: string;
  seed: number;
  // Canonical: 2–4 players in seating order. `p1`/`p2` kept for back-compat.
  players?: Array<{ id: string; name: string }>;
  p1?: { id: string; name: string };
  p2?: { id: string; name: string };
}

export function createGame(opts: CreateGameOptions): GameState {
  const seats = opts.players ?? [opts.p1, opts.p2].filter((p): p is { id: string; name: string } => !!p);
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(`Mars Frontier supports ${MIN_PLAYERS}–${MAX_PLAYERS} players (got ${seats.length}).`);
  }

  // Derive the deck shuffle from the seed but offset it so the deck order is
  // independent of the board layout's RNG stream.
  const deckRand = mulberry32((opts.seed ^ 0x9e3779b9) >>> 0);
  const deck = shuffle(MISSION_IDS, deckRand);

  const stats: Record<string, PlayerStats> = {};
  const terraformBy: Record<string, number> = {};
  const terraformVP: Record<string, number> = {};
  for (const s of seats) {
    stats[s.id] = emptyStats();
    terraformBy[s.id] = 0;
    terraformVP[s.id] = 0;
  }

  return {
    id: opts.id,
    code: opts.code,
    phase: 'setup1',
    turn: 0,
    activePlayerId: seats[0].id,
    players: seats.map((s) => makePlayer(s.id, s.name)),
    board: generateBoard(opts.seed, boardConfigForPlayers(seats.length)),
    buildings: [],
    routes: [],
    dustStormHexId: null,
    lastRoll: null,
    turnPhase: 'AWAIT_ROLL',
    pendingDiscards: {},
    longestRouteHolderId: null,
    stats,
    missionsOnBoard: deck.slice(0, 3),
    missionDeck: deck.slice(3),
    terraformIndex: 0,
    terraformBy,
    terraformVP,
    log: [],
    winnerId: null,
  };
}
