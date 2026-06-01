import { describe, it, expect } from 'vitest';
import { buildBoardGraph } from './board';
import {
  buildingAt,
  routeAt,
  playerRouteEndpoints,
  violatesDistanceRule,
  canAfford,
  payCost,
  legalMoves,
} from './rules';
import type { Building, Route } from './types';
import { emptyResources } from './types';
import { createGame } from './state';
import { applyMove } from './reducer';

const g = buildBoardGraph();

// Two vertices that share an edge (adjacent), and the edge between them.
const edge0 = g.edges[0];
const [vA, vB] = g.edgeVertices[edge0];

describe('buildingAt / routeAt', () => {
  it('finds a building / route by location, or returns undefined', () => {
    const buildings: Building[] = [{ vertexId: vA, ownerId: 'p1', kind: 'HABITAT' }];
    const routes: Route[] = [{ edgeId: edge0, ownerId: 'p1' }];
    expect(buildingAt(buildings, vA)?.ownerId).toBe('p1');
    expect(buildingAt(buildings, vB)).toBeUndefined();
    expect(routeAt(routes, edge0)?.ownerId).toBe('p1');
  });
});

describe('playerRouteEndpoints', () => {
  it('returns the set of vertices touched by a player’s routes', () => {
    const routes: Route[] = [{ edgeId: edge0, ownerId: 'p1' }];
    const eps = playerRouteEndpoints(g, routes, 'p1');
    expect(eps.has(vA)).toBe(true);
    expect(eps.has(vB)).toBe(true);
    expect(playerRouteEndpoints(g, routes, 'p2').size).toBe(0);
  });
});

describe('violatesDistanceRule', () => {
  it('is true when a building sits on the vertex or an adjacent vertex', () => {
    const buildings: Building[] = [{ vertexId: vA, ownerId: 'p2', kind: 'HABITAT' }];
    expect(violatesDistanceRule(g, buildings, vA)).toBe(true); // occupied
    expect(violatesDistanceRule(g, buildings, vB)).toBe(true); // adjacent to vA
  });

  it('is false on a vertex far from any building', () => {
    const far = g.vertices.find(
      (v) => v !== vA && v !== vB && !g.vertexNeighbors[vA].includes(v),
    )!;
    const buildings: Building[] = [{ vertexId: vA, ownerId: 'p2', kind: 'HABITAT' }];
    expect(violatesDistanceRule(g, buildings, far)).toBe(false);
  });
});

describe('canAfford / payCost', () => {
  it('canAfford checks every resource in the cost', () => {
    const r = { ...emptyResources(), ORE: 2, ENG: 1 };
    expect(canAfford(r, { ORE: 2, ENG: 1 })).toBe(true);
    expect(canAfford(r, { ORE: 3 })).toBe(false);
  });

  it('payCost returns a new resource record with the cost subtracted', () => {
    const r = { ...emptyResources(), ORE: 2, ENG: 3 };
    const after = payCost(r, { ORE: 2, ENG: 3 });
    expect(after).toEqual(emptyResources());
    expect(r.ORE).toBe(2); // original not mutated
  });
});

describe('legalMoves', () => {
  it('in AWAIT_ROLL the only legal move is ROLL', () => {
    const s = createGame({
      id: 'g',
      code: 'CODE03',
      seed: 3,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'AWAIT_ROLL';
    const moves = legalMoves(s, 'p1');
    expect(moves.length).toBe(1);
    expect(moves[0].type).toBe('ROLL');
    expect(legalMoves(s, 'p2')).toEqual([]); // not p2's turn
  });

  it('in ACTIONS, END_TURN is available and every generated move is accepted by the reducer', () => {
    const s = createGame({
      id: 'g',
      code: 'CODE04',
      seed: 4,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    s.players[0].resources = { O2: 5, H2O: 5, ORE: 5, ENG: 5, RES: 5 };
    const moves = legalMoves(s, 'p1');
    expect(moves.some((m) => m.type === 'END_TURN')).toBe(true);
    for (const m of moves) {
      expect(applyMove(s, m, 'p1').error).toBeUndefined();
    }
  });
});
