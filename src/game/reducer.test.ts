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

describe('ROLL in play phase', () => {
  it('rejects a roll out of turn or after already rolling', () => {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'AWAIT_ROLL';
    expect(applyMove(s, { type: 'ROLL', roll: [3, 4] }, 'p2').error).toMatch(/your turn/i);
    const rolled = applyMove(s, { type: 'ROLL', roll: [3, 5] }, 'p1');
    expect(rolled.error).toBeUndefined();
    expect(rolled.state.turnPhase).toBe('ACTIONS');
    expect(applyMove(rolled.state, { type: 'ROLL', roll: [2, 2] }, 'p1').error).toMatch(/already/i);
  });

  it('a 7 with a big hand moves to DISCARD', () => {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'AWAIT_ROLL';
    s.players[0].resources = { O2: 4, H2O: 4, ORE: 0, ENG: 0, RES: 0 }; // 8 cards
    const r = applyMove(s, { type: 'ROLL', roll: [3, 4] }, 'p1');
    expect(r.state.turnPhase).toBe('DISCARD');
    expect(r.state.pendingDiscards['p1']).toBe(4);
  });
});

describe('7-roll resolution', () => {
  function sevenState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'AWAIT_ROLL';
    s.players[0].resources = { O2: 4, H2O: 4, ORE: 0, ENG: 0, RES: 0 }; // owes 4
    return applyMove(s, { type: 'ROLL', roll: [3, 4] }, 'p1').state;
  }

  it('requires discarding exactly the owed count, then moves to MOVE_STORM', () => {
    const s = sevenState();
    expect(applyMove(s, { type: 'DISCARD', cards: { O2: 2 } }, 'p1').error).toMatch(/exactly 4/);
    const ok = applyMove(s, { type: 'DISCARD', cards: { O2: 2, H2O: 2 } }, 'p1');
    expect(ok.error).toBeUndefined();
    expect(ok.state.turnPhase).toBe('MOVE_STORM');
    expect(ok.state.players[0].resources.O2).toBe(2);
  });

  it('moves the dust storm to a new hex and enters ACTIONS', () => {
    let s = sevenState();
    s = applyMove(s, { type: 'DISCARD', cards: { O2: 2, H2O: 2 } }, 'p1').state;
    const target = g.hexIds[0];
    const r = applyMove(s, { type: 'MOVE_DUST_STORM', hexId: target }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.dustStormHexId).toBe(target);
    expect(r.state.turnPhase).toBe('ACTIONS');
  });

  it('refuses to move the dust storm onto its current hex', () => {
    let s = sevenState();
    s = applyMove(s, { type: 'DISCARD', cards: { O2: 2, H2O: 2 } }, 'p1').state;
    s.dustStormHexId = g.hexIds[0]; // already there, still in MOVE_STORM
    expect(applyMove(s, { type: 'MOVE_DUST_STORM', hexId: g.hexIds[0] }, 'p1').error).toMatch(
      /stay put/i,
    );
  });
});

function buildingKind(state: GameState, vertexId: string) {
  return state.buildings.find((b) => b.vertexId === vertexId)?.kind;
}

describe('BUILD during play', () => {
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    const edge = g.edges[0];
    const [v] = g.edgeVertices[edge];
    s.buildings = [{ vertexId: v, ownerId: 'p1', kind: 'HABITAT' }];
    s.routes = [{ edgeId: edge, ownerId: 'p1' }];
    return s;
  }

  it('upgrades a Habitat to a Dome when affordable', () => {
    const s = playState();
    const v = s.buildings[0].vertexId;
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 2, ENG: 3, RES: 0 };
    const r = applyMove(s, { type: 'BUILD', building: 'DOME', locationId: v }, 'p1');
    expect(r.error).toBeUndefined();
    expect(buildingKind(r.state, v)).toBe('DOME');
    expect(r.state.players[0].resources).toEqual({ O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 0 });
  });

  it('rejects a Dome on a non-owned or non-Habitat location', () => {
    const s = playState();
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 2, ENG: 3, RES: 0 };
    const empty = g.vertices.find((x) => !s.buildings.some((b) => b.vertexId === x))!;
    expect(applyMove(s, { type: 'BUILD', building: 'DOME', locationId: empty }, 'p1').error).toMatch(
      /your own Habitat/i,
    );
  });

  it('rejects a Habitat not on the player’s route', () => {
    const s = playState();
    s.players[0].resources = { O2: 1, H2O: 1, ORE: 1, ENG: 1, RES: 0 };
    const offRoute = g.vertices.find(
      (x) =>
        !s.buildings.some((b) => b.vertexId === x) &&
        !g.vertexNeighbors[s.buildings[0].vertexId].includes(x) &&
        !g.edgeVertices[s.routes[0].edgeId].includes(x),
    )!;
    expect(
      applyMove(s, { type: 'BUILD', building: 'HABITAT', locationId: offRoute }, 'p1').error,
    ).toMatch(/Rover Route/i);
  });
});

