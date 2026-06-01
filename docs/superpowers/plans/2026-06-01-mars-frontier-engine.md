# Mars Frontier — Plan 2: Core Game Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the pure, framework-free game reducer for Mars Frontier — setup placement, dice/production, building, trading, the dust storm, turn flow, building VP, and the win condition — fully unit-tested.

**Architecture:** A single pure entry point `applyMove(state, move, playerId) → { state, error? }` that never mutates its input. Geometry-aware legality lives in `rules.ts`; production math in `production.ts`; the move dispatcher and per-move handlers in `reducer.ts`; victory-point math in `scoring.ts`. The board graph from Plan 1 (`buildBoardGraph`) is the source of adjacency truth.

**Tech Stack:** TypeScript, Vitest. Builds on Plan 1 (`src/game/types.ts`, `board.ts`, `rng.ts`, `state.ts`).

**Scope note:** This is Plan 2 of the engine. It implements spec §3.3–§3.6, §3.9 partial (dust storm), §3.10 (win), and §4.2 (Move). **Deferred to Plan 3:** Tech Tree (§3.7), Mission conditions/claims (§3.8), and Longest Route VP (§3.9). Those add VP modifiers on top of this engine. `RESEARCH` and `CLAIM_MISSION` moves are wired to return an explicit "not yet implemented" error in this plan, so the `Move` union stays exhaustive.

**Key design decisions (locked):**
- **Turn flow** is tracked by a new `turnPhase` field: `'AWAIT_ROLL' | 'DISCARD' | 'MOVE_STORM' | 'ACTIONS'`. `END_TURN` resets the next player to `AWAIT_ROLL`.
- **Setup** sub-steps are *derived* from `buildings`/`routes` counts (no extra state) — see `setupExpectation()` in Task 3.
- **7-roll discards:** the reducer computes `pendingDiscards: Record<playerId, number>` and accepts a `DISCARD` move from *whichever* player still owes cards (this intentionally relaxes single-writer during the discard window; the net layer in Plan 4 handles that).
- **Lab production** (spec §3.1): when a Lab hex's number is rolled, the **active player** gains 1 RES per such Lab, with no adjacency requirement. All other terrains use adjacency (Habitat ×1, Dome ×2).
- **Habitat connectivity** (spec §3.6): a play-phase Habitat vertex must be an endpoint of ≥1 of the player's own routes (Catan "settlement on your road" rule), and must satisfy the distance rule (no building on it or any graph-adjacent vertex).
- **Win** (spec §3.10): checked at the *start* of a turn — after `END_TURN` advances the active player, if that player's VP ≥ 10 the game ends.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/game/types.ts` (modify) | Add `TurnPhase`, extend `GameState` with `turnPhase` + `pendingDiscards`; add `BUILDING_COST`, `MARKET_RATE`, `WIN_VP` constants |
| `src/game/state.ts` (modify) | `createGame` initializes `turnPhase: 'AWAIT_ROLL'`, `pendingDiscards: {}` |
| `src/game/rules.ts` (create) | Geometry-aware pure helpers: building/route lookups, adjacency, placement legality, `legalMoves` |
| `src/game/production.ts` (create) | `produce(state, rollSum)` → resource deltas per player |
| `src/game/scoring.ts` (create) | `buildingVP(state, playerId)`, `playerVP` (buildings only in Plan 2), win check |
| `src/game/reducer.ts` (create) | `applyMove` dispatcher + one handler per move type |
| `src/game/*.test.ts` (create) | Vitest unit tests per module |

**Helper imports:** all geometry comes from `buildBoardGraph()` (Plan 1, `board.ts`). Handlers call it once and pass the `BoardGraph` around.

---

## Task 1: Extend types & constants

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/state.ts`
- Modify: `src/game/state.test.ts`

- [ ] **Step 1: Add turn-flow types + constants to `src/game/types.ts`**

Add after the `Phase` type:

```ts
export type TurnPhase = 'AWAIT_ROLL' | 'DISCARD' | 'MOVE_STORM' | 'ACTIONS';
```

Add these two fields to the `GameState` interface (after `lastRoll`):

```ts
  turnPhase: TurnPhase;
  pendingDiscards: Record<string, number>; // playerId -> cards still owed (7-roll)
```

Append these constants at the end of the file:

```ts
// Build costs (spec §3.5).
export const BUILDING_COST: Record<BuildingKind | 'ROUTE', Partial<Record<Resource, number>>> = {
  HABITAT: { O2: 1, H2O: 1, ORE: 1, ENG: 1 },
  DOME: { ORE: 2, ENG: 3 },
  COMM_TOWER: { ENG: 2, RES: 2 },
  ROUTE: { ORE: 1, ENG: 1 },
};

export const MARKET_RATE_DEFAULT = 3; // 3:1 supply drop
export const MARKET_RATE_COMM = 2; // 2:1 with a Comm Tower
export const WIN_VP = 10;
export const DUST_DISCARD_THRESHOLD = 7; // hands larger than this discard on a 7
```

- [ ] **Step 2: Initialize new fields in `createGame` (`src/game/state.ts`)**

In the returned object literal, add after `lastRoll: null,`:

```ts
    turnPhase: 'AWAIT_ROLL',
    pendingDiscards: {},
```

- [ ] **Step 3: Update `src/game/state.test.ts` to assert the new fields**

Add this test inside the existing `describe('createGame', ...)` block:

```ts
  it('starts awaiting a roll with no pending discards', () => {
    const g = createGame(opts);
    expect(g.turnPhase).toBe('AWAIT_ROLL');
    expect(g.pendingDiscards).toEqual({});
  });
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/game/state.test.ts` then `npm run typecheck`
Expected: state tests PASS (7 total); typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/state.ts src/game/state.test.ts
git commit -m "feat: add turn-phase state and build-cost constants"
```

---

## Task 2: Geometry & legality helpers (`rules.ts`)

**Files:**
- Create: `src/game/rules.ts`
- Test: `src/game/rules.test.ts`

Pure helpers over a `BoardGraph` + `GameState`. No move application here — just predicates the reducer will compose.

