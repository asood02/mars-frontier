import { describe, it, expect } from 'vitest';
import { applyMove } from './reducer';
import { createGame } from './state';
import { buildBoardGraph } from './board';
import type { GameState } from './types';

const g = buildBoardGraph();

function newGame(): GameState {
  return createGame({
    id: 'gx',
    code: 'CODE01',
    seed: 7,
    p1: { id: 'p1', name: 'A' },
    p2: { id: 'p2', name: 'B' },
  });
}

// Pick a vertex, then a route edge incident to it.
function vertexWithEdge(): { vertex: string; edge: string } {
  const edge = g.edges[0];
  const [vertex] = g.edgeVertices[edge];
  return { vertex, edge };
}

describe('setup placement', () => {
  it('rejects a route before the first habitat', () => {
    const s = newGame();
    const { edge } = vertexWithEdge();
    const { error } = applyMove(s, { type: 'BUILD_ROUTE', edgeId: edge }, 'p1');
    expect(error).toMatch(/habitat/i);
  });

  it('places P1 habitat then requires a connected route', () => {
    const s0 = newGame();
    const { vertex, edge } = vertexWithEdge();
    const r1 = applyMove(s0, { type: 'BUILD', building: 'HABITAT', locationId: vertex }, 'p1');
    expect(r1.error).toBeUndefined();
    expect(r1.state.buildings).toHaveLength(1);
    // a route not touching the habitat is rejected
    const farEdge = g.edges.find((e) => !g.edgeVertices[e].includes(vertex))!;
    const bad = applyMove(r1.state, { type: 'BUILD_ROUTE', edgeId: farEdge }, 'p1');
    expect(bad.error).toMatch(/touch/i);
    // the connected route is accepted, and turn passes to p2
    const r2 = applyMove(r1.state, { type: 'BUILD_ROUTE', edgeId: edge }, 'p1');
    expect(r2.error).toBeUndefined();
    expect(r2.state.routes).toHaveLength(1);
    expect(r2.state.activePlayerId).toBe('p2');
  });

  it('grants starting resources on the 2nd habitat and reaches play phase', () => {
    let s = newGame();
    const place = (st: GameState) => {
      const blocked = new Set<string>();
      for (const b of st.buildings) {
        blocked.add(b.vertexId);
        for (const n of g.vertexNeighbors[b.vertexId]) blocked.add(n);
      }
      const vertex = g.vertices.find(
        (v) =>
          !blocked.has(v) && g.vertexEdges[v].some((e) => !st.routes.some((r) => r.edgeId === e)),
      )!;
      const edge = g.vertexEdges[vertex].find((e) => !st.routes.some((r) => r.edgeId === e))!;
      const who = st.activePlayerId;
      const a = applyMove(st, { type: 'BUILD', building: 'HABITAT', locationId: vertex }, who);
      expect(a.error).toBeUndefined();
      const b = applyMove(a.state, { type: 'BUILD_ROUTE', edgeId: edge }, who);
      expect(b.error).toBeUndefined();
      return b.state;
    };
    s = place(s); // p1 #1
    s = place(s); // p2 #1
    expect(s.phase).toBe('setup2');
    s = place(s); // p2 #2 (gets resources)
    s = place(s); // p1 #2 (gets resources)
    expect(s.phase).toBe('play');
    expect(s.turn).toBe(1);
    expect(s.activePlayerId).toBe('p1');
    expect(s.turnPhase).toBe('AWAIT_ROLL');
    const totalP1 = Object.values(s.players[0].resources).reduce((x, y) => x + y, 0);
    const totalP2 = Object.values(s.players[1].resources).reduce((x, y) => x + y, 0);
    expect(totalP1).toBeGreaterThanOrEqual(0);
    expect(totalP2).toBeGreaterThanOrEqual(0);
  });
});