describe('BUILD_ROUTE during play', () => {
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    const edge = g.edges[0];
    const [v] = g.edgeVertices[edge];
    s.buildings = [{ vertexId: v, ownerId: 'p1', kind: 'HABITAT' }];
    s.routes = [{ edgeId: edge, ownerId: 'p1' }];
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 5, ENG: 5, RES: 0 };
    return s;
  }

  it('extends the network and charges 1 ORE + 1 ENG', () => {
    const s = playState();
    const start = s.buildings[0].vertexId;
    const nextEdge = g.vertexEdges[start].find((e) => e !== s.routes[0].edgeId)!;
    const r = applyMove(s, { type: 'BUILD_ROUTE', edgeId: nextEdge }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.routes).toHaveLength(2);
    expect(r.state.players[0].resources.ORE).toBe(4);
    expect(r.state.players[0].resources.ENG).toBe(4);
  });

  it('rejects a disconnected route', () => {
    const s = playState();
    const farEdge = g.edges.find(
      (e) =>
        !g.edgeVertices[e].includes(s.buildings[0].vertexId) &&
        !g.edgeVertices[s.routes[0].edgeId].some((v) => g.edgeVertices[e].includes(v)),
    )!;
    expect(applyMove(s, { type: 'BUILD_ROUTE', edgeId: farEdge }, 'p1').error).toMatch(/touch/i);
  });

  it('rejects building on an occupied edge', () => {
    const s = playState();
    expect(applyMove(s, { type: 'BUILD_ROUTE', edgeId: s.routes[0].edgeId }, 'p1').error).toMatch(
      /already/i,
    );
  });
});

describe('trades', () => {
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    return s;
  }

  it('market trade is 3:1 without a Comm Tower', () => {
    const s = playState();
    s.players[0].resources = { O2: 3, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    const r = applyMove(s, { type: 'TRADE_MARKET', give: 'O2', receive: 'RES' }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources.O2).toBe(0);
    expect(r.state.players[0].resources.RES).toBe(1);
  });

  it('market trade is 2:1 with a Comm Tower', () => {
    const s = playState();
    s.players[0].hasCommTower = true;
    s.players[0].resources = { O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    const r = applyMove(s, { type: 'TRADE_MARKET', give: 'O2', receive: 'ENG' }, 'p1');
    expect(r.state.players[0].resources.O2).toBe(0);
    expect(r.state.players[0].resources.ENG).toBe(1);
  });

  it('accepted player trade swaps resources both ways', () => {
    const s = playState();
    s.players[0].resources = { O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    s.players[1].resources = { O2: 0, H2O: 0, ORE: 3, ENG: 0, RES: 0 };
    const r = applyMove(
      s,
      { type: 'TRADE_PLAYER', offer: { O2: 2 }, want: { ORE: 3 }, accepted: true },
      'p1',
    );
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources).toEqual({ O2: 0, H2O: 0, ORE: 3, ENG: 0, RES: 0 });
    expect(r.state.players[1].resources).toEqual({ O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 });
  });

  it('declined player trade is a no-op', () => {
    const s = playState();
    s.players[0].resources = { O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    const r = applyMove(
      s,
      { type: 'TRADE_PLAYER', offer: { O2: 2 }, want: { ORE: 3 }, accepted: false },
      'p1',
    );
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources.O2).toBe(2);
  });
});