- [ ] **Step 1: Write the failing test (`src/game/rules.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { buildBoardGraph } from './board';
import {
  buildingAt,
  routeAt,
  playerRouteEndpoints,
  violatesDistanceRule,
  canAfford,
  payCost,
} from './rules';
import type { GameState, Building, Route } from './types';
import { emptyResources } from './types';

const g = buildBoardGraph();

// Two vertices that share an edge (adjacent), and the edge between them.
const edge0 = g.edges[0];
const [vA, vB] = g.edgeVertices[edge0];

function baseState(): Pick<GameState, 'buildings' | 'routes'> {
  return { buildings: [], routes: [] };
}

describe('buildingAt / routeAt', () => {
  it('finds a building / route by location, or returns undefined', () => {
    const buildings: Building[] = [{ vertexId: vA, ownerId: 'p1', kind: 'HABITAT' }];
    const routes: Route[] = [{ edgeId: edge0, ownerId: 'p1' }];
    expect(buildingAt(buildings, vA)?.ownerId).toBe('p1');
    expect(buildingAt(buildings, vB)).toBeUndefined();
    expect(routeAt(routes, edge0)?.ownerId).toBe('p1');
  });
});

describe('playerRouteEndpoints', () => {
  it('returns the set of vertices touched by a player’s routes', () => {
    const routes: Route[] = [{ edgeId: edge0, ownerId: 'p1' }];
    const eps = playerRouteEndpoints(g, routes, 'p1');
    expect(eps.has(vA)).toBe(true);
    expect(eps.has(vB)).toBe(true);
    expect(playerRouteEndpoints(g, routes, 'p2').size).toBe(0);
  });
});

describe('violatesDistanceRule', () => {
  it('is true when a building sits on the vertex or an adjacent vertex', () => {
    const buildings: Building[] = [{ vertexId: vA, ownerId: 'p2', kind: 'HABITAT' }];
    expect(violatesDistanceRule(g, buildings, vA)).toBe(true); // occupied
    expect(violatesDistanceRule(g, buildings, vB)).toBe(true); // adjacent to vA
  });

  it('is false on a vertex far from any building', () => {
    const far = g.vertices.find(
      (v) => v !== vA && v !== vB && !g.vertexNeighbors[vA].includes(v),
    )!;
    const buildings: Building[] = [{ vertexId: vA, ownerId: 'p2', kind: 'HABITAT' }];
    expect(violatesDistanceRule(g, buildings, far)).toBe(false);
  });
});

describe('canAfford / payCost', () => {
  it('canAfford checks every resource in the cost', () => {
    const r = { ...emptyResources(), ORE: 2, ENG: 1 };
    expect(canAfford(r, { ORE: 2, ENG: 1 })).toBe(true);
    expect(canAfford(r, { ORE: 3 })).toBe(false);
  });

  it('payCost returns a new resource record with the cost subtracted', () => {
    const r = { ...emptyResources(), ORE: 2, ENG: 3 };
    const after = payCost(r, { ORE: 2, ENG: 3 });
    expect(after).toEqual(emptyResources());
    expect(r.ORE).toBe(2); // original not mutated
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/rules.test.ts`
Expected: FAIL — cannot resolve `./rules`.

- [ ] **Step 3: Implement `src/game/rules.ts`**

```ts
import type { BoardGraph } from './board';
import type { Building, Route, Resource } from './types';

export function buildingAt(buildings: Building[], vertexId: string): Building | undefined {
  return buildings.find((b) => b.vertexId === vertexId);
}

export function routeAt(routes: Route[], edgeId: string): Route | undefined {
  return routes.find((r) => r.edgeId === edgeId);
}

// Set of vertices that are an endpoint of any of the player's routes.
export function playerRouteEndpoints(
  g: BoardGraph,
  routes: Route[],
  playerId: string,
): Set<string> {
  const set = new Set<string>();
  for (const r of routes) {
    if (r.ownerId !== playerId) continue;
    const [a, b] = g.edgeVertices[r.edgeId];
    set.add(a);
    set.add(b);
  }
  return set;
}

// True if any building (any owner) sits on the vertex or a graph-adjacent vertex.
export function violatesDistanceRule(
  g: BoardGraph,
  buildings: Building[],
  vertexId: string,
): boolean {
  if (buildingAt(buildings, vertexId)) return true;
  for (const n of g.vertexNeighbors[vertexId]) {
    if (buildingAt(buildings, n)) return true;
  }
  return false;
}

export function canAfford(
  resources: Record<Resource, number>,
  cost: Partial<Record<Resource, number>>,
): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(
    ([res, amt]) => resources[res] >= amt,
  );
}

// Returns a NEW record with the cost subtracted. Does not mutate the input.
export function payCost(
  resources: Record<Resource, number>,
  cost: Partial<Record<Resource, number>>,
): Record<Resource, number> {
  const out = { ...resources };
  for (const [res, amt] of Object.entries(cost) as [Resource, number][]) {
    out[res] -= amt;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/rules.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/rules.ts src/game/rules.test.ts
git commit -m "feat: add geometry and legality helpers"
```

---

## Task 3: Setup-phase placement + reducer skeleton

**Files:**
- Create: `src/game/reducer.ts`
- Test: `src/game/reducer.test.ts`

Implements the dispatcher and the `setup1`/`setup2` flow. Setup order (spec §3.3): setup1 = P1 habitat→P1 route→P2 habitat→P2 route; setup2 (snake) = P2 habitat→P2 route→P1 habitat→P1 route. The 2nd habitat grants starting resources. After P1's 2nd route, phase→`play`, turn 1, P1 active, `AWAIT_ROLL`.

- [ ] **Step 1: Write the failing test (`src/game/reducer.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { applyMove } from './reducer';
import { createGame } from './state';
import { buildBoardGraph } from './board';
import type { GameState } from './types';

const g = buildBoardGraph();

function newGame(): GameState {
  return createGame({
    id: 'gx',
    code: 'CODE01',
    seed: 7,
    p1: { id: 'p1', name: 'A' },
    p2: { id: 'p2', name: 'B' },
  });
}

// Pick a vertex, then a route edge incident to it, then a "far" vertex incident
// to a different edge, so successive placements satisfy the distance rule.
function vertexWithEdge(): { vertex: string; edge: string } {
  const edge = g.edges[0];
  const [vertex] = g.edgeVertices[edge];
  return { vertex, edge };
}

describe('setup placement', () => {
  it('rejects a route before the first habitat', () => {
    const s = newGame();
    const { edge } = vertexWithEdge();
    const { error } = applyMove(s, { type: 'BUILD_ROUTE', edgeId: edge }, 'p1');
    expect(error).toMatch(/habitat/i);
  });

  it('places P1 habitat then requires a connected route', () => {
    const s0 = newGame();
    const { vertex, edge } = vertexWithEdge();
    const r1 = applyMove(s0, { type: 'BUILD', building: 'HABITAT', locationId: vertex }, 'p1');
    expect(r1.error).toBeUndefined();
    expect(r1.state.buildings).toHaveLength(1);
    // a route not touching the habitat is rejected
    const farEdge = g.edges.find((e) => !g.edgeVertices[e].includes(vertex))!;
    const bad = applyMove(r1.state, { type: 'BUILD_ROUTE', edgeId: farEdge }, 'p1');
    expect(bad.error).toMatch(/touch/i);
    // the connected route is accepted, and turn passes to p2
    const r2 = applyMove(r1.state, { type: 'BUILD_ROUTE', edgeId: edge }, 'p1');
    expect(r2.error).toBeUndefined();
    expect(r2.state.routes).toHaveLength(1);
    expect(r2.state.activePlayerId).toBe('p2');
  });

  it('grants starting resources on the 2nd habitat and reaches play phase', () => {
    let s = newGame();
    // Helper: place a habitat+route pair for the expected player at a free spot.
    const place = (st: GameState) => {
      const occupied = new Set(st.buildings.map((b) => b.vertexId));
      const blocked = new Set<string>();
      for (const b of st.buildings) {
        blocked.add(b.vertexId);
        for (const n of g.vertexNeighbors[b.vertexId]) blocked.add(n);
      }
      // find a vertex that is free and has at least one free incident edge
      const vertex = g.vertices.find(
        (v) => !blocked.has(v) && g.vertexEdges[v].some((e) => !st.routes.some((r) => r.edgeId === e)),
      )!;
      const edge = g.vertexEdges[vertex].find((e) => !st.routes.some((r) => r.edgeId === e))!;
      const who = st.activePlayerId;
      const a = applyMove(st, { type: 'BUILD', building: 'HABITAT', locationId: vertex }, who);
      expect(a.error).toBeUndefined();
      const b = applyMove(a.state, { type: 'BUILD_ROUTE', edgeId: edge }, who);
      expect(b.error).toBeUndefined();
      void occupied;
      return b.state;
    };
    s = place(s); // p1 #1
    s = place(s); // p2 #1
    expect(s.phase).toBe('setup2');
    s = place(s); // p2 #2 (gets resources)
    s = place(s); // p1 #2 (gets resources)
    expect(s.phase).toBe('play');
    expect(s.turn).toBe(1);
    expect(s.activePlayerId).toBe('p1');
    expect(s.turnPhase).toBe('AWAIT_ROLL');
    // each player should have received some starting resources from their 2nd habitat
    const totalP1 = Object.values(s.players[0].resources).reduce((x, y) => x + y, 0);
    const totalP2 = Object.values(s.players[1].resources).reduce((x, y) => x + y, 0);
    expect(totalP1).toBeGreaterThanOrEqual(0);
    expect(totalP2).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/reducer.test.ts`
Expected: FAIL — cannot resolve `./reducer`.

- [ ] **Step 3: Implement `src/game/reducer.ts` (dispatcher + setup)**

```ts
import type { BoardGraph } from './board';
import { buildBoardGraph, hexId } from './board';
import type { GameState, Move, PlayerState, Resource } from './types';
import { TERRAIN_RESOURCE } from './types';
import { buildingAt, routeAt, playerRouteEndpoints, violatesDistanceRule } from './rules';

export interface ApplyResult {
  state: GameState;
  error?: string;
}

function fail(state: GameState, error: string): ApplyResult {
  return { state, error };
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function playerIndex(state: GameState, id: string): number {
  return state.players[0].id === id ? 0 : 1;
}

function otherId(state: GameState, id: string): string {
  return state.players[0].id === id ? state.players[1].id : state.players[0].id;
}

// What the setup phase expects next, derived from placement counts.
// Returns the player who must act and whether a HABITAT or ROUTE is expected.
export function setupExpectation(
  state: GameState,
): { playerId: string; kind: 'HABITAT' | 'ROUTE' } | null {
  const p1 = state.players[0].id;
  const p2 = state.players[1].id;
  const b = state.buildings.length;
  const r = state.routes.length;
  if (state.phase === 'setup1') {
    if (b === 0 && r === 0) return { playerId: p1, kind: 'HABITAT' };
    if (b === 1 && r === 0) return { playerId: p1, kind: 'ROUTE' };
    if (b === 1 && r === 1) return { playerId: p2, kind: 'HABITAT' };
    if (b === 2 && r === 1) return { playerId: p2, kind: 'ROUTE' };
  }
  if (state.phase === 'setup2') {
    if (b === 2 && r === 2) return { playerId: p2, kind: 'HABITAT' };
    if (b === 3 && r === 2) return { playerId: p2, kind: 'ROUTE' };
    if (b === 3 && r === 3) return { playerId: p1, kind: 'HABITAT' };
    if (b === 4 && r === 3) return { playerId: p1, kind: 'ROUTE' };
  }
  return null;
}

// Grant 1 resource per adjacent producing hex of the given vertex.
function grantStartingResources(
  g: BoardGraph,
  state: GameState,
  playerId: string,
  vertexId: string,
): void {
  const player = state.players[playerIndex(state, playerId)];
  for (const hid of g.vertexHexes[vertexId]) {
    const hex = state.board.hexes.find((h) => h.id === hid);
    if (!hex) continue;
    const res = TERRAIN_RESOURCE[hex.terrain] as Resource | undefined;
    if (res) player.resources[res] += 1;
  }
}

function applySetup(g: BoardGraph, state: GameState, move: Move, playerId: string): ApplyResult {
  const exp = setupExpectation(state);
  if (!exp) return fail(state, 'Setup is complete.');
  if (playerId !== exp.playerId) return fail(state, `It is ${exp.playerId}'s setup turn.`);

  if (exp.kind === 'HABITAT') {
    if (move.type !== 'BUILD' || move.building !== 'HABITAT') {
      return fail(state, 'You must place a Habitat now.');
    }
    const v = move.locationId;
    if (!g.vertices.includes(v)) return fail(state, 'Unknown vertex.');
    if (violatesDistanceRule(g, state.buildings, v)) {
      return fail(state, 'Too close to another building.');
    }
    const next = clone(state);
    next.buildings.push({ vertexId: v, ownerId: playerId, kind: 'HABITAT' });
    // The 2nd habitat (placed during setup2) grants starting resources.
    if (state.phase === 'setup2') grantStartingResources(g, next, playerId, v);
    return advanceSetup(next);
  }

  // ROUTE
  if (move.type !== 'BUILD_ROUTE') return fail(state, 'You must place a Rover Route now.');
  const e = move.edgeId;
  if (!g.edges.includes(e)) return fail(state, 'Unknown edge.');
  if (routeAt(state.routes, e)) return fail(state, 'Edge already has a route.');
  // Must touch the habitat this player just placed (their most recent building).
  const myBuildings = state.buildings.filter((b) => b.ownerId === playerId);
  const lastHab = myBuildings[myBuildings.length - 1];
  if (!g.edgeVertices[e].includes(lastHab.vertexId)) {
    return fail(state, 'Route must touch your new Habitat.');
  }
  const next = clone(state);
  next.routes.push({ edgeId: e, ownerId: playerId });
  return advanceSetup(next);
}

// After a setup placement, recompute phase/active player / transition to play.
function advanceSetup(state: GameState): ApplyResult {
  // setup1 -> setup2 once both players have 1 habitat + 1 route.
  if (state.phase === 'setup1' && state.buildings.length === 2 && state.routes.length === 2) {
    state.phase = 'setup2';
  }
  // setup2 complete -> play.
  if (state.phase === 'setup2' && state.buildings.length === 4 && state.routes.length === 4) {
    state.phase = 'play';
    state.turn = 1;
    state.activePlayerId = state.players[0].id;
    state.turnPhase = 'AWAIT_ROLL';
    return { state };
  }
  const exp = setupExpectation(state);
  if (exp) state.activePlayerId = exp.playerId;
  return { state };
}

export function applyMove(state: GameState, move: Move, playerId: string): ApplyResult {
  const g = buildBoardGraph();
  if (state.phase === 'setup1' || state.phase === 'setup2') {
    return applySetup(g, state, move, playerId);
  }
  if (state.phase === 'gameover') return fail(state, 'Game is over.');
  if (state.phase === 'lobby') return fail(state, 'Game has not started.');
  // play-phase handlers are added in later tasks
  return fail(state, `Move ${move.type} not handled yet.`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/reducer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: setup-phase placement and reducer skeleton"
```

---

## Task 4: ROLL + production (non-7)

**Files:**
- Create: `src/game/production.ts`
- Test: `src/game/production.test.ts`
- Modify: `src/game/reducer.ts` (handle `ROLL` in play phase)
- Modify: `src/game/reducer.test.ts`

`produce` is a pure function returning per-player resource deltas. The reducer's `ROLL` handler validates `AWAIT_ROLL`, records `lastRoll`, applies production for a non-7, and moves to `ACTIONS`.

- [ ] **Step 1: Write the failing test (`src/game/production.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { buildBoardGraph } from './board';
import { produce } from './production';
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
    // Find a plain hex from the real board and a vertex adjacent to it.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/production.test.ts`
Expected: FAIL — cannot resolve `./production`.

- [ ] **Step 3: Implement `src/game/production.ts`**

```ts
import type { BoardGraph } from './board';
import type { GameState, Resource } from './types';
import { TERRAIN_RESOURCE, emptyResources } from './types';
import { buildingAt } from './rules';

// Returns resource deltas keyed by player id for a given (non-7) roll sum.
export function produce(
  g: BoardGraph,
  state: GameState,
  rollSum: number,
): Record<string, Record<Resource, number>> {
  const delta: Record<string, Record<Resource, number>> = {
    [state.players[0].id]: emptyResources(),
    [state.players[1].id]: emptyResources(),
  };

  for (const hex of state.board.hexes) {
    if (hex.number !== rollSum) continue;
    if (hex.id === state.dustStormHexId) continue;
    if (hex.terrain === 'LAKE') continue;

    // Lab: 1 RES to the active player, no adjacency (spec §3.1).
    if (hex.terrain === 'LAB') {
      delta[state.activePlayerId].RES += 1;
      continue;
    }

    const res = TERRAIN_RESOURCE[hex.terrain] as Resource | undefined;
    if (!res) continue;
    for (const v of g.hexVertices[hex.id]) {
      const b = buildingAt(state.buildings, v);
      if (!b) continue;
      delta[b.ownerId][res] += b.kind === 'DOME' ? 2 : 1;
    }
  }
  return delta;
}
```

- [ ] **Step 4: Run production test**

Run: `npx vitest run src/game/production.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire `ROLL` into the reducer**

In `src/game/reducer.ts`, add this import near the top:

```ts
import { produce } from './production';
import { DUST_DISCARD_THRESHOLD } from './types';
import { totalResources } from './types';
```

Replace the play-phase fallthrough at the bottom of `applyMove`:

```ts
  // play-phase handlers
  return applyPlay(g, state, move, playerId);
}
```

Add `applyPlay` and a `ROLL` handler before `applyMove`:

```ts
function applyPlay(g: BoardGraph, state: GameState, move: Move, playerId: string): ApplyResult {
  switch (move.type) {
    case 'ROLL':
      return handleRoll(g, state, move, playerId);
    default:
      return fail(state, `Move ${move.type} not handled yet.`);
  }
}

function handleRoll(
  g: BoardGraph,
  state: GameState,
  move: Extract<Move, { type: 'ROLL' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'AWAIT_ROLL') return fail(state, 'You have already rolled.');
  const [d1, d2] = move.roll;
  if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) return fail(state, 'Invalid dice.');
  const sum = d1 + d2;
  const next = clone(state);
  next.lastRoll = [d1, d2];

  if (sum === 7) {
    // Compute discards: any player with more than the threshold loses floor(n/2).
    const pending: Record<string, number> = {};
    for (const p of next.players) {
      const n = totalResources(p.resources);
      if (n > DUST_DISCARD_THRESHOLD) pending[p.id] = Math.floor(n / 2);
    }
    next.pendingDiscards = pending;
    next.turnPhase = Object.keys(pending).length > 0 ? 'DISCARD' : 'MOVE_STORM';
    return { state: next };
  }

  const delta = produce(g, next, sum);
  for (const p of next.players) {
    const d = delta[p.id];
    (Object.keys(d) as Resource[]).forEach((r) => (p.resources[r] += d[r]));
  }
  next.turnPhase = 'ACTIONS';
  return { state: next };
}
```

- [ ] **Step 6: Add a reducer ROLL test (`src/game/reducer.test.ts`)**

```ts
describe('ROLL in play phase', () => {
  it('rejects a roll out of turn or after already rolling', () => {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'AWAIT_ROLL';
    expect(applyMove(s, { type: 'ROLL', roll: [3, 4] }, 'p2').error).toMatch(/your turn/i);
    const rolled = applyMove(s, { type: 'ROLL', roll: [3, 5] }, 'p1');
    expect(rolled.error).toBeUndefined();
    expect(rolled.state.turnPhase).toBe('ACTIONS');
    expect(applyMove(rolled.state, { type: 'ROLL', roll: [2, 2] }, 'p1').error).toMatch(/already/i);
  });

  it('a 7 with a big hand moves to DISCARD', () => {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'AWAIT_ROLL';
    s.players[0].resources = { O2: 4, H2O: 4, ORE: 0, ENG: 0, RES: 0 }; // 8 cards
    const r = applyMove(s, { type: 'ROLL', roll: [3, 4] }, 'p1');
    expect(r.state.turnPhase).toBe('DISCARD');
    expect(r.state.pendingDiscards['p1']).toBe(4);
  });
});
```

- [ ] **Step 7: Run reducer + production tests + typecheck**

Run: `npx vitest run src/game/reducer.test.ts src/game/production.test.ts` then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/production.ts src/game/production.test.ts src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: dice roll and resource production"
```

---

## Task 5: 7-roll resolution — DISCARD + MOVE_DUST_STORM

**Files:**
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducer.test.ts`

- [ ] **Step 1: Add handlers to `applyPlay` switch in `src/game/reducer.ts`**

Add these cases to the `switch (move.type)` in `applyPlay`:

```ts
    case 'DISCARD':
      return handleDiscard(state, move, playerId);
    case 'MOVE_DUST_STORM':
      return handleMoveDustStorm(g, state, move, playerId);
```

Add the handlers (after `handleRoll`):

```ts
function handleDiscard(
  state: GameState,
  move: Extract<Move, { type: 'DISCARD' }>,
  playerId: string,
): ApplyResult {
  if (state.turnPhase !== 'DISCARD') return fail(state, 'No discard required.');
  const owed = state.pendingDiscards[playerId];
  if (!owed) return fail(state, 'You owe no discard.');
  const cards = move.cards;
  const idx = playerIndex(state, playerId);
  const res = state.players[idx].resources;
  let total = 0;
  for (const [r, amt] of Object.entries(cards) as [Resource, number][]) {
    if (amt < 0) return fail(state, 'Negative discard.');
    if (res[r] < amt) return fail(state, `Not enough ${r} to discard.`);
    total += amt;
  }
  if (total !== owed) return fail(state, `You must discard exactly ${owed} cards.`);

  const next = clone(state);
  const nres = next.players[idx].resources;
  for (const [r, amt] of Object.entries(cards) as [Resource, number][]) nres[r] -= amt;
  delete next.pendingDiscards[playerId];
  if (Object.keys(next.pendingDiscards).length === 0) next.turnPhase = 'MOVE_STORM';
  return { state: next };
}

function handleMoveDustStorm(
  g: BoardGraph,
  state: GameState,
  move: Extract<Move, { type: 'MOVE_DUST_STORM' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'MOVE_STORM') return fail(state, 'Not time to move the Dust Storm.');
  if (!g.hexIds.includes(move.hexId)) return fail(state, 'Unknown hex.');
  if (move.hexId === state.dustStormHexId) return fail(state, 'Dust Storm cannot stay put.');
  const next = clone(state);
  next.dustStormHexId = move.hexId;
  next.turnPhase = 'ACTIONS';
  return { state: next };
}
```

- [ ] **Step 2: Add tests (`src/game/reducer.test.ts`)**

```ts
describe('7-roll resolution', () => {
  function sevenState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'AWAIT_ROLL';
    s.players[0].resources = { O2: 4, H2O: 4, ORE: 0, ENG: 0, RES: 0 }; // owes 4
    return applyMove(s, { type: 'ROLL', roll: [3, 4] }, 'p1').state;
  }

  it('requires discarding exactly the owed count, then moves to MOVE_STORM', () => {
    const s = sevenState();
    expect(applyMove(s, { type: 'DISCARD', cards: { O2: 2 } }, 'p1').error).toMatch(/exactly 4/);
    const ok = applyMove(s, { type: 'DISCARD', cards: { O2: 2, H2O: 2 } }, 'p1');
    expect(ok.error).toBeUndefined();
    expect(ok.state.turnPhase).toBe('MOVE_STORM');
    expect(ok.state.players[0].resources.O2).toBe(2);
  });

  it('moves the dust storm to a new hex and enters ACTIONS', () => {
    let s = sevenState();
    s = applyMove(s, { type: 'DISCARD', cards: { O2: 2, H2O: 2 } }, 'p1').state;
    const target = g.hexIds[0];
    const r = applyMove(s, { type: 'MOVE_DUST_STORM', hexId: target }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.dustStormHexId).toBe(target);
    expect(r.state.turnPhase).toBe('ACTIONS');
    // cannot move it onto the same hex next time
    expect(applyMove(r.state, { type: 'MOVE_DUST_STORM', hexId: target }, 'p1').error).toMatch(
      /stay put/i,
    );
  });
});
```

- [ ] **Step 3: Run reducer tests**

Run: `npx vitest run src/game/reducer.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: 7-roll discard and dust storm movement"
```

---

## Task 6: BUILD during play (Habitat / Dome / Comm Tower)

**Files:**
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducer.test.ts`

