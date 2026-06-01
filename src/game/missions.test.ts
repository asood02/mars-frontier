import { describe, it, expect } from 'vitest';
import { MISSIONS, MISSION_IDS, missionById } from './missions';

describe('MISSIONS', () => {
  it('defines all 18 mission ids exactly once', () => {
    expect(MISSIONS).toHaveLength(18);
    expect(MISSIONS.map((m) => m.id).sort()).toEqual([...MISSION_IDS].sort());
  });

  it('every mission has a positive VP and a condition function', () => {
    for (const m of MISSIONS) {
      expect(m.vp).toBeGreaterThanOrEqual(1);
      expect(typeof m.condition).toBe('function');
    }
  });

  it('missionById looks up a definition', () => {
    expect(missionById('pioneer')?.vp).toBe(2);
    expect(missionById('geologist')?.vp).toBe(3);
    expect(missionById('nope')).toBeUndefined();
  });
});
