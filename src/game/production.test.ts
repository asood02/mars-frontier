import { describe, it, expect } from 'vitest';
import { buildBoardGraph } from './board';
import { produce, produceOnSeven } from './production';
import { createGame } from './state';
import type { GameState, Hex } from './types';

const g = buildBoardGraph();

function gameWith(hexes: Hex[], patch: Partial<GameState> = {}): GameState {
  const s = createGame({
    id: 'g',
    code: 'CODE02',
    seed: 1,
    p1: { id: 'p1', name: 'A' },
    p2: { id: 'p2', name: 'B' },
  });
  s.board.hexes = hexes;
  s.phase = 'play';
  s.activePlayerId = 'p1';
  return { ...s, ...patch };
}

describe('produce', () => {
  it('gives 1 resource per adjacent Habitat and 2 per adjacent Dome', () => {
    const hex = g.hexIds[0];
    const vertex = g.hexVertices[hex][0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'PLAIN', number: 5 }];
    const s = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'HABITAT' }],
    });
    const delta = produce(g, s, 5);
    expect(delta['p1'].O2).toBe(1);

    const s2 = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p2', kind: 'DOME' }],
    });
    const delta2 = produce(g, s2, 5);
    expect(delta2['p2'].O2).toBe(2);
  });

  it('produces nothing from the dust-storm hex or a LAKE', () => {
    const hex = g.hexIds[0];
    const vertex = g.hexVertices[hex][0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'PLAIN', number: 5 }];
    const s = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'HABITAT' }],
      dustStormHexId: hex,
    });
    expect(produce(g, s, 5)['p1'].O2).toBe(0);

    const lake: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'LAKE', number: 5 }];
    const sl = gameWith(lake, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'HABITAT' }],
    });
    expect(produce(g, sl, 5)['p1'].O2).toBe(0);
  });

  it('gives the active player 1 RES per Lab hex rolled, regardless of adjacency', () => {
    const hex = g.hexIds[0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'LAB', number: 8 }];
    const s = gameWith(hexes, { activePlayerId: 'p2' });
    const delta = produce(g, s, 8);
    expect(delta['p2'].RES).toBe(1);
    expect(delta['p1'].RES).toBe(0);
  });
});

describe('tech-aware production', () => {
  it('ENG1 adds +1 ORE per Ridge building', () => {
    const hex = g.hexIds[0];
    const vertex = g.hexVertices[hex][0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'RIDGE', number: 5 }];
    const s = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'HABITAT' }],
    });
    s.players[0].techs = ['ENG1'];
    expect(produce(g, s, 5)['p1'].ORE).toBe(2);
  });

  it('ASTRO4 makes Domes yield 3 ENG from Craters', () => {
    const hex = g.hexIds[0];
    const vertex = g.hexVertices[hex][0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'CRATER', number: 6 }];
    const s = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'DOME' }],
    });
    s.players[0].techs = ['ENG1', 'ENG2', 'ENG3', 'BIO1', 'ASTRO4'];
    expect(produce(g, s, 6)['p1'].ENG).toBe(3);
  });

  it('produceOnSeven yields nothing without BIO3 and resources with it', () => {
    const hex = g.hexIds[0];
    const vertex = g.hexVertices[hex][0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'PLAIN', number: 4 }];
    const s = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'HABITAT' }],
    });
    expect(produceOnSeven(g, s, 'p1').O2).toBe(0);
    s.players[0].techs = ['BIO1', 'BIO2', 'BIO3'];
    expect(produceOnSeven(g, s, 'p1').O2).toBe(2); // PLAIN 1 + BIO1 1
  });
});