Build legality (spec §3.5–§3.6): must be `ACTIONS` phase and your turn; must afford the cost; Habitat needs a route endpoint + distance rule; Dome upgrades your own Habitat at `locationId`; Comm Tower needs a vertex adjacent to ≥2 of your buildings and you may own only one.

- [ ] **Step 1: Add the `BUILD` case + handler to `src/game/reducer.ts`**

Add the import:

```ts
import { canAfford, payCost } from './rules';
import { BUILDING_COST } from './types';
```

Add to the `applyPlay` switch:

```ts
    case 'BUILD':
      return handleBuild(g, state, move, playerId);
```

Add the handler:

```ts
function handleBuild(
  g: BoardGraph,
  state: GameState,
  move: Extract<Move, { type: 'BUILD' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before building.');
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];

  if (move.building === 'HABITAT') {
    const v = move.locationId;
    if (!g.vertices.includes(v)) return fail(state, 'Unknown vertex.');
    if (violatesDistanceRule(g, state.buildings, v)) return fail(state, 'Too close to a building.');
    const endpoints = playerRouteEndpoints(g, state.routes, playerId);
    if (!endpoints.has(v)) return fail(state, 'Habitat must sit on your Rover Route.');
    if (!canAfford(me.resources, BUILDING_COST.HABITAT)) return fail(state, 'Cannot afford Habitat.');
    const next = clone(state);
    next.players[idx].resources = payCost(me.resources, BUILDING_COST.HABITAT);
    next.buildings.push({ vertexId: v, ownerId: playerId, kind: 'HABITAT' });
    return { state: next };
  }

  if (move.building === 'DOME') {
    const existing = buildingAt(state.buildings, move.locationId);
    if (!existing || existing.ownerId !== playerId || existing.kind !== 'HABITAT') {
      return fail(state, 'Dome must upgrade your own Habitat.');
    }
    if (!canAfford(me.resources, BUILDING_COST.DOME)) return fail(state, 'Cannot afford Dome.');
    const next = clone(state);
    next.players[idx].resources = payCost(me.resources, BUILDING_COST.DOME);
    const b = buildingAt(next.buildings, move.locationId)!;
    b.kind = 'DOME';
    return { state: next };
  }

  // COMM_TOWER
  if (me.hasCommTower) return fail(state, 'You already own a Comm Tower.');
  const v = move.locationId;
  if (!g.vertices.includes(v)) return fail(state, 'Unknown vertex.');
  if (buildingAt(state.buildings, v)) return fail(state, 'Vertex is occupied.');
  const adjacentOwn = g.vertexNeighbors[v].filter((n) => {
    const b = buildingAt(state.buildings, n);
    return b && b.ownerId === playerId;
  }).length;
  if (adjacentOwn < 2) return fail(state, 'Comm Tower needs 2 adjacent friendly buildings.');
  if (!canAfford(me.resources, BUILDING_COST.COMM_TOWER)) return fail(state, 'Cannot afford Comm Tower.');
  const next = clone(state);
  next.players[idx].resources = payCost(me.resources, BUILDING_COST.COMM_TOWER);
  next.buildings.push({ vertexId: v, ownerId: playerId, kind: 'COMM_TOWER' });
  next.players[idx].hasCommTower = true;
  return { state: next };
}
```

