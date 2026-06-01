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
  hexNeighbors: Record<string, string[]>; // hexId -> adjacent hexIds (shared edge)
  vertexPos: Record<string, [number, number]>;
  hexPos: Record<string, [number, number]>;
  edgePos: Record<string, [number, number]>; // midpoint
  viewBox: { minX: number; minY: number; width: number; height: number };
}

export function hexId(q: number, r: number): string {
  return `h.${q}.${r}`;
}

// The six axial neighbor directions for a hex.
const AXIAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

// hexId -> adjacent hexIds present on the board (share an edge).
export function hexAdjacency(
  radius: number = BOARD_RADIUS,
  removed: RemovedSet = REMOVED,
): Record<string, string[]> {
  const coords = hexCoords(radius, removed);
  const present = new Set(coords.map((c) => hexId(c.q, c.r)));
  const out: Record<string, string[]> = {};
  for (const { q, r } of coords) {
    out[hexId(q, r)] = AXIAL_DIRS.map(([dq, dr]) => hexId(q + dq, r + dr)).filter((id) =>
      present.has(id),
    );
  }
  return out;
}

// Catan-style probability pips: how many dots a number token shows
// (frequency of that sum on 2d6). 2/12→1 … 6/8→5.
export function numberPips(n: number): number {
  return 6 - Math.abs(7 - n);
}

type RemovedSet = ReadonlyArray<readonly [number, number]>;

export function hexCoords(
  radius: number = BOARD_RADIUS,
  removed: RemovedSet = REMOVED,
): Array<{ q: number; r: number }> {
  const coords: Array<{ q: number; r: number }> = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > radius) continue;
      if (removed.some(([rq, rr]) => rq === q && rr === r)) continue;
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

