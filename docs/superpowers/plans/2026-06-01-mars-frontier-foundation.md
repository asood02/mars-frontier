# Mars Frontier — Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Vite + React + TypeScript project and build a fully unit-tested, deterministic board generator and core game-state types — the foundation every later plan builds on.

**Architecture:** Pure, framework-free game core under `src/game/` (no React, no Supabase). Board geometry is computed deterministically from a fixed hex layout; terrain/number assignment is seeded so games are reproducible and testable. The React app is a minimal placeholder here — real UI arrives in Plan 3.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, Vitest. Node 20+ (verified: v24 present).

**Scope note:** This is Plan 1 of 5 (Foundation → Game Engine → UI & Local Hotseat → Multiplayer → Polish & Deploy). It implements spec §2 (tech stack / repo layout), §3.1–§3.2 (board + resources data), and the `GameState`/`Move` type surface from §4.1–§4.2. The reducer logic itself (§3.3–§3.10) is Plan 2.

**Conventions:**
- Package manager: `npm`. Shell: PowerShell on Windows; commands below are shell-agnostic.
- Working directory for all commands: the repo root `C:\Users\aryan\mars-frontier`.
- Commit after every green task. Conventional commit messages.

---

## File Structure

Files created in this plan and their single responsibility:

| File | Responsibility |
|---|---|
| `package.json` | Dependencies + scripts (`dev`, `build`, `test`, `typecheck`) |
| `tsconfig.json`, `tsconfig.node.json` | TypeScript config for app + tooling |
| `vite.config.ts` | Vite + React plugin + Vitest config |
| `tailwind.config.ts`, `postcss.config.js` | Tailwind setup (palette from spec §5.1) |
| `index.html`, `src/main.tsx`, `src/index.css`, `src/ui/App.tsx` | Minimal app shell so the project compiles + runs |
| `src/game/types.ts` | All shared types: `Resource`, `Terrain`, `Building`, `GameState`, `Move`, helpers |
| `src/game/rng.ts` | Seeded PRNG + `shuffle` so board/deck generation is deterministic |
| `src/game/board.ts` | Hex layout, board graph (vertices/edges/adjacency), terrain + number assignment |
| `src/game/missions.ts` | Mission **ids** only (full definitions land in Plan 2) |
| `src/game/state.ts` | `createGame()` factory → initial `GameState` |
| `src/game/*.test.ts` | Vitest unit tests for the above |
| `.gitignore`, `.env.example`, `netlify.toml` | Repo hygiene + deploy config (spec §8) |

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/index.css`, `src/ui/App.tsx`, `.gitignore`, `.env.example`, `netlify.toml`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mars-frontier",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

- [ ] **Step 5: Create `tailwind.config.ts`** (palette from spec §5.1)

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: '#0a0e1a',
        mars: '#ff6b35',
        cyan: '#00d9ff',
        res: { o2: '#4ade80', h2o: '#3b82f6', ore: '#fb923c', eng: '#facc15', rsh: '#a78bfa' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mars Frontier</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  background: #0a0e1a;
  color: #e5e7eb;
}
```

- [ ] **Step 9: Create `src/ui/App.tsx`** (placeholder; real UI is Plan 3)

```tsx
export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center font-display text-mars text-4xl">
      Mars Frontier
    </main>
  );
}
```

- [ ] **Step 10: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 11: Create `.gitignore`**

```
node_modules
dist
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 12: Create `.env.example`** (spec §2 / §8)

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 13: Create `netlify.toml`** (spec §8)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 14: Install dependencies**

Run: `npm install`
Expected: completes without error; `node_modules/` and `package-lock.json` created.

- [ ] **Step 15: Verify the app builds and typechecks**

Run: `npm run build`
Expected: `tsc -b` passes and Vite emits to `dist/` with no errors.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"
```

---

## Task 1: Core types

**Files:**
- Create: `src/game/types.ts`

These are the shared types from spec §4.1–§4.2, plus small constants/helpers used throughout the engine. No tests in this task — the types are exercised by every later test. The "test" is that `npm run typecheck` stays green.

- [ ] **Step 1: Create `src/game/types.ts`**