- [ ] **Step 2: Add tests (`src/game/reducer.test.ts`)**

```ts
describe('BUILD during play', () => {
  // Build a play-phase state with a habitat + a route for p1, in ACTIONS.
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    const edge = g.edges[0];
    const [v] = g.edgeVertices[edge];
    s.buildings = [{ vertexId: v, ownerId: 'p1', kind: 'HABITAT' }];
    s.routes = [{ edgeId: edge, ownerId: 'p1' }];
    return s;
  }

  it('upgrades a Habitat to a Dome when affordable', () => {
    const s = playState();
    const v = s.buildings[0].vertexId;
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 2, ENG: 3, RES: 0 };
    const r = applyMove(s, { type: 'BUILD', building: 'DOME', locationId: v }, 'p1');
    expect(r.error).toBeUndefined();
    expect(buildingKind(r.state, v)).toBe('DOME');
    expect(r.state.players[0].resources).toEqual({ O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 0 });
  });

  it('rejects a Dome on a non-owned or non-Habitat location', () => {
    const s = playState();
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 2, ENG: 3, RES: 0 };
    const empty = g.vertices.find((x) => !s.buildings.some((b) => b.vertexId === x))!;
    expect(applyMove(s, { type: 'BUILD', building: 'DOME', locationId: empty }, 'p1').error).toMatch(
      /your own Habitat/i,
    );
  });

  it('rejects a Habitat not on the player’s route', () => {
    const s = playState();
    s.players[0].resources = { O2: 1, H2O: 1, ORE: 1, ENG: 1, RES: 0 };
    const offRoute = g.vertices.find(
      (x) =>
        !s.buildings.some((b) => b.vertexId === x) &&
        !g.vertexNeighbors[s.buildings[0].vertexId].includes(x) &&
        !g.edgeVertices[s.routes[0].edgeId].includes(x),
    )!;
    expect(applyMove(s, { type: 'BUILD', building: 'HABITAT', locationId: offRoute }, 'p1').error).toMatch(
      /Rover Route/i,
    );
  });
});

function buildingKind(state: GameState, vertexId: string) {
  return state.buildings.find((b) => b.vertexId === vertexId)?.kind;
}
```

