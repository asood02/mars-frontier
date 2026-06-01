import { describe, it, expect } from 'vitest';
import { createGame } from './state';
import { applyMove, setupExpectation } from './reducer';
import { buildBoardGraph, boardConfigForPlayers, generateBoard } from './board';
import type { GameState } from './types';

function game(n: number): GameState {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
  return createGame({ id: 'g', code: 'CODE01', seed: 7, players });
}

// Drive the whole snake-draft setup by always picking a legal habitat + a free
// incident edge, using the board graph sized for this player count.
function runSetup(s: GameState): GameState {
  const cfg = boardConfigForPlayers(s.players.length);
  const g = buildBoardGraph(cfg.radius, cfg.removed);
  while (s.phase === 'setup1' || s.phase === 'setup2') {
    const exp = setupExpectation(s)!;
    const blocked = new Set<string>();
    for (const b of s.buildings) {
      blocked.add(b.vertexId);
      for (const nb of g.vertexNeighbors[b.vertexId]) blocked.add(nb);
    }
    const vertex = g.vertices.find(
      (v) => !blocked.has(v) && g.vertexEdges[v].some((e) => !s.routes.some((r) => r.edgeId === e)),
    )!;
    const edge = g.vertexEdges[vertex].find((e) => !s.routes.some((r) => r.edgeId === e))!;
    const a = applyMove(s, { type: 'BUILD', building: 'HABITAT', locationId: vertex }, exp.playerId);
    expect(a.error).toBeUndefined();
    const b = applyMove(a.state, { type: 'BUILD_ROUTE', edgeId: edge }, exp.playerId);
    expect(b.error).toBeUndefined();
    s = b.state;
  }
  return s;
}

describe('board scales with player count', () => {
  it('3 and 4 players get progressively larger boards than 2', () => {
    const t2 = generateBoard(1, boardConfigForPlayers(2)).hexes.length;
    const t3 = generateBoard(1, boardConfigForPlayers(3)).hexes.length;
    const t4 = generateBoard(1, boardConfigForPlayers(4)).hexes.length;
    expect(t2).toBe(30);
    expect(t3).toBeGreaterThan(t2);
    expect(t4).toBeGreaterThan(t3);
  });

  it('every scaled board has exactly one Lake and a number on every other tile', () => {
    for (const n of [3, 4]) {
      const hexes = generateBoard(42, boardConfigForPlayers(n)).hexes;
      const lakes = hexes.filter((h) => h.terrain === 'LAKE');
      expect(lakes).toHaveLength(1);
      for (const h of hexes) {
        if (h.terrain === 'LAKE') expect(h.number).toBeNull();
        else expect(typeof h.number).toBe('number');
      }
    }
  });
});

describe('createGame with 2–4 players', () => {
  it('builds N players, N stat blocks, and a board sized to N', () => {
    for (const n of [2, 3, 4]) {
      const s = game(n);
      expect(s.players).toHaveLength(n);
      expect(Object.keys(s.stats)).toHaveLength(n);
      expect(s.board.hexes.length).toBe(boardConfigForPlayers(n).terrainBag.length);
      expect(s.activePlayerId).toBe('p1');
    }
  });

  it('rejects fewer than 2 or more than 4 players', () => {
    expect(() => createGame({ id: 'g', code: 'C', seed: 1, players: [{ id: 'p1', name: 'A' }] })).toThrow();
    expect(() =>
      createGame({
        id: 'g',
        code: 'C',
        seed: 1,
        players: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: 'x' })),
      }),
    ).toThrow();
  });
});

describe('snake-draft setup for 3 players', () => {
  it('orders placements p1,p2,p3 then p3,p2,p1 and starts play with p1', () => {
    let s = game(3);
    const order: string[] = [];
    const cfg = boardConfigForPlayers(3);
    const g = buildBoardGraph(cfg.radius, cfg.removed);
    // record the habitat-placer order across the whole setup
    while (s.phase === 'setup1' || s.phase === 'setup2') {
      const exp = setupExpectation(s)!;
      if (exp.kind === 'HABITAT') order.push(exp.playerId);
      const blocked = new Set<string>();
      for (const b of s.buildings) {
        blocked.add(b.vertexId);
        for (const nb of g.vertexNeighbors[b.vertexId]) blocked.add(nb);
      }
      const vertex = g.vertices.find(
        (v) => !blocked.has(v) && g.vertexEdges[v].some((e) => !s.routes.some((r) => r.edgeId === e)),
      )!;
      const edge = g.vertexEdges[vertex].find((e) => !s.routes.some((r) => r.edgeId === e))!;
      s = applyMove(s, { type: 'BUILD', building: 'HABITAT', locationId: vertex }, exp.playerId).state;
      s = applyMove(s, { type: 'BUILD_ROUTE', edgeId: edge }, exp.playerId).state;
    }
    expect(order).toEqual(['p1', 'p2', 'p3', 'p3', 'p2', 'p1']);
    expect(s.phase).toBe('play');
    expect(s.turn).toBe(1);
    expect(s.activePlayerId).toBe('p1');
    expect(s.buildings).toHaveLength(6);
  });
});

describe('turn order cycles through all players', () => {
  it('advances p1 → p2 → p3 → p1 on END_TURN', () => {
    let s = runSetup(game(3));
    const seen: string[] = [s.activePlayerId];
    for (let i = 0; i < 3; i++) {
      s = applyMove(s, { type: 'ROLL', roll: [1, 1] }, s.activePlayerId).state; // 2, never a 7
      const r = applyMove(s, { type: 'END_TURN' }, s.activePlayerId);
      expect(r.error).toBeUndefined();
      s = r.state;
      seen.push(s.activePlayerId);
    }
    expect(seen).toEqual(['p1', 'p2', 'p3', 'p1']);
  });
});
