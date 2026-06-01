// Static board topology for Mars Frontier (spec §3.1).
// Pointy-top axial hexes. Vertices/edges are shared between neighboring hexes
// by deduping corner pixel positions.

import type { BoardData, Hex, Terrain } from './types';
import { mulberry32, shuffle } from './rng';

export const BOARD_RADIUS = 3;

// 7 cells removed from the radius-3 hexagon (37 cells) → 30 cells.
// Cosmetic shape constant; retune in the UI phase if the outline needs polish.
const REMOVED: ReadonlyArray<readonly [number, number]> = [
  [3, 0],
  [-3, 0],
  [0, 3],
  [0, -3],
  [3, -3],
  [-3, 3],
  [1, -3],
];

const SQRT3 = Math.sqrt(3);

export interface BoardGraph {
  hexIds: string[];
  vertices: string[];
  edges: string[];
  hexVertices: Record<string, string[]>; // hexId -> 6 vertexIds (clockwise)
  vertexHexes: Record<string, string[]>; // vertexId -> adjacent hexIds
  vertexEdges: Record<string, string[]>; // vertexId -> incident edgeIds
  edgeVertices: Record<string, [string, string]>; // edgeId -> its 2 vertexIds
  vertexNeighbors: Record<string, string[]>; // vertexId -> vertices one edge away
  vertexPos: Record<string, [number, number]>;
  hexPos: Record<string, [number, number]>;
  edgePos: Record<string, [number, number]>; // midpoint
  viewBox: { minX: number; minY: number; width: number; height: number };
}

export function hexId(q: number, r: number): string {
  return `h.${q}.${r}`;
}

export function hexCoords(): Array<{ q: number; r: number }> {
  const coords: Array<{ q: number; r: number }> = [];
  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > BOARD_RADIUS) continue;
      if (REMOVED.some(([rq, rr]) => rq === q && rr === r)) continue;
      coords.push({ q, r });
    }
  }
  return coords;
}

function hexCenter(q: number, r: number): [number, number] {
  return [SQRT3 * (q + r / 2), 1.5 * r];
}

function cornerKey(x: number, y: number): string {
  // Round to integer thousandths so shared corners dedupe. Using Math.round
  // (not toFixed) avoids the "-0.000" vs "0.000" split on the x=0 / y=0 axes,
  // since String(-0) === "0".
  return `${Math.round(x * 1000)}:${Math.round(y * 1000)}`;
}

export function buildBoardGraph(): BoardGraph {
  const coords = hexCoords();
  const hexIds = coords.map((c) => hexId(c.q, c.r));

  const vKeyToId = new Map<string, string>();
  const vertices: string[] = [];
  const hexVertices: Record<string, string[]> = {};
  const vertexHexes: Record<string, string[]> = {};
  const vertexPos: Record<string, [number, number]> = {};
  const hexPos: Record<string, [number, number]> = {};

  for (const { q, r } of coords) {
    const id = hexId(q, r);
    const [cx, cy] = hexCenter(q, r);
    hexPos[id] = [cx, cy];
    const vids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const x = cx + Math.cos(angle);
      const y = cy + Math.sin(angle);
      const k = cornerKey(x, y);
      let vid = vKeyToId.get(k);
      if (!vid) {
        vid = `v${vertices.length}`;
        vKeyToId.set(k, vid);
        vertices.push(vid);
        vertexHexes[vid] = [];
        vertexPos[vid] = [x, y];
      }
      vids.push(vid);
      if (!vertexHexes[vid].includes(id)) vertexHexes[vid].push(id);
    }
    hexVertices[id] = vids;
  }

  const eKeyToId = new Map<string, string>();
  const edges: string[] = [];
  const edgeVertices: Record<string, [string, string]> = {};
  const vertexEdges: Record<string, string[]> = {};
  for (const v of vertices) vertexEdges[v] = [];

  for (const id of hexIds) {
    const vids = hexVertices[id];
    for (let i = 0; i < 6; i++) {
      const a = vids[i];
      const b = vids[(i + 1) % 6];
      const ek = [a, b].sort().join('|');
      if (!eKeyToId.has(ek)) {
        const eid = `e${edges.length}`;
        eKeyToId.set(ek, eid);
        edges.push(eid);
        edgeVertices[eid] = [a, b];
        vertexEdges[a].push(eid);
        vertexEdges[b].push(eid);
      }
    }
  }

  const vertexNeighbors: Record<string, string[]> = {};
  for (const v of vertices) {
    vertexNeighbors[v] = vertexEdges[v].map((e) => {
      const [a, b] = edgeVertices[e];
      return a === v ? b : a;
    });
  }

  const edgePos: Record<string, [number, number]> = {};
  for (const e of edges) {
    const [a, b] = edgeVertices[e];
    const [ax, ay] = vertexPos[a];
    const [bx, by] = vertexPos[b];
    edgePos[e] = [(ax + bx) / 2, (ay + by) / 2];
  }

  const xs = Object.values(vertexPos).map((p) => p[0]);
  const ys = Object.values(vertexPos).map((p) => p[1]);
  const pad = 0.6;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const viewBox = {
    minX,
    minY,
    width: Math.max(...xs) - minX + pad,
    height: Math.max(...ys) - minY + pad,
  };

  return {
    hexIds,
    vertices,
    edges,
    hexVertices,
    vertexHexes,
    vertexEdges,
    edgeVertices,
    vertexNeighbors,
    vertexPos,
    hexPos,
    edgePos,
    viewBox,
  };
}

// Terrain distribution (spec §3.1): 8 Plain · 7 Ridge · 6 Crater · 6 Ice · 2 Lab · 1 Lake = 30.
const TERRAIN_BAG: Terrain[] = [
  ...Array<Terrain>(8).fill('PLAIN'),
  ...Array<Terrain>(7).fill('RIDGE'),
  ...Array<Terrain>(6).fill('CRATER'),
  ...Array<Terrain>(6).fill('ICE'),
  ...Array<Terrain>(2).fill('LAB'),
  'LAKE',
];

// Bell-curve number bag (spec §3.1): 29 tokens, no 7, more 6s/8s than 2s/12s.
const NUMBER_BAG: number[] = [
  2, 2,
  3, 3, 3,
  4, 4, 4,
  5, 5, 5,
  6, 6, 6, 6,
  8, 8, 8, 8,
  9, 9, 9,
  10, 10, 10,
  11, 11, 11,
  12,
];

export function generateHexes(seed: number): Hex[] {
  const rand = mulberry32(seed);
  const coords = hexCoords();
  const terrains = shuffle(TERRAIN_BAG, rand);
  const numbers = shuffle(NUMBER_BAG, rand);
  let ni = 0;
  return coords.map((c, i) => {
    const terrain = terrains[i];
    const number = terrain === 'LAKE' ? null : numbers[ni++];
    return { id: hexId(c.q, c.r), q: c.q, r: c.r, terrain, number };
  });
}

export function generateBoard(seed: number): BoardData {
  const graph = buildBoardGraph();
  return {
    hexes: generateHexes(seed),
    vertices: graph.vertices,
    edges: graph.edges,
  };
}