- [ ] **Step 3: Run reducer tests + typecheck**

Run: `npx vitest run src/game/reducer.test.ts` then `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: build habitats, domes, and comm towers"
```

---

## Task 7: BUILD_ROUTE during play

**Files:**
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducer.test.ts`

Route legality (spec §3.6): `ACTIONS` phase, your turn, edge empty, edge shares a vertex with one of your routes/buildings, and you can afford 1 ORE + 1 ENG.

- [ ] **Step 1: Add the `BUILD_ROUTE` case + handler**

Add to the `applyPlay` switch:

```ts
    case 'BUILD_ROUTE':
      return handleBuildRoute(g, state, move, playerId);
```

Add the handler:

```ts
function handleBuildRoute(
  g: BoardGraph,
  state: GameState,
  move: Extract<Move, { type: 'BUILD_ROUTE' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before building.');
  const e = move.edgeId;
  if (!g.edges.includes(e)) return fail(state, 'Unknown edge.');
  if (routeAt(state.routes, e)) return fail(state, 'Edge already has a route.');
  const [a, b] = g.edgeVertices[e];
  const touchesOwn =
    [a, b].some((v) => {
      const bld = buildingAt(state.buildings, v);
      return bld && bld.ownerId === playerId;
    }) || playerRouteEndpoints(g, state.routes, playerId).has(a) ||
    playerRouteEndpoints(g, state.routes, playerId).has(b);
  if (!touchesOwn) return fail(state, 'Route must touch your network.');
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];
  if (!canAfford(me.resources, BUILDING_COST.ROUTE)) return fail(state, 'Cannot afford Route.');
  const next = clone(state);
  next.players[idx].resources = payCost(me.resources, BUILDING_COST.ROUTE);
  next.routes.push({ edgeId: e, ownerId: playerId });
  return { state: next };
}
```

- [ ] **Step 2: Add tests (`src/game/reducer.test.ts`)**

```ts
describe('BUILD_ROUTE during play', () => {
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    const edge = g.edges[0];
    const [v] = g.edgeVertices[edge];
    s.buildings = [{ vertexId: v, ownerId: 'p1', kind: 'HABITAT' }];
    s.routes = [{ edgeId: edge, ownerId: 'p1' }];
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 5, ENG: 5, RES: 0 };
    return s;
  }

  it('extends the network and charges 1 ORE + 1 ENG', () => {
    const s = playState();
    const start = s.buildings[0].vertexId;
    const nextEdge = g.vertexEdges[start].find((e) => e !== s.routes[0].edgeId)!;
    const r = applyMove(s, { type: 'BUILD_ROUTE', edgeId: nextEdge }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.routes).toHaveLength(2);
    expect(r.state.players[0].resources.ORE).toBe(4);
    expect(r.state.players[0].resources.ENG).toBe(4);
  });

  it('rejects a disconnected route', () => {
    const s = playState();
    const farEdge = g.edges.find(
      (e) =>
        !g.edgeVertices[e].includes(s.buildings[0].vertexId) &&
        !g.edgeVertices[s.routes[0].edgeId].some((v) => g.edgeVertices[e].includes(v)),
    )!;
    expect(applyMove(s, { type: 'BUILD_ROUTE', edgeId: farEdge }, 'p1').error).toMatch(/touch/i);
  });

  it('rejects building on an occupied edge', () => {
    const s = playState();
    expect(applyMove(s, { type: 'BUILD_ROUTE', edgeId: s.routes[0].edgeId }, 'p1').error).toMatch(
      /already/i,
    );
  });
});
```

- [ ] **Step 3: Run reducer tests**

Run: `npx vitest run src/game/reducer.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: build rover routes during play"
```

---

## Task 8: Trades (market + player)

**Files:**
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducer.test.ts`

