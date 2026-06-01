import { describe, it, expect } from 'vitest';
import { mulberry32, shuffle } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces values in [0, 1)', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe('shuffle', () => {
  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input, mulberry32(1));
    expect(input).toEqual(copy);
  });

  it('preserves all elements (is a permutation)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, mulberry32(99));
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('is deterministic for a given seed', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    expect(shuffle(input, mulberry32(5))).toEqual(shuffle(input, mulberry32(5)));
  });
});
