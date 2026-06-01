import type { GameState, PlayerState } from './types';
import { emptyResources } from './types';
import { generateBoard } from './board';
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
  p1: { id: string; name: string };
  p2: { id: string; name: string };
}

export function createGame(opts: CreateGameOptions): GameState {
  // Derive the deck shuffle from the seed but offset it so the deck order is
  // independent of the board layout's RNG stream.
  const deckRand = mulberry32((opts.seed ^ 0x9e3779b9) >>> 0);
  const deck = shuffle(MISSION_IDS, deckRand);

  return {
    id: opts.id,
    code: opts.code,
    phase: 'setup1',
    turn: 0,
    activePlayerId: opts.p1.id,
    players: [makePlayer(opts.p1.id, opts.p1.name), makePlayer(opts.p2.id, opts.p2.name)],
    board: generateBoard(opts.seed),
    buildings: [],
    routes: [],
    dustStormHexId: null,
    lastRoll: null,
    missionsOnBoard: deck.slice(0, 3),
    missionDeck: deck.slice(3),
    log: [],
    winnerId: null,
  };
}