```ts
// Shared types for the Mars Frontier game core (spec §4.1–§4.2).

export type Resource = 'O2' | 'H2O' | 'ORE' | 'ENG' | 'RES';
export type Terrain = 'PLAIN' | 'RIDGE' | 'CRATER' | 'ICE' | 'LAB' | 'LAKE';
export type BuildingKind = 'HABITAT' | 'DOME' | 'COMM_TOWER';
export type Phase = 'lobby' | 'setup1' | 'setup2' | 'play' | 'gameover';

export interface Hex {
  id: string;
  q: number;
  r: number;
  terrain: Terrain;
  number: number | null; // null only for LAKE (no production)
}

export interface Building {
  vertexId: string;
  ownerId: string;
  kind: BuildingKind;
}

export interface Route {
  edgeId: string;
  ownerId: string;
}

export interface GameEvent {
  turn: number;
  playerId: string;
  text: string;
}

export interface PlayerState {
  id: string;
  name: string;
  resources: Record<Resource, number>;
  techs: string[]; // tech card ids
  missions: string[]; // claimed mission ids
  longestRoute: number;
  hasCommTower: boolean;
}

export interface BoardData {
  hexes: Hex[];
  vertices: string[];
  edges: string[];
}

export interface GameState {
  id: string;
  code: string; // 6-char room code (used by multiplayer in Plan 4)
  phase: Phase;
  turn: number;
  activePlayerId: string;
  players: [PlayerState, PlayerState];
  board: BoardData;
  buildings: Building[];
  routes: Route[];
  dustStormHexId: string | null;
  lastRoll: [number, number] | null;
  missionDeck: string[]; // remaining face-down mission ids
  missionsOnBoard: string[]; // 3 visible mission ids
  log: GameEvent[];
  winnerId: string | null;
}

// Every move the reducer (Plan 2) will accept (spec §4.2).
export type Move =
  | { type: 'ROLL'; roll: [number, number] }
  | { type: 'MOVE_DUST_STORM'; hexId: string }
  | { type: 'DISCARD'; cards: Partial<Record<Resource, number>> }
  | {
      type: 'TRADE_PLAYER';
      offer: Partial<Record<Resource, number>>;
      want: Partial<Record<Resource, number>>;
      accepted: boolean;
    }
  | { type: 'TRADE_MARKET'; give: Resource; receive: Resource }
  | { type: 'BUILD'; building: BuildingKind; locationId: string }
  | { type: 'BUILD_ROUTE'; edgeId: string }
  | { type: 'RESEARCH'; techId: string }
  | { type: 'CLAIM_MISSION'; missionId: string }
  | { type: 'END_TURN' };

export const RESOURCES: readonly Resource[] = ['O2', 'H2O', 'ORE', 'ENG', 'RES'];

// Which resource each producing terrain yields (spec §3.2). LAKE produces nothing.
export const TERRAIN_RESOURCE: Partial<Record<Terrain, Resource>> = {
  PLAIN: 'O2',
  ICE: 'H2O',
  RIDGE: 'ORE',
  CRATER: 'ENG',
  LAB: 'RES',
};

export function emptyResources(): Record<Resource, number> {
  return { O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
}

export function totalResources(r: Record<Resource, number>): number {
  return RESOURCES.reduce((sum, k) => sum + r[k], 0);
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/game/types.ts
git commit -m "feat: add core game types"
```

---

## Task 2: Seeded RNG

**Files:**
- Create: `src/game/rng.ts`
- Test: `src/game/rng.test.ts`

A tiny deterministic PRNG (mulberry32) + Fisher–Yates `shuffle`. Determinism is what makes board generation and the mission deck unit-testable.

- [ ] **Step 1: Write the failing test**

