import { describe, it, expect } from 'vitest';
import { buildBoardGraph } from './board';
import {
  buildingAt,
  routeAt,
  playerRouteEndpoints,
  violatesDistanceRule,
  canAfford,
  payCost,
} from './rules';
import type { GameState, Building, Route } from './types';
import { emptyResources } from './types';

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