export function buildBoardGraph(
  radius: number = BOARD_RADIUS,
  removed: RemovedSet = REMOVED,
): BoardGraph {
  const coords = hexCoords(radius, removed);
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
    hexNeighbors: hexAdjacency(radius, removed),
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

// --- board sizing by player count -------------------------------------------
// 2 players keep the hand-tuned 30-tile board exactly (so existing tests and the
// board's "feel" are unchanged). 3/4 players get larger boards with bags scaled
// procedurally to the tile count while preserving the terrain mix and bell-curve.

export interface BoardConfig {
  radius: number;
  removed: RemovedSet;
  terrainBag: Terrain[];
  numberBag: number[];
}

// Even-ish producer split + a couple of Labs + one Lake, sized to `tiles`.
function makeTerrainBag(tiles: number): Terrain[] {
  const lake = 1;
  const labs = Math.max(2, Math.round(tiles / 18));
  const producers = tiles - lake - labs;
  const kinds: Terrain[] = ['PLAIN', 'RIDGE', 'CRATER', 'ICE'];
  const bag: Terrain[] = [];
  for (let i = 0; i < producers; i++) bag.push(kinds[i % kinds.length]);
  for (let i = 0; i < labs; i++) bag.push('LAB');
  bag.push('LAKE');
  return bag;
}

// `n` number tokens (one per non-Lake tile) shaped like 2d6 (no 7), exact length.
function makeNumberBag(n: number): number[] {
  const weights: [number, number][] = [
    [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [8, 5], [9, 4], [10, 3], [11, 2], [12, 1],
  ];
  const total = 30;
  const counts = weights.map(([num, w]) => [num, Math.max(1, Math.round((w / total) * n))] as [number, number]);
  let sum = counts.reduce((a, [, c]) => a + c, 0);
  // Adjust to exactly n by nudging the most central numbers first.
  const order = [6, 8, 5, 9, 4, 10, 3, 11, 2, 12];
  let i = 0;
  while (sum !== n) {
    const entry = counts.find(([num]) => num === order[i % order.length])!;
    if (sum < n) {
      entry[1] += 1;
      sum += 1;
    } else if (entry[1] > 1) {
      entry[1] -= 1;
      sum -= 1;
    }
    i += 1;
  }
  const bag: number[] = [];
  for (const [num, c] of counts) for (let k = 0; k < c; k++) bag.push(num);
  return bag;
}

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  radius: BOARD_RADIUS,
  removed: REMOVED,
  terrainBag: TERRAIN_BAG,
  numberBag: NUMBER_BAG,
};

// Tile target per player count: 2p=30 (tuned), 3p=37 (radius 3 full), 4p=61 (radius 4 full).
export function boardConfigForPlayers(count: number): BoardConfig {
  if (count <= 2) return DEFAULT_BOARD_CONFIG;
  const radius = count >= 4 ? 4 : 3;
  const removed: RemovedSet = [];
  const tiles = hexCoords(radius, removed).length;
  return {
    radius,
    removed,
    terrainBag: makeTerrainBag(tiles),
    numberBag: makeNumberBag(tiles - 1), // exactly one Lake → tiles-1 numbered
  };
}

// Adjacent slot-index pairs over a list of coords, in slot space.
function adjacentPairs(coords: Array<{ q: number; r: number }>): Array<[number, number]> {
  const idx = new Map(coords.map((c, i) => [hexId(c.q, c.r), i]));
  const pairs: Array<[number, number]> = [];
  coords.forEach((c, i) => {
    for (const [dq, dr] of AXIAL_DIRS) {
      const j = idx.get(hexId(c.q + dq, c.r + dr));
      if (j !== undefined && j > i) pairs.push([i, j]);
    }
  });
  return pairs;
}

// Bounded randomized search: shuffle `items` into slots, minimizing the summed
// `cost` over adjacent pairs. Deterministic for a given rand stream; stops early
// on a zero-cost layout. Returns the best assignment found.
function searchLayout<T>(
  items: readonly T[],
  pairs: Array<[number, number]>,
  cost: (a: T, b: T) => number,
  rand: () => number,
  iters = 4000,
): T[] {
  let best = items.slice();
  let bestCost = Infinity;
  for (let it = 0; it < iters; it++) {
    const arr = shuffle(items, rand);
    let c = 0;
    for (const [a, b] of pairs) c += cost(arr[a], arr[b]);
    if (c < bestCost) {
      bestCost = c;
      best = arr;
      if (c === 0) break;
    }
  }
  return best;
}

const isRed = (n: number) => n === 6 || n === 8;

// Generate a balanced board: terrains spread out (few same-terrain neighbors),
// and number tokens with no two equal numbers adjacent and no two high-odds
// (6/8) tiles adjacent — an even probability field. Deterministic per seed.
export function generateHexes(seed: number, cfg: BoardConfig = DEFAULT_BOARD_CONFIG): Hex[] {
  const coords = hexCoords(cfg.radius, cfg.removed);
  const pairs = adjacentPairs(coords);

  // 1) Terrain: minimize adjacent same-terrain pairs.
  const terrains = searchLayout(
    cfg.terrainBag,
    pairs,
    (a, b) => (a === b ? 1 : 0),
    mulberry32(seed >>> 0),
  );

  // 2) Numbers over the non-LAKE slots only.
  const nonLake: number[] = [];
  coords.forEach((_, i) => {
    if (terrains[i] !== 'LAKE') nonLake.push(i);
  });
  const slotOf = new Map(nonLake.map((coordIdx, slot) => [coordIdx, slot]));
  const numPairs: Array<[number, number]> = [];
  for (const [a, b] of pairs) {
    const sa = slotOf.get(a);
    const sb = slotOf.get(b);
    if (sa !== undefined && sb !== undefined) numPairs.push([sa, sb]);
  }
  const numLayout = searchLayout(
    cfg.numberBag,
    numPairs,
    (a, b) => (a === b ? 4 : 0) + (isRed(a) && isRed(b) ? 2 : 0),
    mulberry32((seed ^ 0x9e3779b9) >>> 0),
    12000,
  );

  const numberByCoord = new Array<number | null>(coords.length).fill(null);
  nonLake.forEach((coordIdx, slot) => {
    numberByCoord[coordIdx] = numLayout[slot];
  });

  return coords.map((c, i) => ({
    id: hexId(c.q, c.r),
    q: c.q,
    r: c.r,
    terrain: terrains[i],
    number: numberByCoord[i],
  }));
}

export function generateBoard(seed: number, cfg: BoardConfig = DEFAULT_BOARD_CONFIG): BoardData {
  const graph = buildBoardGraph(cfg.radius, cfg.removed);
  return {
    hexes: generateHexes(seed, cfg),
    vertices: graph.vertices,
    edges: graph.edges,
  };
}