Create `src/game/rng.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/rng.test.ts`
Expected: FAIL — cannot resolve `./rng` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/game/rng.ts`:

```ts
// Deterministic PRNG so board + deck generation is reproducible and testable.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher–Yates. Returns a new array; does not mutate the input.
export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/rng.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/rng.ts src/game/rng.test.ts
git commit -m "feat: add seeded PRNG and shuffle"
```

---

## Task 3: Board graph (geometry)

**Files:**
- Create: `src/game/board.ts`
- Test: `src/game/board.test.ts`

Build the static board topology: 30 hexes, their shared vertices (building spots) and edges (route spots), and adjacency maps. Geometry is computed from a fixed hex layout — no randomness here (terrain/numbers come in Task 4). Vertices are deduped by rounding each hex corner's pixel position to 3 decimals so neighboring hexes share corners.

**Verified counts (run during planning):** 30 hexes → **85 vertices**, **116 edges**. These are asserted in the test.

**Coordinate model:** axial `(q, r)` pointy-top hexes. Board = radius-3 hexagon (37 cells) minus a fixed 7-cell `REMOVED` set → 30 cells in a rough hexagonal outline. `REMOVED` is a cosmetic shape constant; it may be retuned in Plan 3 (UI) if the rendered outline needs polish, in which case the asserted vertex/edge counts update accordingly.

- [ ] **Step 1: Write the failing test**

Create `src/game/board.test.ts`:

```ts
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

  it('has 30 hexes, 85 vertices, 116 edges', () => {
    expect(g.hexIds).toHaveLength(30);
    expect(g.vertices).toHaveLength(85);
    expect(g.edges).toHaveLength(116);
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
    // Interior vertices are shared by 2–3 hexes; there must be many.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/board.test.ts`
Expected: FAIL — cannot resolve `./board`.

- [ ] **Step 3: Write the implementation**

Create `src/game/board.ts`:

```ts
// Static board topology for Mars Frontier (spec §3.1).
// Pointy-top axial hexes. Vertices/edges are shared between neighboring hexes
// by deduping corner pixel positions.

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
  return `${x.toFixed(3)}:${y.toFixed(3)}`;
}

export function buildBoardGraph(): BoardGraph {
  const coords = hexCoords();
  const hexIds = coords.map((c) => hexId(c.q, c.r));

  const vKeyToId = new Map<string, string>();
  const vertices: string[] = [];
  const hexVertices: Record<string, string[]> = {};
  const vertexHexes: Record<string, string[]> = {};

  for (const { q, r } of coords) {
    const id = hexId(q, r);
    const [cx, cy] = hexCenter(q, r);
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

  return {
    hexIds,
    vertices,
    edges,
    hexVertices,
    vertexHexes,
    vertexEdges,
    edgeVertices,
    vertexNeighbors,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/board.test.ts`
Expected: PASS (all assertions).

> If the vertex/edge counts differ from 85/116, the geometry changed — do **not** silently edit the asserted numbers. Re-derive them by logging `buildBoardGraph().vertices.length` / `.edges.length` and confirm the change was intended (e.g. a `REMOVED` retune), then update the test.

- [ ] **Step 5: Commit**

```bash
git add src/game/board.ts src/game/board.test.ts
git commit -m "feat: build board graph (hexes, vertices, edges, adjacency)"
```

---

## Task 4: Terrain & number assignment

**Files:**
- Modify: `src/game/board.ts` (append `generateHexes` + `generateBoard`)
- Modify: `src/game/board.test.ts` (append a `describe` block)

Assign each hex a terrain (fixed distribution from spec §3.1) and a number token (bell-curve bag, no 7, from spec §3.1). Seeded → reproducible. The single `LAKE` produces nothing and gets `number: null`; the other 29 hexes each get one number from a 29-element bag.

- [ ] **Step 1: Write the failing test (append to `src/game/board.test.ts`)**

```ts
import { generateHexes, generateBoard } from './board';

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
    expect(board.vertices).toHaveLength(85);
    expect(board.edges).toHaveLength(116);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/board.test.ts`
Expected: FAIL — `generateHexes`/`generateBoard` are not exported.

- [ ] **Step 3: Append the implementation to `src/game/board.ts`**

Add these imports at the top of `src/game/board.ts`:

```ts
import type { BoardData, Hex, Terrain } from './types';
import { mulberry32, shuffle } from './rng';
```

Append at the bottom of `src/game/board.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/board.test.ts`
Expected: PASS (all board + terrain tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/board.ts src/game/board.test.ts
git commit -m "feat: seeded terrain and number-token assignment"
```

---

## Task 5: Mission ids + initial game state

**Files:**
- Create: `src/game/missions.ts`
- Create: `src/game/state.ts`
- Test: `src/game/state.test.ts`

`createGame()` produces a valid initial `GameState` in the `setup1` phase: generated board, two zeroed players, a shuffled mission deck (3 face-up). Full mission *definitions* (conditions/rewards) and the reducer are Plan 2 — here we only need the 18 stable ids so the state is well-formed.

- [ ] **Step 1: Create `src/game/missions.ts`**

```ts
// Mission card IDs (spec §3.8). Full definitions (conditions + rewards) are
// implemented in Plan 2; Plan 1 only needs stable ids to build a valid deck.
export const MISSION_IDS: readonly string[] = [
  'pioneer', // First to build 3 Habitats — 2 VP
  'ice-baron', // Control 3 Ice-adjacent buildings — 2 VP
  'engineer', // Own Comm Tower — 1 VP + 2 ENG
  'cartographer', // Routes touching all 4 terrains — 2 VP
  'geologist', // Own a building in all 4 producing terrains — 3 VP
  'long-haul', // Build 4 Route segments in one turn — 1 VP + 2 ENG
  'researcher', // Own 2 Tech Cards — 2 VP
  'industrialist', // Have 2 Domes — 2 VP
  'dustkeeper', // Place Dust Storm 3 times — 1 VP
  'stockpile', // Hold 10 resources at end of your turn — 1 VP
  'alchemist', // Trade with opponent 3 times — 1 VP + 1 RES
  'sprinter', // Win Longest Route (>=5 segments) — 2 VP
  'diversified', // Own 1 of each building type — 3 VP
  'astronomer', // Roll three 7s during the game — 1 VP
  'solar-mogul', // Control 3 Crater-adjacent buildings — 2 VP
  'networker', // Build 2nd Route extension to opponent's edge — 1 VP
  'survivor', // Take Dust Storm damage 3 times — 1 VP
  'first-light', // First to research T1 of any track — 1 VP
];
```

- [ ] **Step 2: Write the failing test**

Create `src/game/state.test.ts`:

```ts
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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/game/state.test.ts`
Expected: FAIL — cannot resolve `./state`.

- [ ] **Step 4: Write the implementation**

Create `src/game/state.ts`:

```ts
import type { GameState, PlayerState } from './types';
import { emptyResources } from './types';
import { generateBoard } from './board';
import { MISSION_IDS } from './missions';
import { mulberry32, shuffle } from './rng';

export function makePlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
    resources: emptyResources(),
    techs: [],
    missions: [],
    longestRoute: 0,
    hasCommTower: false,
  };
}

export interface CreateGameOptions {
  id: string;
  code: string;
  seed: number;
  p1: { id: string; name: string };
  p2: { id: string; name: string };
}

export function createGame(opts: CreateGameOptions): GameState {
  // Derive the deck shuffle from the seed but offset it so the deck order is
  // independent of the board layout's RNG stream.
  const deckRand = mulberry32((opts.seed ^ 0x9e3779b9) >>> 0);
  const deck = shuffle(MISSION_IDS, deckRand);

  return {
    id: opts.id,
    code: opts.code,
    phase: 'setup1',
    turn: 0,
    activePlayerId: opts.p1.id,
    players: [makePlayer(opts.p1.id, opts.p1.name), makePlayer(opts.p2.id, opts.p2.name)],
    board: generateBoard(opts.seed),
    buildings: [],
    routes: [],
    dustStormHexId: null,
    lastRoll: null,
    missionsOnBoard: deck.slice(0, 3),
    missionDeck: deck.slice(3),
    log: [],
    winnerId: null,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/game/state.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/game/missions.ts src/game/state.ts src/game/state.test.ts
git commit -m "feat: createGame factory and mission ids"
```

---

## Task 6: Full green gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites (rng, board, state), 0 failures.

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck` then `npm run build`
Expected: both PASS with no errors; `dist/` emitted.

- [ ] **Step 3: Smoke-run the dev server (manual, optional)**

Run: `npm run dev`
Expected: Vite serves at `http://localhost:5173`; page shows the "Mars Frontier" title. Stop with Ctrl+C.

- [ ] **Step 4: Commit any lockfile/config drift if present**

```bash
git add -A
git commit -m "chore: foundation green — full suite passing" --allow-empty
```

---

## Self-Review

**Spec coverage (Plan 1's slice):**
- §2 tech stack & repo layout → Task 0 scaffold (Vite/React/TS/Tailwind/Vitest, `netlify.toml`, `.env.example`, `src/game/` layout). ✓
- §3.1 board (30 hexes, terrain distribution, bell-curve no-7 tokens, Lake = no production) → Tasks 3–4. ✓
- §3.2 resources & terrain→resource mapping → `RESOURCES`, `TERRAIN_RESOURCE` in Task 1. ✓
- §4.1 `GameState` + all sub-types → Task 1. ✓ (added `code` field, used by Plan 4 multiplayer; noted inline.)
- §4.2 `Move` union → Task 1 (type only; reducer is Plan 2). ✓
- §8 deploy config (`netlify.toml`, env vars) → Task 0. ✓
- **Deferred to later plans (intentionally):** reducer/rules/tech-effects/missions logic, scoring, longest route, dust storm (§3.3–§3.10) → Plan 2; UI/store (§5) → Plan 3; Supabase/sync (§4.3–§4.4, §6) → Plan 4; animations/onboarding/a11y (§5.5–§5.7) → Plan 5.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to" — every code step contains full source. `missions.ts` intentionally ships ids only; this is stated explicitly and the deferral is scoped, not a placeholder.

**Type consistency:** `Resource`/`Terrain`/`BuildingKind`/`GameState`/`PlayerState`/`BoardData` defined once in `types.ts` and imported everywhere. `mulberry32`/`shuffle` signatures match across `rng.ts`, `board.ts`, `state.ts`. `createGame`/`CreateGameOptions`/`makePlayer` names match between `state.ts` and `state.test.ts`. `MISSION_IDS` (18 ids) consistent between `missions.ts` and both `state.ts` and `state.test.ts`. Board counts (30/85/116) consistent between `board.ts` behavior, `board.test.ts`, and `state.test.ts`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-mars-frontier-foundation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — I execute tasks in this session using executing-plans, batch execution with checkpoints.

(Or: write **Plan 2 — Game Engine** next instead of executing yet.)

Which approach?
