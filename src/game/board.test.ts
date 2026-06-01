import { describe, it, expect } from 'vitest';
import {
  hexCoords,
  buildBoardGraph,
  hexId,
  generateHexes,
  generateBoard,
  hexAdjacency,
  numberPips,
} from './board';

describe('hexCoords', () => {
  it('produces exactly 30 hexes', () => {
    expect(hexCoords()).toHaveLength(30);
  });

  it('produces unique coordinates', () => {
    const ids = hexCoords().map((c) => hexId(c.q, c.r));
    expect(new Set(ids).size).toBe(30);
  });

  it('keeps every cell within radius 3', () => {
    for (const { q, r } of hexCoords()) {
      const s = -q - r;
      expect(Math.max(Math.abs(q), Math.abs(r), Math.abs(s))).toBeLessThanOrEqual(3);
    }
  });
});

describe('buildBoardGraph', () => {
  const g = buildBoardGraph();

  it('has 30 hexes, 82 vertices, 111 edges', () => {
    expect(g.hexIds).toHaveLength(30);
    expect(g.vertices).toHaveLength(82);
    expect(g.edges).toHaveLength(111);
  });

  it('gives every hex exactly 6 vertices', () => {
    for (const h of g.hexIds) {
      expect(g.hexVertices[h]).toHaveLength(6);
    }
  });

  it('every edge connects two distinct, known vertices', () => {
    for (const e of g.edges) {
      const [a, b] = g.edgeVertices[e];
      expect(a).not.toBe(b);
      expect(g.vertices).toContain(a);
      expect(g.vertices).toContain(b);
    }
  });

  it('vertex adjacency is symmetric', () => {
    for (const v of g.vertices) {
      for (const n of g.vertexNeighbors[v]) {
        expect(g.vertexNeighbors[n]).toContain(v);
      }
    }
  });

  it('shared vertices reference more than one hex; every vertex references at least one', () => {
    let shared = 0;
    for (const v of g.vertices) {
      expect(g.vertexHexes[v].length).toBeGreaterThanOrEqual(1);
      if (g.vertexHexes[v].length > 1) shared++;
    }
    expect(shared).toBeGreaterThan(40);
  });

  it('every vertex has between 2 and 3 incident edges', () => {
    for (const v of g.vertices) {
      const n = g.vertexEdges[v].length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
});

describe('generateHexes', () => {
  it('has the exact terrain distribution from the spec', () => {
    const hexes = generateHexes(123);
    const counts: Record<string, number> = {};
    for (const h of hexes) counts[h.terrain] = (counts[h.terrain] ?? 0) + 1;
    expect(counts).toEqual({ PLAIN: 8, RIDGE: 7, CRATER: 6, ICE: 6, LAB: 2, LAKE: 1 });
  });

  it('assigns a number to every non-LAKE hex and null to LAKE', () => {
    const hexes = generateHexes(123);
    for (const h of hexes) {
      if (h.terrain === 'LAKE') expect(h.number).toBeNull();
      else expect(typeof h.number).toBe('number');
    }
  });

  it('never assigns a 7', () => {
    for (const h of generateHexes(456)) {
      expect(h.number).not.toBe(7);
    }
  });

  it('uses the bell-curve number bag (29 tokens, more 6/8 than 2/12)', () => {
    const hexes = generateHexes(789);
    const nums = hexes.map((h) => h.number).filter((n): n is number => n !== null);
    expect(nums).toHaveLength(29);
    const freq = (n: number) => nums.filter((x) => x === n).length;
    expect(freq(6)).toBe(4);
    expect(freq(8)).toBe(4);
    expect(freq(2)).toBe(2);
    expect(freq(12)).toBe(1);
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateHexes(1)).toEqual(generateHexes(1));
    expect(generateHexes(1)).not.toEqual(generateHexes(2));
  });
});

describe('generateBoard', () => {
  it('combines hexes with the static graph vertices/edges', () => {
    const board = generateBoard(42);
    expect(board.hexes).toHaveLength(30);
    expect(board.vertices).toHaveLength(82);
    expect(board.edges).toHaveLength(111);
  });
});

describe('numberPips', () => {
  it('maps sums to their 2d6 frequency (Catan pips)', () => {
    expect(numberPips(2)).toBe(1);
    expect(numberPips(12)).toBe(1);
    expect(numberPips(6)).toBe(5);
    expect(numberPips(8)).toBe(5);
    expect(numberPips(5)).toBe(4);
  });
});

describe('hexAdjacency', () => {
  const adj = hexAdjacency();
  it('is symmetric and within 6 neighbors', () => {
    for (const [id, ns] of Object.entries(adj)) {
      expect(ns.length).toBeLessThanOrEqual(6);
      for (const n of ns) expect(adj[n]).toContain(id);
    }
  });
});

describe('balanced board generation', () => {
  const adj = hexAdjacency();
  function violations(seed: number) {
    const hexes = generateHexes(seed);
    const byId = new Map(hexes.map((h) => [h.id, h]));
    let equalNum = 0;
    let redAdj = 0;
    const seen = new Set<string>();
    for (const h of hexes) {
      for (const n of adj[h.id]) {
        const key = [h.id, n].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const o = byId.get(n)!;
        if (h.number !== null && o.number !== null) {
          if (h.number === o.number) equalNum++;
          const red = (x: number | null) => x === 6 || x === 8;
          if (red(h.number) && red(o.number)) redAdj++;
        }
      }
    }
    return { equalNum, redAdj };
  }

  it('never places two equal numbers adjacent, and minimizes 6/8 adjacency', () => {
    for (const seed of [1, 2, 42, 99, 1000, 7777]) {
      const v = violations(seed);
      expect(v.equalNum).toBe(0);
      expect(v.redAdj).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the spec terrain distribution', () => {
    const counts: Record<string, number> = {};
    for (const h of generateHexes(42)) counts[h.terrain] = (counts[h.terrain] ?? 0) + 1;
    expect(counts).toEqual({ PLAIN: 8, RIDGE: 7, CRATER: 6, ICE: 6, LAB: 2, LAKE: 1 });
  });
});

describe('board pixel geometry', () => {
  const g = buildBoardGraph();
  it('positions every vertex, hex, and edge', () => {
    expect(Object.keys(g.vertexPos)).toHaveLength(82);
    expect(Object.keys(g.hexPos)).toHaveLength(30);
    expect(Object.keys(g.edgePos)).toHaveLength(111);
  });
  it('has a positive-size viewBox covering the vertices', () => {
    expect(g.viewBox.width).toBeGreaterThan(0);
    expect(g.viewBox.height).toBeGreaterThan(0);
  });
});
