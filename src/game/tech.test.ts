import { describe, it, expect } from 'vitest';
import { TECHS, techById, hasTech, nextResearchable } from './tech';
import type { PlayerState } from './types';
import { emptyResources } from './types';

function player(techs: string[]): PlayerState {
  return {
    id: 'p1',
    name: 'A',
    resources: emptyResources(),
    techs,
    missions: [],
    longestRoute: 0,
    hasCommTower: false,
  };
}

describe('TECHS', () => {
  it('has 12 techs, 4 per track, costs 2/3/3/4', () => {
    expect(TECHS).toHaveLength(12);
    for (const track of ['ENG', 'BIO', 'ASTRO'] as const) {
      const t = TECHS.filter((x) => x.track === track).sort((a, b) => a.tier - b.tier);
      expect(t.map((x) => x.tier)).toEqual([1, 2, 3, 4]);
      expect(t.map((x) => x.cost)).toEqual([2, 3, 3, 4]);
      expect(t.every((x) => x.vp === 1)).toBe(true);
    }
  });
});

describe('nextResearchable', () => {
  it('is the tier-1 tech of a track when none owned', () => {
    expect(nextResearchable(player([]), 'ENG')?.id).toBe('ENG1');
  });
  it('advances in order', () => {
    expect(nextResearchable(player(['ENG1']), 'ENG')?.id).toBe('ENG2');
    expect(nextResearchable(player(['ENG1', 'ENG2', 'ENG3', 'ENG4']), 'ENG')).toBeNull();
  });
});

describe('techById / hasTech', () => {
  it('looks up and checks ownership', () => {
    expect(techById('BIO3')?.track).toBe('BIO');
    expect(hasTech(player(['BIO1']), 'BIO1')).toBe(true);
    expect(hasTech(player(['BIO1']), 'BIO2')).toBe(false);
  });
});
