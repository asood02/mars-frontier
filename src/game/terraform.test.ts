import { describe, it, expect } from 'vitest';
import { createGame } from './state';
import { applyMove } from './reducer';
import { produce } from './production';
import { buildBoardGraph } from './board';
import { playerVP } from './scoring';
import type { GameState } from './types';
import { TERRAFORM_MILESTONES, MAX_TERRAFORM, LAKE_THAW_TI } from './types';

const g = buildBoardGraph();

function playState(): GameState {
  const s = createGame({ id: 'g', code: 'C', seed: 5, p1: { id: 'p1', name: 'A' }, p2: { id: 'p2', name: 'B' } });
  s.phase = 'play';
  s.turn = 1;
  s.activePlayerId = 'p1';
  s.turnPhase = 'ACTIONS';
  return s;
}

describe('TERRAFORM action', () => {
  it('spends O2+H2O+ENG, raises the index, grants Research, and tracks contribution', () => {
    const s = playState();
    s.players[0].resources = { O2: 1, H2O: 1, ORE: 0, ENG: 1, RES: 0 };
    const r = applyMove(s, { type: 'TERRAFORM' }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.terraformIndex).toBe(1);
    expect(r.state.terraformBy['p1']).toBe(1);
    expect(r.state.players[0].resources).toEqual({ O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 1 });
  });

  it('rejects when the player cannot afford it', () => {
    const s = playState();
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 9, ENG: 0, RES: 0 };
    expect(applyMove(s, { type: 'TERRAFORM' }, 'p1').error).toMatch(/afford/i);
  });

  it('awards VP when crossing a milestone, and that VP counts toward winning', () => {
    const s = playState();
    s.terraformIndex = TERRAFORM_MILESTONES[0] - 1; // one short of the first milestone
    s.players[0].resources = { O2: 5, H2O: 5, ORE: 0, ENG: 5, RES: 0 };
    const before = playerVP(s, 'p1');
    const r = applyMove(s, { type: 'TERRAFORM' }, 'p1');
    expect(r.state.terraformIndex).toBe(TERRAFORM_MILESTONES[0]);
    expect(r.state.terraformVP['p1']).toBe(1);
    expect(playerVP(r.state, 'p1')).toBe(before + 1);
  });

  it('cannot terraform past the maximum', () => {
    const s = playState();
    s.terraformIndex = MAX_TERRAFORM;
    s.players[0].resources = { O2: 5, H2O: 5, ORE: 0, ENG: 5, RES: 0 };
    expect(applyMove(s, { type: 'TERRAFORM' }, 'p1').error).toMatch(/terraformed/i);
  });
});

describe('lakes thaw with terraforming', () => {
  it('a Crater Lake produces water for an adjacent building only past the thaw threshold', () => {
    const s = playState();
    const lake = s.board.hexes.find((h) => h.terrain === 'LAKE')!;
    // give the lake a number and place p1 on one of its vertices
    lake.number = 5;
    const vertex = g.hexVertices[lake.id][0];
    s.buildings.push({ vertexId: vertex, ownerId: 'p1', kind: 'HABITAT' });

    s.terraformIndex = LAKE_THAW_TI - 1;
    expect(produce(g, s, 5)['p1'].H2O).toBe(0); // still frozen

    s.terraformIndex = LAKE_THAW_TI;
    expect(produce(g, s, 5)['p1'].H2O).toBeGreaterThanOrEqual(1); // thawed → water
  });
});
