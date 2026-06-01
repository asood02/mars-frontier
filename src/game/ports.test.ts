import { describe, it, expect } from 'vitest';
import { generateBoard, buildBoardGraph, boardConfigForPlayers } from './board';
import { marketRateFor } from './rules';
import { createGame } from './state';
import { applyMove } from './reducer';
import type { GameState } from './types';
import { RESOURCES } from './types';

describe('trade depot (port) generation', () => {
  it('places depots only on coastal vertices, spaced apart, with one per resource', () => {
    const g = buildBoardGraph();
    const board = generateBoard(7);
    expect(board.ports.length).toBeGreaterThanOrEqual(5);

    const coastal = new Set(g.vertices.filter((v) => g.vertexHexes[v].length < 3));
    for (const p of board.ports) expect(coastal.has(p.vertexId)).toBe(true);

    // no two depots adjacent
    const portV = new Set(board.ports.map((p) => p.vertexId));
    for (const p of board.ports) {
      for (const n of g.vertexNeighbors[p.vertexId]) expect(portV.has(n)).toBe(false);
    }

    // every resource has a 2:1 depot
    for (const r of RESOURCES) {
      expect(board.ports.some((p) => p.resource === r && p.rate === 2)).toBe(true);
    }
  });

  it('is deterministic per seed and scales up for larger boards', () => {
    expect(generateBoard(3).ports).toEqual(generateBoard(3).ports);
    const small = generateBoard(3, boardConfigForPlayers(2)).ports.length;
    const big = generateBoard(3, boardConfigForPlayers(4)).ports.length;
    expect(big).toBeGreaterThanOrEqual(small);
  });
});

describe('market rate uses depots', () => {
  function playGame(): GameState {
    const s = createGame({ id: 'g', code: 'C', seed: 7, p1: { id: 'p1', name: 'A' }, p2: { id: 'p2', name: 'B' } });
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    return s;
  }

  it('a building on a resource depot trades that resource 2:1 (vs 3:1 default)', () => {
    const s = playGame();
    const port = s.board.ports.find((p) => p.resource !== null)!;
    // base rate is 3:1 with no building on a depot
    expect(marketRateFor(s, 'p1', port.resource!)).toBe(3);
    // put a habitat on the depot vertex
    s.buildings.push({ vertexId: port.vertexId, ownerId: 'p1', kind: 'HABITAT' });
    expect(marketRateFor(s, 'p1', port.resource!)).toBe(2);

    // and the reducer honors it: 2 of that resource → 1 of another
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    s.players[0].resources[port.resource!] = 2;
    const other = RESOURCES.find((r) => r !== port.resource)!;
    const r = applyMove(s, { type: 'TRADE_MARKET', give: port.resource!, receive: other }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources[port.resource!]).toBe(0);
    expect(r.state.players[0].resources[other]).toBe(1);
  });

  it('a generic depot trades any resource 2:1', () => {
    const s = playGame();
    const generic = s.board.ports.find((p) => p.resource === null);
    if (!generic) return; // small boards may have none
    s.buildings.push({ vertexId: generic.vertexId, ownerId: 'p1', kind: 'HABITAT' });
    for (const r of RESOURCES) expect(marketRateFor(s, 'p1', r)).toBe(2);
  });
});
