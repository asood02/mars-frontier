import { describe, it, expect } from 'vitest';
import { createGame } from './state';
import { applyMove } from './reducer';
import { buildBoardGraph } from './board';
import { playerVP } from './scoring';
import { legalMoves } from './rules';
import type { GameState } from './types';

const g = buildBoardGraph();

function runSetup(s: GameState): GameState {
  const place = (st: GameState) => {
    const blocked = new Set<string>();
    for (const b of st.buildings) {
      blocked.add(b.vertexId);
      for (const n of g.vertexNeighbors[b.vertexId]) blocked.add(n);
    }
    const vertex = g.vertices.find(
      (v) => !blocked.has(v) && g.vertexEdges[v].some((e) => !st.routes.some((r) => r.edgeId === e)),
    )!;
    const edge = g.vertexEdges[vertex].find((e) => !st.routes.some((r) => r.edgeId === e))!;
    const who = st.activePlayerId;
    let r = applyMove(st, { type: 'BUILD', building: 'HABITAT', locationId: vertex }, who);
    expect(r.error).toBeUndefined();
    r = applyMove(r.state, { type: 'BUILD_ROUTE', edgeId: edge }, who);
    expect(r.error).toBeUndefined();
    return r.state;
  };
  let st = s;
  for (let i = 0; i < 4; i++) st = place(st);
  return st;
}

describe('integration', () => {
  it('plays setup then a turn without producing an invalid state', () => {
    let s = createGame({
      id: 'g',
      code: 'INTEG1',
      seed: 11,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s = runSetup(s);
    expect(s.phase).toBe('play');

    let r = applyMove(s, { type: 'ROLL', roll: [2, 3] }, 'p1'); // 5
    expect(r.error).toBeUndefined();
    expect(r.state.turnPhase).toBe('ACTIONS');
    for (const m of legalMoves(r.state, 'p1')) {
      expect(applyMove(r.state, m, 'p1').error).toBeUndefined();
    }
    r = applyMove(r.state, { type: 'END_TURN' }, 'p1');
    expect(r.state.activePlayerId).toBe('p2');
    expect(r.state.turnPhase).toBe('AWAIT_ROLL');

    expect(playerVP(r.state, 'p1')).toBeGreaterThanOrEqual(0);
    expect(playerVP(r.state, 'p2')).toBeGreaterThanOrEqual(0);
  });

  it('lets the active player research and that adds VP', () => {
    let s = createGame({
      id: 'g',
      code: 'INTEG2',
      seed: 11,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s = runSetup(s);
    s.players[0].resources.RES = 5;
    s.turnPhase = 'ACTIONS';
    s.lastRoll = [2, 3];
    const r = applyMove(s, { type: 'RESEARCH', techId: 'ENG1' }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].techs).toEqual(['ENG1']);
    expect(playerVP(r.state, 'p1')).toBeGreaterThanOrEqual(1);
  });
});
