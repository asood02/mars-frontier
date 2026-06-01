import { describe, it, expect } from 'vitest';
import { hexCoords, buildBoardGraph, hexId } from './board';

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