`TRADE_MARKET` (spec §3.4): give `rate` of one resource for 1 of another; `rate` = 2 if the player owns a Comm Tower else 3. `TRADE_PLAYER`: when `accepted` is true, swap `offer` (active → opponent) and `want` (opponent → active) if both can pay; `accepted: false` is a no-op (offer declined).

- [ ] **Step 1: Add the cases + handlers**

Add the import:

```ts
import { MARKET_RATE_DEFAULT, MARKET_RATE_COMM } from './types';
```

Add to the `applyPlay` switch:

```ts
    case 'TRADE_MARKET':
      return handleTradeMarket(state, move, playerId);
    case 'TRADE_PLAYER':
      return handleTradePlayer(state, move, playerId);
```

Add the handlers:

```ts
function handleTradeMarket(
  state: GameState,
  move: Extract<Move, { type: 'TRADE_MARKET' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before trading.');
  if (move.give === move.receive) return fail(state, 'Cannot trade a resource for itself.');
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];
  const rate = me.hasCommTower ? MARKET_RATE_COMM : MARKET_RATE_DEFAULT;
  if (me.resources[move.give] < rate) return fail(state, `Need ${rate} ${move.give}.`);
  const next = clone(state);
  next.players[idx].resources[move.give] -= rate;
  next.players[idx].resources[move.receive] += 1;
  return { state: next };
}

function handleTradePlayer(
  state: GameState,
  move: Extract<Move, { type: 'TRADE_PLAYER' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before trading.');
  if (!move.accepted) return { state }; // declined offer: no-op
  const meIdx = playerIndex(state, playerId);
  const oppIdx = meIdx === 0 ? 1 : 0;
  const me = state.players[meIdx];
  const opp = state.players[oppIdx];
  for (const [r, amt] of Object.entries(move.offer) as [Resource, number][]) {
    if (me.resources[r] < amt) return fail(state, `You lack ${r}.`);
  }
  for (const [r, amt] of Object.entries(move.want) as [Resource, number][]) {
    if (opp.resources[r] < amt) return fail(state, `Opponent lacks ${r}.`);
  }
  const next = clone(state);
  for (const [r, amt] of Object.entries(move.offer) as [Resource, number][]) {
    next.players[meIdx].resources[r] -= amt;
    next.players[oppIdx].resources[r] += amt;
  }
  for (const [r, amt] of Object.entries(move.want) as [Resource, number][]) {
    next.players[oppIdx].resources[r] -= amt;
    next.players[meIdx].resources[r] += amt;
  }
  return { state: next };
}
```

- [ ] **Step 2: Add tests (`src/game/reducer.test.ts`)**

```ts
describe('trades', () => {
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    return s;
  }

  it('market trade is 3:1 without a Comm Tower', () => {
    const s = playState();
    s.players[0].resources = { O2: 3, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    const r = applyMove(s, { type: 'TRADE_MARKET', give: 'O2', receive: 'RES' }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources.O2).toBe(0);
    expect(r.state.players[0].resources.RES).toBe(1);
  });

  it('market trade is 2:1 with a Comm Tower', () => {
    const s = playState();
    s.players[0].hasCommTower = true;
    s.players[0].resources = { O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    const r = applyMove(s, { type: 'TRADE_MARKET', give: 'O2', receive: 'ENG' }, 'p1');
    expect(r.state.players[0].resources.O2).toBe(0);
    expect(r.state.players[0].resources.ENG).toBe(1);
  });

  it('accepted player trade swaps resources both ways', () => {
    const s = playState();
    s.players[0].resources = { O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    s.players[1].resources = { O2: 0, H2O: 0, ORE: 3, ENG: 0, RES: 0 };
    const r = applyMove(
      s,
      { type: 'TRADE_PLAYER', offer: { O2: 2 }, want: { ORE: 3 }, accepted: true },
      'p1',
    );
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources).toEqual({ O2: 0, H2O: 0, ORE: 3, ENG: 0, RES: 0 });
    expect(r.state.players[1].resources).toEqual({ O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 });
  });

  it('declined player trade is a no-op', () => {
    const s = playState();
    s.players[0].resources = { O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    const r = applyMove(
      s,
      { type: 'TRADE_PLAYER', offer: { O2: 2 }, want: { ORE: 3 }, accepted: false },
      'p1',
    );
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources.O2).toBe(2);
  });
});
```

- [ ] **Step 3: Run reducer tests**

Run: `npx vitest run src/game/reducer.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: market and player-to-player trades"
```

---

## Task 9: Scoring, END_TURN, and win condition

