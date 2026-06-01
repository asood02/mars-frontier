import { describe, it, expect } from 'vitest';
import { createGame } from './state';
import { MISSION_IDS } from './missions';
import { RESOURCES } from './types';

const opts = {
  id: 'game-1',
  code: 'ABC123',
  seed: 42,
  p1: { id: 'p1', name: 'Alice' },
  p2: { id: 'p2', name: 'Bob' },
};

describe('createGame', () => {
  it('starts in setup1 with player 1 active and no winner', () => {
    const g = createGame(opts);
    expect(g.phase).toBe('setup1');
    expect(g.activePlayerId).toBe('p1');
    expect(g.turn).toBe(0);
    expect(g.winnerId).toBeNull();
  });

  it('has two zeroed players in order', () => {
    const g = createGame(opts);
    expect(g.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    for (const p of g.players) {
      expect(RESOURCES.every((r) => p.resources[r] === 0)).toBe(true);
      expect(p.techs).toEqual([]);
      expect(p.missions).toEqual([]);
      expect(p.longestRoute).toBe(0);
      expect(p.hasCommTower).toBe(false);
    }
  });

  it('generates a full board and empty build state', () => {
    const g = createGame(opts);
    expect(g.board.hexes).toHaveLength(30);
    expect(g.buildings).toEqual([]);
    expect(g.routes).toEqual([]);
    expect(g.dustStormHexId).toBeNull();
    expect(g.lastRoll).toBeNull();
  });

  it('shuffles all 18 missions: 3 on board, 15 in deck, no overlap', () => {
    const g = createGame(opts);
    expect(g.missionsOnBoard).toHaveLength(3);
    expect(g.missionDeck).toHaveLength(15);
    const all = [...g.missionsOnBoard, ...g.missionDeck];
    expect(new Set(all).size).toBe(18);
    expect([...all].sort()).toEqual([...MISSION_IDS].sort());
  });

  it('is deterministic per seed', () => {
    expect(createGame(opts)).toEqual(createGame(opts));
  });

  it('preserves the room code', () => {
    expect(createGame(opts).code).toBe('ABC123');
  });

  it('starts awaiting a roll with no pending discards', () => {
    const g = createGame(opts);
    expect(g.turnPhase).toBe('AWAIT_ROLL');
    expect(g.pendingDiscards).toEqual({});
  });
});
