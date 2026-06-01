import { describe, it, expect } from 'vitest';
import { buildingVP, longestRouteLength, recomputeLongestRoute, longestRouteVP } from './scoring';
import { buildBoardGraph } from './board';
import { createGame } from './state';
import type { GameState, Route } from './types';

function withBuildings(buildings: GameState['buildings']): GameState {
  return { buildings } as GameState;
}

describe('buildingVP', () => {
  it('scores Habitat 1, Dome 2, Comm Tower 1', () => {
    const s = withBuildings([
      { vertexId: 'v1', ownerId: 'p1', kind: 'HABITAT' },
      { vertexId: 'v2', ownerId: 'p1', kind: 'DOME' },
      { vertexId: 'v3', ownerId: 'p1', kind: 'COMM_TOWER' },
      { vertexId: 'v4', ownerId: 'p2', kind: 'DOME' },
    ]);
    expect(buildingVP(s, 'p1')).toBe(1 + 2 + 1);
    expect(buildingVP(s, 'p2')).toBe(2);
  });
});

describe('longestRouteLength', () => {
  const g = buildBoardGraph();

  function connectedPath(n: number): Route[] {
    const routes: Route[] = [];
    const usedEdges = new Set<string>();
    const usedVerts = new Set<string>();
    let frontier = g.edgeVertices[g.edges[0]][0];
    usedVerts.add(frontier);
    while (routes.length < n) {
      const e = g.vertexEdges[frontier].find((ed) => {
        if (usedEdges.has(ed)) return false;
        const [a, b] = g.edgeVertices[ed];
        const other = a === frontier ? b : a;
        return !usedVerts.has(other);
      });
      if (!e) break;
      routes.push({ edgeId: e, ownerId: 'p1' });
      usedEdges.add(e);
      const [a, b] = g.edgeVertices[e];
      frontier = a === frontier ? b : a;
      usedVerts.add(frontier);
    }
    return routes;
  }

  it('returns 0 for no routes', () => {
    expect(longestRouteLength(g, [], 'p1')).toBe(0);
  });

  it('counts a single route as length 1', () => {
    expect(longestRouteLength(g, [{ edgeId: g.edges[0], ownerId: 'p1' }], 'p1')).toBe(1);
  });

  it('measures a contiguous chain of 5 as length 5', () => {
    const routes = connectedPath(5);
    expect(routes.length).toBe(5);
    expect(longestRouteLength(g, routes, 'p1')).toBe(5);
  });

  it('ignores another player’s routes', () => {
    const routes = connectedPath(3).map((r) => ({ ...r, ownerId: 'p2' }));
    expect(longestRouteLength(g, routes, 'p1')).toBe(0);
  });
});

describe('recomputeLongestRoute', () => {
  const g = buildBoardGraph();
  function freshState() {
    return createGame({
      id: 'g',
      code: 'CODELR',
      seed: 9,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
  }
  function connectedPath(n: number, owner: string): Route[] {
    const routes: Route[] = [];
    const usedEdges = new Set<string>();
    const usedVerts = new Set<string>();
    let frontier = g.edgeVertices[g.edges[0]][0];
    usedVerts.add(frontier);
    while (routes.length < n) {
      const e = g.vertexEdges[frontier].find((ed) => {
        if (usedEdges.has(ed)) return false;
        const [a, b] = g.edgeVertices[ed];
        return !usedVerts.has(a === frontier ? b : a);
      });
      if (!e) break;
      routes.push({ edgeId: e, ownerId: owner });
      usedEdges.add(e);
      const [a, b] = g.edgeVertices[e];
      frontier = a === frontier ? b : a;
      usedVerts.add(frontier);
    }
    return routes;
  }

  it('awards the holder at length >= 5 and grants 2 VP', () => {
    const s = freshState();
    s.routes = connectedPath(5, 'p1');
    s.longestRouteHolderId = recomputeLongestRoute(g, s);
    expect(s.longestRouteHolderId).toBe('p1');
    expect(longestRouteVP(s, 'p1')).toBe(2);
    expect(longestRouteVP(s, 'p2')).toBe(0);
  });

  it('no holder below length 5', () => {
    const s = freshState();
    s.routes = connectedPath(4, 'p1');
    expect(recomputeLongestRoute(g, s)).toBeNull();
  });
});