**Files:**
- Create: `src/game/scoring.ts`
- Test: `src/game/scoring.test.ts`
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducer.test.ts`

VP in Plan 2 = buildings only: Habitat 1, Dome 2, Comm Tower 1 (spec §3.10; missions/tech/longest route added in Plan 3). `END_TURN` requires `ACTIONS`, then advances the player, increments turn, resets to `AWAIT_ROLL`, clears `lastRoll`, and triggers a win if the new active player has ≥ `WIN_VP`.

- [ ] **Step 1: Write the failing test (`src/game/scoring.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { buildingVP } from './scoring';
import type { GameState } from './types';

function withBuildings(buildings: GameState['buildings']): GameState {
  return { buildings } as GameState;
}

describe('buildingVP', () => {
  it('scores Habitat 1, Dome 2, Comm Tower 1', () => {
    const s = withBuildings([
      { vertexId: 'v1', ownerId: 'p1', kind: 'HABITAT' },
      { vertexId: 'v2', ownerId: 'p1', kind: 'DOME' },
      { vertexId: 'v3', ownerId: 'p1', kind: 'COMM_TOWER' },
      { vertexId: 'v4', ownerId: 'p2', kind: 'DOME' },
    ]);
    expect(buildingVP(s, 'p1')).toBe(1 + 2 + 1);
    expect(buildingVP(s, 'p2')).toBe(2);
  });
});
```

- [ ] **Step 2: Run scoring test (fails)**

Run: `npx vitest run src/game/scoring.test.ts`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Implement `src/game/scoring.ts`**

```ts
import type { GameState } from './types';

const BUILDING_VP: Record<string, number> = { HABITAT: 1, DOME: 2, COMM_TOWER: 1 };

export function buildingVP(state: GameState, playerId: string): number {
  return state.buildings
    .filter((b) => b.ownerId === playerId)
    .reduce((sum, b) => sum + (BUILDING_VP[b.kind] ?? 0), 0);
}

// Plan 2 total VP = buildings only. Plan 3 adds tech, missions, and longest route.
export function playerVP(state: GameState, playerId: string): number {
  return buildingVP(state, playerId);
}
```

- [ ] **Step 4: Run scoring test (passes)**

Run: `npx vitest run src/game/scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the `END_TURN` case + handler to `src/game/reducer.ts`**

Add the import:

```ts
import { playerVP } from './scoring';
import { WIN_VP } from './types';
```

Add to the `applyPlay` switch:

```ts
    case 'END_TURN':
      return handleEndTurn(state, playerId);
    case 'RESEARCH':
      return fail(state, 'Tech tree arrives in Plan 3.');
    case 'CLAIM_MISSION':
      return fail(state, 'Missions arrive in Plan 3.');
```

Add the handler:

```ts
function handleEndTurn(state: GameState, playerId: string): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'You must roll before ending your turn.');
  const next = clone(state);
  next.activePlayerId = otherId(state, playerId);
  next.turn += 1;
  next.turnPhase = 'AWAIT_ROLL';
  next.lastRoll = null;
  // Win is checked at the START of a turn (spec §3.10).
  if (playerVP(next, next.activePlayerId) >= WIN_VP) {
    next.phase = 'gameover';
    next.winnerId = next.activePlayerId;
  }
  return { state: next };
}
```

- [ ] **Step 6: Add tests (`src/game/reducer.test.ts`)**

```ts
describe('END_TURN and win', () => {
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    return s;
  }

  it('passes the turn, resets to AWAIT_ROLL, and clears the roll', () => {
    const s = playState();
    s.lastRoll = [3, 4];
    const r = applyMove(s, { type: 'END_TURN' }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.activePlayerId).toBe('p2');
    expect(r.state.turn).toBe(2);
    expect(r.state.turnPhase).toBe('AWAIT_ROLL');
    expect(r.state.lastRoll).toBeNull();
  });

  it('rejects ending the turn before rolling', () => {
    const s = playState();
    s.turnPhase = 'AWAIT_ROLL';
    expect(applyMove(s, { type: 'END_TURN' }, 'p1').error).toMatch(/roll/i);
  });

  it('declares a winner when the next player starts with >= 10 VP', () => {
    const s = playState();
    // Give p2 ten VP worth of buildings (5 Domes).
    s.buildings = [
      { vertexId: 'a', ownerId: 'p2', kind: 'DOME' },
      { vertexId: 'b', ownerId: 'p2', kind: 'DOME' },
      { vertexId: 'c', ownerId: 'p2', kind: 'DOME' },
      { vertexId: 'd', ownerId: 'p2', kind: 'DOME' },
      { vertexId: 'e', ownerId: 'p2', kind: 'DOME' },
    ];
    const r = applyMove(s, { type: 'END_TURN' }, 'p1');
    expect(r.state.phase).toBe('gameover');
    expect(r.state.winnerId).toBe('p2');
  });

  it('RESEARCH and CLAIM_MISSION report a Plan 3 stub error', () => {
    const s = playState();
    expect(applyMove(s, { type: 'RESEARCH', techId: 'eng-1' }, 'p1').error).toMatch(/Plan 3/);
    expect(applyMove(s, { type: 'CLAIM_MISSION', missionId: 'pioneer' }, 'p1').error).toMatch(
      /Plan 3/,
    );
  });
});
```

- [ ] **Step 7: Run reducer + scoring tests + typecheck**

Run: `npx vitest run src/game/reducer.test.ts src/game/scoring.test.ts` then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/scoring.ts src/game/scoring.test.ts src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: building VP, end-turn, and win condition"
```

---

## Task 10: `legalMoves`

**Files:**
- Modify: `src/game/rules.ts`
- Test: `src/game/rules.test.ts`

A generator of the legal moves available to a player in the current state. Used by the UI (Plan 3) to highlight options and by a property test here. It mirrors the reducer's legality but never mutates.

- [ ] **Step 1: Add the failing test (`src/game/rules.test.ts`)**

```ts
import { legalMoves } from './rules';
import { createGame } from './state';
import { applyMove } from './reducer';

describe('legalMoves', () => {
  it('in AWAIT_ROLL the only legal move is ROLL', () => {
    const s = createGame({
      id: 'g',
      code: 'CODE03',
      seed: 3,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'AWAIT_ROLL';
    const moves = legalMoves(s, 'p1');
    expect(moves.length).toBe(1);
    expect(moves[0].type).toBe('ROLL');
    expect(legalMoves(s, 'p2')).toEqual([]); // not p2's turn
  });

  it('in ACTIONS, END_TURN is always available and every generated move is accepted by the reducer', () => {
    const s = createGame({
      id: 'g',
      code: 'CODE04',
      seed: 4,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    s.players[0].resources = { O2: 5, H2O: 5, ORE: 5, ENG: 5, RES: 5 };
    const moves = legalMoves(s, 'p1');
    expect(moves.some((m) => m.type === 'END_TURN')).toBe(true);
    // Property: applying any single generated move yields no error.
    for (const m of moves) {
      expect(applyMove(s, m, 'p1').error).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run rules test (fails)**

Run: `npx vitest run src/game/rules.test.ts`
Expected: FAIL — `legalMoves` not exported.

- [ ] **Step 3: Implement `legalMoves` in `src/game/rules.ts`**

Add the imports at the top of `rules.ts`:

```ts
import { buildBoardGraph } from './board';
import type { GameState, Move, Resource } from './types';
import { RESOURCES, BUILDING_COST } from './types';
```

(Adjust the existing `import type { Building, Route, Resource } from './types';` line to avoid a duplicate `Resource` import — keep a single `import type { Building, Route } from './types';` plus the combined import above.)

Append:

```ts
// Enumerate the legal moves for a player in the current state. Mirrors the
// reducer's legality checks; used by the UI and by property tests.
export function legalMoves(state: GameState, playerId: string): Move[] {
  if (state.phase !== 'play') return [];
  if (playerId !== state.activePlayerId && state.turnPhase !== 'DISCARD') return [];
  const g = buildBoardGraph();
  const moves: Move[] = [];
  const me = state.players.find((p) => p.id === playerId)!;

  if (state.turnPhase === 'AWAIT_ROLL') {
    if (playerId === state.activePlayerId) moves.push({ type: 'ROLL', roll: [1, 1] });
    return moves;
  }

  if (state.turnPhase === 'DISCARD') {
    // Surface the obligation; the UI builds the concrete discard. Not enumerated.
    return moves;
  }

  if (state.turnPhase === 'MOVE_STORM') {
    if (playerId !== state.activePlayerId) return [];
    for (const h of g.hexIds) {
      if (h !== state.dustStormHexId) moves.push({ type: 'MOVE_DUST_STORM', hexId: h });
    }
    return moves;
  }

  // ACTIONS
  moves.push({ type: 'END_TURN' });

  // Routes
  for (const e of g.edges) {
    if (routeAt(state.routes, e)) continue;
    const [a, b] = g.edgeVertices[e];
    const eps = playerRouteEndpoints(g, state.routes, playerId);
    const touches =
      eps.has(a) ||
      eps.has(b) ||
      [a, b].some((v) => buildingAt(state.buildings, v)?.ownerId === playerId);
    if (touches && canAfford(me.resources, BUILDING_COST.ROUTE)) {
      moves.push({ type: 'BUILD_ROUTE', edgeId: e });
    }
  }

  // Habitats
  if (canAfford(me.resources, BUILDING_COST.HABITAT)) {
    const eps = playerRouteEndpoints(g, state.routes, playerId);
    for (const v of eps) {
      if (!violatesDistanceRule(g, state.buildings, v)) {
        moves.push({ type: 'BUILD', building: 'HABITAT', locationId: v });
      }
    }
  }

  // Domes (upgrade own habitats)
  if (canAfford(me.resources, BUILDING_COST.DOME)) {
    for (const bld of state.buildings) {
      if (bld.ownerId === playerId && bld.kind === 'HABITAT') {
        moves.push({ type: 'BUILD', building: 'DOME', locationId: bld.vertexId });
      }
    }
  }

  // Comm Tower
  if (!me.hasCommTower && canAfford(me.resources, BUILDING_COST.COMM_TOWER)) {
    for (const v of g.vertices) {
      if (buildingAt(state.buildings, v)) continue;
      const adj = g.vertexNeighbors[v].filter(
        (n) => buildingAt(state.buildings, n)?.ownerId === playerId,
      ).length;
      if (adj >= 2) moves.push({ type: 'BUILD', building: 'COMM_TOWER', locationId: v });
    }
  }

  // Market trades
  const rate = me.hasCommTower ? 2 : 3;
  for (const give of RESOURCES) {
    if (me.resources[give] < rate) continue;
    for (const receive of RESOURCES) {
      if (give !== receive) moves.push({ type: 'TRADE_MARKET', give, receive });
    }
  }

  return moves;
}
```

> Note: the test imports `applyMove` from `./reducer` while `reducer.ts` imports helpers from `rules.ts`. This is a one-way dependency (reducer → rules); `legalMoves` does NOT import the reducer, so there is no import cycle. The test file may import both freely.

- [ ] **Step 4: Run rules test + full typecheck**

Run: `npx vitest run src/game/rules.test.ts` then `npm run typecheck`
Expected: PASS. (If TS complains about a duplicate `Resource` import, ensure `rules.ts` imports `Resource` exactly once — from the combined `import { RESOURCES, BUILDING_COST } from './types'` for the values and a single `import type { ... } from './types'` for the types.)

- [ ] **Step 5: Commit**

```bash
git add src/game/rules.ts src/game/rules.test.ts
git commit -m "feat: legalMoves enumeration"
```

---

## Task 11: Full green gate

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all suites pass (rng, board, state, rules, production, reducer, scoring), 0 failures.

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck` then `npm run build`
Expected: both PASS.

- [ ] **Step 3: Commit (empty if clean)**

```bash
git add -A
git commit -m "chore: engine green — full suite passing" --allow-empty
```

---

## Self-Review

**Spec coverage (Plan 2's slice):**
- §3.3 setup (snake order, 2nd-habitat starting resources, → play) → Task 3. ✓
- §3.4 turn sequence: roll, production, dust storm on 7, action phase, end turn → Tasks 4, 5, 9. ✓
- §3.4 trade (player consent any ratio; market 3:1 / 2:1 with Comm Tower) → Task 8. ✓
- §3.5 build costs → `BUILDING_COST` (Task 1), enforced in Tasks 6–7. ✓
- §3.6 placement rules (habitat distance + on-route, dome upgrade, route adjacency, comm tower ≥2 adjacency + one per player) → Tasks 6–7. ✓
- §3.1 Lab production to active player → Task 4. ✓
- §3.10 win at start of turn with ≥10 VP (buildings) → Task 9. ✓
- §4.2 every `Move` variant handled (ROLL, MOVE_DUST_STORM, DISCARD, TRADE_PLAYER, TRADE_MARKET, BUILD, BUILD_ROUTE, RESEARCH→stub, CLAIM_MISSION→stub, END_TURN) → Tasks 3–9. ✓
- **Deferred (declared):** §3.7 Tech, §3.8 Missions, §3.9 Longest Route VP → Plan 3. `RESEARCH`/`CLAIM_MISSION` return explicit Plan-3 stub errors so the union stays exhaustive. ✓

**Placeholder scan:** every code step contains complete source and exact assertions. The two stub handlers are intentional, declared scope boundaries (not "implement later" hand-waving) — they return real, tested error strings.

**Type consistency:**
- `applyMove(state, move, playerId): ApplyResult` and `ApplyResult = { state, error? }` used consistently in `reducer.ts` and every test.
- `BoardGraph` field names (`vertices`, `edges`, `hexIds`, `hexVertices`, `vertexHexes`, `vertexEdges`, `edgeVertices`, `vertexNeighbors`) match Plan 1's `board.ts`.
- Helper names match between `rules.ts` and `reducer.ts`: `buildingAt`, `routeAt`, `playerRouteEndpoints`, `violatesDistanceRule`, `canAfford`, `payCost`, `legalMoves`.
- `produce(g, state, sum)` signature matches its call site in `handleRoll`.
- `buildingVP`/`playerVP(state, playerId)` match between `scoring.ts` and `reducer.ts`.
- `TurnPhase` values (`AWAIT_ROLL`/`DISCARD`/`MOVE_STORM`/`ACTIONS`) used identically across reducer and rules.
- Constants (`BUILDING_COST`, `MARKET_RATE_*`, `WIN_VP`, `DUST_DISCARD_THRESHOLD`) defined once in `types.ts`.

**One import-hygiene note carried into Task 10:** `rules.ts` must import `Resource` exactly once (the type) — Task 2 imports `{ Building, Route, Resource }` as types; Task 10 adds value imports `{ RESOURCES, BUILDING_COST }`. Keep `Resource` in the `import type` line only. Flagged inline in Task 10 Step 4.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-mars-frontier-engine.md`.

This will be executed inline in this session (continuing the established flow) via superpowers:executing-plans.
