# Mars Frontier — Plan 3: Tech, Missions & Longest Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the victory-point modifier layer to the Plan 2 engine — the Tech Tree, Mission Cards, and Longest Route — wiring up the two stubbed moves (`RESEARCH`, `CLAIM_MISSION`) and completing `playerVP`.

**Architecture:** Pure additions over the existing reducer. Tech and mission *data* live in `tech.ts` and `missions.ts` (data-driven definitions). Longest-route graph math and the full VP calculation live in `scoring.ts`. The reducer gains `RESEARCH` and `CLAIM_MISSION` handlers, per-turn/per-game counters in a new `stats` field, and recomputes the longest-route holder after every route placement. Tech effects are applied at their point of use (production, costs, market rate, scoring) via small `hasTech` checks.

**Tech Stack:** TypeScript, Vitest. Builds on Plans 1–2.

**Scope & interpretations (locked):**
- **Tech VP:** each owned tech = 1 VP, **capped at 4 counted** (spec §3.7). Extra techs give effects only.
- **Tech ordering:** within a track you must buy tier N before N+1.
- **Tech effects (deterministic ones, all implemented):**
  - `ENG1` +1 ORE yield from each Ridge (per producing building).
  - `ENG2` Dome costs `1 ORE + 3 ENG` (down from `2 ORE`).
  - `ENG3` first 2 routes you build each turn are free (0 cost).
  - `ENG4` Fortified Dome: your Domes are worth 3 VP.
  - `BIO1` +1 O₂ yield from each Plain (per producing building).
  - `BIO2` ignore the 7-roll discard (you never owe discards).
  - `BIO3` your Habitats/Domes produce all adjacent resources on a 7 (dust/lake still block); stacks with BIO2.
  - `BIO4` Greenhouse: when an Ice hex produces for you, each of your Habitats adjacent to that Ice hex also yields +1 O₂.
  - `ASTRO3` market trades are always 2:1 (like a Comm Tower).
  - `ASTRO4` Solar Array: your Domes yield 3 ENG from Craters (up from 2).
- **Tech effects deferred (researchable, VP counts, effect is a no-op in the engine):** `ASTRO1` re-roll, `ASTRO2` peek top mission. Documented as a known limitation; these are convenience effects with no deterministic resource/VP impact.
- **Longest Route:** the longest single contiguous chain (no edge reused) of a player's routes. A length ≥ 5 makes a player *eligible*; the holder gets **2 VP**. Ties / new contenders only take the title with a strictly longer chain than the current holder (first-to-achieve keeps it). Recomputed after every route placement (setup and play).
- **Missions:** each claimed mission grants its VP (+ optional bonus resources). Claiming is only on your turn, only if the condition currently holds; the claimed card is removed from the board and replaced from the deck. "First to X" is naturally enforced by claim-and-remove (one claimer per card). Mission conditions and rewards per spec §3.8 — exact predicates locked in Task C1.
- **New state:** `GameState.longestRouteHolderId: string | null` and `GameState.stats: Record<playerId, PlayerStats>` (per-game/per-turn counters for missions). `routesThisTurn` resets on `END_TURN`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/game/types.ts` (modify) | Add `PlayerStats`, `GameState.stats`, `GameState.longestRouteHolderId`; `emptyStats()` |
| `src/game/state.ts` (modify) | `createGame` initializes `stats` + `longestRouteHolderId` |
| `src/game/tech.ts` (create) | `TechTrack`, `TechDef`, `TECHS` (12), helpers `techById`, `hasTech`, `nextResearchable` |
| `src/game/missions.ts` (modify) | `MissionDef` + `MISSIONS` (18 defs: condition + vp + bonus); keep `MISSION_IDS` |
| `src/game/scoring.ts` (modify) | `longestRouteLength`, `recomputeLongestRoute`, tech-aware `buildingVP`, `techVP`, `missionVP`, `longestRouteVP`, complete `playerVP` |
| `src/game/production.ts` (modify) | tech-aware yields (ENG1/BIO1/BIO4/ASTRO4); `produceOnSeven` for BIO3 |
| `src/game/reducer.ts` (modify) | `RESEARCH` + `CLAIM_MISSION` handlers; counters; route-cost (ENG2/ENG3); market rate (ASTRO3); 7-roll (BIO2/BIO3); recompute longest route; reset `routesThisTurn` |
| matching `*.test.ts` | Vitest unit tests per module |

---

## Group A — Longest Route

### Task A1: State for stats & longest-route holder

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/state.ts`
- Modify: `src/game/state.test.ts`

- [ ] **Step 1: Add `PlayerStats` + fields to `src/game/types.ts`**

After the `TurnPhase` type add:

```ts
export interface PlayerStats {
  dustPlacements: number; // times this player moved the Dust Storm
  tradesWithOpponent: number; // accepted player-to-player trades
  sevensRolled: number; // 7s this player rolled
  dustDamageTaken: number; // times this player completed a 7-roll discard
  routesThisTurn: number; // routes built in the current turn (reset on END_TURN)
}
```

In `GameState`, after `pendingDiscards`:

```ts
  longestRouteHolderId: string | null;
  stats: Record<string, PlayerStats>;
```

Append a helper near `emptyResources`:

```ts
export function emptyStats(): PlayerStats {
  return {
    dustPlacements: 0,
    tradesWithOpponent: 0,
    sevensRolled: 0,
    dustDamageTaken: 0,
    routesThisTurn: 0,
  };
}
```

- [ ] **Step 2: Initialize in `createGame` (`src/game/state.ts`)**

After `pendingDiscards: {},` add:

```ts
    longestRouteHolderId: null,
    stats: {
      [opts.p1.id]: emptyStats(),
      [opts.p2.id]: emptyStats(),
    },
```

And update the import line:

```ts
import { emptyResources, emptyStats } from './types';
```

- [ ] **Step 3: Update `src/game/state.test.ts`**

Add inside `describe('createGame', ...)`:

```ts
  it('initializes longest-route holder and per-player stats', () => {
    const g = createGame(opts);
    expect(g.longestRouteHolderId).toBeNull();
    expect(g.stats['p1']).toEqual({
      dustPlacements: 0,
      tradesWithOpponent: 0,
      sevensRolled: 0,
      dustDamageTaken: 0,
      routesThisTurn: 0,
    });
    expect(g.stats['p2'].routesThisTurn).toBe(0);
  });
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/game/state.test.ts` then `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/state.ts src/game/state.test.ts
git commit -m "feat: add stats and longest-route holder to game state"
```

---

### Task A2: Longest-route computation

**Files:**
- Modify: `src/game/scoring.ts`
- Test: `src/game/scoring.test.ts`

Longest contiguous chain of a player's routes, computed as the longest trail (no edge reused) in the player's route subgraph via DFS from every endpoint.

- [ ] **Step 1: Write the failing test (append to `src/game/scoring.test.ts`)**

```ts
import { buildBoardGraph } from './board';
import { longestRouteLength } from './scoring';
import type { Route } from './types';

describe('longestRouteLength', () => {
  const g = buildBoardGraph();

  // Build a path of N connected edges by walking the graph from edge 0.
  function connectedPath(n: number): Route[] {
    const routes: Route[] = [];
    const usedEdges = new Set<string>();
    const usedVerts = new Set<string>();
    let frontier = g.edgeVertices[g.edges[0]][0];
    usedVerts.add(frontier);
    while (routes.length < n) {
      const e = g.vertexEdges[frontier].find((ed) => {
        if (usedEdges.has(ed)) return false;
        const [a, b] = g.edgeVertices[ed];
        const other = a === frontier ? b : a;
        return !usedVerts.has(other);
      });
      if (!e) break;
      routes.push({ edgeId: e, ownerId: 'p1' });
      usedEdges.add(e);
      const [a, b] = g.edgeVertices[e];
      frontier = a === frontier ? b : a;
      usedVerts.add(frontier);
    }
    return routes;
  }

  it('returns 0 for no routes', () => {
    expect(longestRouteLength(g, [], 'p1')).toBe(0);
  });

  it('counts a single route as length 1', () => {
    expect(longestRouteLength(g, [{ edgeId: g.edges[0], ownerId: 'p1' }], 'p1')).toBe(1);
  });

  it('measures a contiguous chain of 5 as length 5', () => {
    const routes = connectedPath(5);
    expect(routes.length).toBe(5);
    expect(longestRouteLength(g, routes, 'p1')).toBe(5);
  });

  it('ignores another player’s routes', () => {
    const routes = connectedPath(3).map((r) => ({ ...r, ownerId: 'p2' }));
    expect(longestRouteLength(g, routes, 'p1')).toBe(0);
  });
});
```

- [ ] **Step 2: Run (fails)**

Run: `npx vitest run src/game/scoring.test.ts`
Expected: FAIL — `longestRouteLength` not exported.

- [ ] **Step 3: Implement in `src/game/scoring.ts`**

Add the import at the top:

```ts
import type { BoardGraph } from './board';
import type { GameState, Route } from './types';
```

(Keep the existing `import type { GameState } from './types';` — merge into the single line above.)

Append:

```ts
// Longest contiguous chain (trail; no edge reused) of a player's routes.
export function longestRouteLength(g: BoardGraph, routes: Route[], playerId: string): number {
  const owned = routes.filter((r) => r.ownerId === playerId).map((r) => r.edgeId);
  if (owned.length === 0) return 0;
  const ownedSet = new Set(owned);

  // adjacency: vertex -> owned edges incident to it
  const incident: Record<string, string[]> = {};
  for (const e of owned) {
    const [a, b] = g.edgeVertices[e];
    (incident[a] ??= []).push(e);
    (incident[b] ??= []).push(e);
  }

  let best = 0;
  const dfs = (vertex: string, used: Set<string>, len: number) => {
    if (len > best) best = len;
    for (const e of incident[vertex] ?? []) {
      if (used.has(e) || !ownedSet.has(e)) continue;
      const [a, b] = g.edgeVertices[e];
      const next = a === vertex ? b : a;
      used.add(e);
      dfs(next, used, len + 1);
      used.delete(e);
    }
  };

  // Start from every endpoint of every owned edge.
  for (const e of owned) {
    const [a, b] = g.edgeVertices[e];
    dfs(a, new Set(), 0);
    dfs(b, new Set(), 0);
  }
  return best;
}
```

- [ ] **Step 4: Run (passes)**

Run: `npx vitest run src/game/scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/scoring.ts src/game/scoring.test.ts
git commit -m "feat: longest-route length computation"
```

---

### Task A3: Recompute holder + longest-route VP, integrate into reducer

**Files:**
- Modify: `src/game/scoring.ts`
- Modify: `src/game/reducer.ts`
- Test: `src/game/scoring.test.ts`, `src/game/reducer.test.ts`

- [ ] **Step 1: Add holder recompute + VP to `src/game/scoring.ts`**

Append:

```ts
export const LONGEST_ROUTE_MIN = 5;
export const LONGEST_ROUTE_VP = 2;

// Recompute lengths and update the holder. The title only changes hands when a
// challenger is STRICTLY longer than the current holder's length (first keeps ties).
// Mutates player.longestRoute and returns the new holder id (or null).
export function recomputeLongestRoute(g: BoardGraph, state: GameState): string | null {
  const lengths: Record<string, number> = {};
  for (const p of state.players) {
    p.longestRoute = longestRouteLength(g, state.routes, p.id);
    lengths[p.id] = p.longestRoute;
  }
  const current = state.longestRouteHolderId;
  const eligible = state.players.filter((p) => lengths[p.id] >= LONGEST_ROUTE_MIN);
  if (eligible.length === 0) {
    return null;
  }
  // If current holder still eligible, only a strictly longer challenger takes it.
  if (current && lengths[current] >= LONGEST_ROUTE_MIN) {
    const challenger = state.players.find(
      (p) => p.id !== current && lengths[p.id] > lengths[current],
    );
    return challenger ? challenger.id : current;
  }
  // No (eligible) holder yet: the longest eligible takes it; on a tie, player[0].
  let holder = eligible[0];
  for (const p of eligible) if (lengths[p.id] > lengths[holder.id]) holder = p;
  return holder.id;
}

export function longestRouteVP(state: GameState, playerId: string): number {
  return state.longestRouteHolderId === playerId ? LONGEST_ROUTE_VP : 0;
}
```

Update `playerVP` to include it (buildings + longest route; tech & missions come in later tasks — keep the function additive):

```ts
export function playerVP(state: GameState, playerId: string): number {
  return buildingVP(state, playerId) + longestRouteVP(state, playerId);
}
```

- [ ] **Step 2: Call `recomputeLongestRoute` after every route placement in `src/game/reducer.ts`**

Add the import:

```ts
import { recomputeLongestRoute } from './scoring';
```

In `applySetup`, after `next.routes.push({ edgeId: e, ownerId: playerId });` (the setup route branch), add before `return advanceSetup(next);`:

```ts
  next.longestRouteHolderId = recomputeLongestRoute(g, next);
```

In `handleBuildRoute`, after `next.routes.push({ edgeId: e, ownerId: playerId });`, add before `return { state: next };`:

```ts
  next.longestRouteHolderId = recomputeLongestRoute(g, next);
```

- [ ] **Step 3: Add tests**

Append to `src/game/scoring.test.ts`:

```ts
import { recomputeLongestRoute, longestRouteVP } from './scoring';
import { createGame } from './state';

describe('recomputeLongestRoute', () => {
  const g = buildBoardGraph();
  function freshState() {
    return createGame({
      id: 'g',
      code: 'CODELR',
      seed: 9,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
  }
  // Reuse the path builder pattern.
  function connectedPath(n: number, owner: string): Route[] {
    const routes: Route[] = [];
    const usedEdges = new Set<string>();
    const usedVerts = new Set<string>();
    let frontier = g.edgeVertices[g.edges[0]][0];
    usedVerts.add(frontier);
    while (routes.length < n) {
      const e = g.vertexEdges[frontier].find((ed) => {
        if (usedEdges.has(ed)) return false;
        const [a, b] = g.edgeVertices[ed];
        return !usedVerts.has(a === frontier ? b : a);
      });
      if (!e) break;
      routes.push({ edgeId: e, ownerId: owner });
      usedEdges.add(e);
      const [a, b] = g.edgeVertices[e];
      frontier = a === frontier ? b : a;
      usedVerts.add(frontier);
    }
    return routes;
  }

  it('awards the holder at length >= 5 and grants 2 VP', () => {
    const s = freshState();
    s.routes = connectedPath(5, 'p1');
    s.longestRouteHolderId = recomputeLongestRoute(g, s);
    expect(s.longestRouteHolderId).toBe('p1');
    expect(longestRouteVP(s, 'p1')).toBe(2);
    expect(longestRouteVP(s, 'p2')).toBe(0);
  });

  it('no holder below length 5', () => {
    const s = freshState();
    s.routes = connectedPath(4, 'p1');
    expect(recomputeLongestRoute(g, s)).toBeNull();
  });
});
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/game/scoring.test.ts src/game/reducer.test.ts` then `npm run typecheck`
Expected: PASS (reducer tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/game/scoring.ts src/game/reducer.ts src/game/scoring.test.ts
git commit -m "feat: longest-route holder tracking and VP"
```

---

## Group B — Tech Tree

### Task B1: Tech definitions + helpers

**Files:**
- Create: `src/game/tech.ts`
- Test: `src/game/tech.test.ts`

- [ ] **Step 1: Write the failing test (`src/game/tech.test.ts`)**

```ts
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
```

- [ ] **Step 2: Run (fails)**

Run: `npx vitest run src/game/tech.test.ts`
Expected: FAIL — cannot resolve `./tech`.

- [ ] **Step 3: Implement `src/game/tech.ts`**

```ts
import type { PlayerState } from './types';

export type TechTrack = 'ENG' | 'BIO' | 'ASTRO';

export interface TechDef {
  id: string;
  track: TechTrack;
  tier: 1 | 2 | 3 | 4;
  cost: number;
  vp: number;
  name: string;
}

const TIER_COST: Record<number, number> = { 1: 2, 2: 3, 3: 3, 4: 4 };

function track(prefix: TechTrack, names: [string, string, string, string]): TechDef[] {
  return names.map((name, i) => {
    const tier = (i + 1) as 1 | 2 | 3 | 4;
    return { id: `${prefix}${tier}`, track: prefix, tier, cost: TIER_COST[tier], vp: 1, name };
  });
}

export const TECHS: TechDef[] = [
  ...track('ENG', ['Ridge Mining', 'Efficient Domes', 'Rapid Rovers', 'Fortified Dome']),
  ...track('BIO', ['Oxygen Farms', 'Storm Shelter', 'Resilient Habitats', 'Greenhouse']),
  ...track('ASTRO', ['Recalibrate', 'Stargazer', 'Open Market', 'Solar Array']),
];

export function techById(id: string): TechDef | undefined {
  return TECHS.find((t) => t.id === id);
}

export function hasTech(player: PlayerState, id: string): boolean {
  return player.techs.includes(id);
}

// The next tech a player may buy in a track (tier order), or null if maxed.
export function nextResearchable(player: PlayerState, trackId: TechTrack): TechDef | null {
  const owned = player.techs.filter((id) => techById(id)?.track === trackId).length;
  if (owned >= 4) return null;
  return TECHS.find((t) => t.track === trackId && t.tier === owned + 1) ?? null;
}
```

- [ ] **Step 4: Run (passes)**

Run: `npx vitest run src/game/tech.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/tech.ts src/game/tech.test.ts
git commit -m "feat: tech-tree definitions and helpers"
```

---

### Task B2: RESEARCH handler + tech VP

**Files:**
- Modify: `src/game/reducer.ts`
- Modify: `src/game/scoring.ts`
- Modify: `src/game/reducer.test.ts`, `src/game/scoring.test.ts`

`RESEARCH` (spec §3.7): ACTIONS phase, your turn, must be the next tech in its track, must afford the cost; adds the tech. Tech VP = min(#techs, 4), with `ENG4` upgrading dome VP handled in `buildingVP`.

- [ ] **Step 1: Replace the RESEARCH stub in `src/game/reducer.ts`**

Add imports:

```ts
import { techById, nextResearchable } from './tech';
```

Replace:

```ts
    case 'RESEARCH':
      return fail(state, 'Tech tree arrives in Plan 3.');
```

with:

```ts
    case 'RESEARCH':
      return handleResearch(state, move, playerId);
```

Add the handler (near the other play handlers):

```ts
function handleResearch(
  state: GameState,
  move: Extract<Move, { type: 'RESEARCH' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before researching.');
  const def = techById(move.techId);
  if (!def) return fail(state, 'Unknown tech.');
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];
  if (hasTechId(me.techs, def.id)) return fail(state, 'Already researched.');
  const next = nextResearchable(me, def.track);
  if (!next || next.id !== def.id) return fail(state, 'Must research techs in order.');
  if (me.resources.RES < def.cost) return fail(state, `Need ${def.cost} RES.`);
  const nextState = clone(state);
  nextState.players[idx].resources.RES -= def.cost;
  nextState.players[idx].techs.push(def.id);
  return { state: nextState };
}

function hasTechId(techs: string[], id: string): boolean {
  return techs.includes(id);
}
```

- [ ] **Step 2: Make `buildingVP` tech-aware + add `techVP` in `src/game/scoring.ts`**

Replace the existing `buildingVP` with:

```ts
export function buildingVP(state: GameState, playerId: string): number {
  const me = state.players.find((p) => p.id === playerId);
  const fortified = me?.techs.includes('ENG4') ?? false; // Domes worth 3
  return state.buildings
    .filter((b) => b.ownerId === playerId)
    .reduce((sum, b) => {
      if (b.kind === 'HABITAT') return sum + 1;
      if (b.kind === 'COMM_TOWER') return sum + 1;
      return sum + (fortified ? 3 : 2); // DOME
    }, 0);
}

export function techVP(state: GameState, playerId: string): number {
  const me = state.players.find((p) => p.id === playerId);
  return Math.min(me?.techs.length ?? 0, 4); // max 4 counted (spec §3.7)
}
```

Update `playerVP`:

```ts
export function playerVP(state: GameState, playerId: string): number {
  return buildingVP(state, playerId) + longestRouteVP(state, playerId) + techVP(state, playerId);
}
```

- [ ] **Step 3: Add tests**

Append to `src/game/reducer.test.ts` (inside a new describe):

```ts
describe('RESEARCH', () => {
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 10 };
    return s;
  }

  it('buys ENG1 then ENG2 in order, charging RES', () => {
    let s = playState();
    const r1 = applyMove(s, { type: 'RESEARCH', techId: 'ENG1' }, 'p1');
    expect(r1.error).toBeUndefined();
    expect(r1.state.players[0].techs).toEqual(['ENG1']);
    expect(r1.state.players[0].resources.RES).toBe(8); // 10 - 2
    const r2 = applyMove(r1.state, { type: 'RESEARCH', techId: 'ENG2' }, 'p1');
    expect(r2.state.players[0].techs).toEqual(['ENG1', 'ENG2']);
    expect(r2.state.players[0].resources.RES).toBe(5); // 8 - 3
  });

  it('rejects out-of-order research', () => {
    const s = playState();
    expect(applyMove(s, { type: 'RESEARCH', techId: 'ENG2' }, 'p1').error).toMatch(/in order/i);
  });

  it('rejects research the player cannot afford', () => {
    const s = playState();
    s.players[0].resources.RES = 1;
    expect(applyMove(s, { type: 'RESEARCH', techId: 'ENG1' }, 'p1').error).toMatch(/RES/);
  });
});
```

Append to `src/game/scoring.test.ts`:

```ts
import { techVP } from './scoring';

describe('techVP and fortified domes', () => {
  it('caps tech VP at 4', () => {
    const s = createGame({
      id: 'g',
      code: 'CODET',
      seed: 2,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s.players[0].techs = ['ENG1', 'ENG2', 'ENG3', 'ENG4', 'BIO1'];
    expect(techVP(s, 'p1')).toBe(4);
  });
});
```

> Note: `buildingVP` tests written in Plan 2 used a bare `{ buildings } as GameState`. With the tech-aware version, `state.players` may be undefined in those fixtures — `me` is looked up with `?.` and falls back to non-fortified, so existing tests still pass. Verify in Step 4.

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/game/reducer.test.ts src/game/scoring.test.ts` then `npm run typecheck`
Expected: PASS. (If the Plan 2 `buildingVP` fixture throws because `state.players` is undefined, wrap the lookup as shown with `?.` — already done.)

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts src/game/scoring.ts src/game/reducer.test.ts src/game/scoring.test.ts
git commit -m "feat: research tech cards and count tech VP"
```

---

### Task B3: Tech-aware production (ENG1, BIO1, BIO4, ASTRO4)

**Files:**
- Modify: `src/game/production.ts`
- Test: `src/game/production.test.ts`

- [ ] **Step 1: Replace `produce` in `src/game/production.ts`**

```ts
import type { BoardGraph } from './board';
import type { GameState, Resource, PlayerState } from './types';
import { TERRAIN_RESOURCE, emptyResources } from './types';
import { buildingAt } from './rules';

function playerOf(state: GameState, id: string): PlayerState {
  return state.players[0].id === id ? state.players[0] : state.players[1];
}

// Yield for one building from one matching hex, applying tech bonuses.
function yieldFor(owner: PlayerState, kind: 'HABITAT' | 'DOME', terrain: string): number {
  const dome = kind === 'DOME';
  let base = dome ? 2 : 1;
  if (terrain === 'RIDGE' && owner.techs.includes('ENG1')) base += 1; // +1 ORE
  if (terrain === 'PLAIN' && owner.techs.includes('BIO1')) base += 1; // +1 O2
  if (terrain === 'CRATER' && dome && owner.techs.includes('ASTRO4')) base = 3; // Solar Array
  return base;
}

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

    if (hex.terrain === 'LAB') {
      delta[state.activePlayerId].RES += 1; // global to active player (spec §3.1)
      continue;
    }

    const res = TERRAIN_RESOURCE[hex.terrain] as Resource | undefined;
    if (!res) continue;
    for (const v of g.hexVertices[hex.id]) {
      const b = buildingAt(state.buildings, v);
      if (!b || b.kind === 'COMM_TOWER') continue;
      const owner = playerOf(state, b.ownerId);
      delta[b.ownerId][res] += yieldFor(owner, b.kind, hex.terrain);
      // Greenhouse: a Habitat adjacent to a producing Ice hex also yields +1 O2.
      if (hex.terrain === 'ICE' && b.kind === 'HABITAT' && owner.techs.includes('BIO4')) {
        delta[b.ownerId].O2 += 1;
      }
    }
  }
  return delta;
}

// Production triggered by a 7 for a BIO3 owner: ALL their buildings produce from
// every adjacent producing hex (dust storm / lake still block). Spec §3.7.
export function produceOnSeven(
  g: BoardGraph,
  state: GameState,
  playerId: string,
): Record<Resource, number> {
  const out = emptyResources();
  const owner = playerOf(state, playerId);
  if (!owner.techs.includes('BIO3')) return out;
  for (const b of state.buildings) {
    if (b.ownerId !== playerId || b.kind === 'COMM_TOWER') continue;
    for (const hid of g.vertexHexes[b.vertexId]) {
      const hex = state.board.hexes.find((h) => h.id === hid);
      if (!hex || hex.id === state.dustStormHexId || hex.terrain === 'LAKE') continue;
      if (hex.terrain === 'LAB') continue; // labs are global-only
      const res = TERRAIN_RESOURCE[hex.terrain] as Resource | undefined;
      if (!res) continue;
      out[res] += yieldFor(owner, b.kind, hex.terrain);
      if (hex.terrain === 'ICE' && b.kind === 'HABITAT' && owner.techs.includes('BIO4')) {
        out.O2 += 1;
      }
    }
  }
  return out;
}
```

> Note: this adds a `b.kind === 'COMM_TOWER'` guard to the normal production loop (Comm Towers never produce). Plan 2's tests only used HABITAT/DOME so they still pass; this is a correctness tightening.

- [ ] **Step 2: Add tests (append to `src/game/production.test.ts`)**

```ts
import { produceOnSeven } from './production';

describe('tech-aware production', () => {
  it('ENG1 adds +1 ORE per Ridge building', () => {
    const hex = g.hexIds[0];
    const vertex = g.hexVertices[hex][0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'RIDGE', number: 5 }];
    const s = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'HABITAT' }],
    });
    s.players[0].techs = ['ENG1'];
    expect(produce(g, s, 5)['p1'].ORE).toBe(2); // 1 base + 1
  });

  it('ASTRO4 makes Domes yield 3 ENG from Craters', () => {
    const hex = g.hexIds[0];
    const vertex = g.hexVertices[hex][0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'CRATER', number: 6 }];
    const s = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'DOME' }],
    });
    s.players[0].techs = ['ENG1', 'ENG2', 'ENG3', 'BIO1', 'ASTRO4'];
    expect(produce(g, s, 6)['p1'].ENG).toBe(3);
  });

  it('produceOnSeven yields nothing without BIO3 and resources with it', () => {
    const hex = g.hexIds[0];
    const vertex = g.hexVertices[hex][0];
    const hexes: Hex[] = [{ id: hex, q: 0, r: 0, terrain: 'PLAIN', number: 4 }];
    const s = gameWith(hexes, {
      buildings: [{ vertexId: vertex, ownerId: 'p1', kind: 'HABITAT' }],
    });
    expect(produceOnSeven(g, s, 'p1').O2).toBe(0);
    s.players[0].techs = ['BIO1', 'BIO2', 'BIO3'];
    // PLAIN with BIO1 = 1 + 1 = 2 O2 regardless of the rolled number
    expect(produceOnSeven(g, s, 'p1').O2).toBe(2);
  });
});
```

- [ ] **Step 3: Run + typecheck**

Run: `npx vitest run src/game/production.test.ts` then `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/game/production.ts src/game/production.test.ts
git commit -m "feat: tech-aware production yields and BIO3 seven-production"
```

---

### Task B4: Tech effects in the reducer (costs, free routes, market, 7-roll)

**Files:**
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducer.test.ts`

Wire the remaining deterministic effects: `ENG2` cheaper Dome, `ENG3` free routes (first 2/turn), `ASTRO3` 2:1 market, `BIO2` no discard, `BIO3` produce on 7. Also bump `stats` counters (`sevensRolled`, `routesThisTurn`) used by missions in Group C, and reset `routesThisTurn` on `END_TURN`.

- [ ] **Step 1: Dome cost (ENG2) in `handleBuild`**

Add import:

```ts
import { produceOnSeven } from './production';
```

In the DOME branch of `handleBuild`, replace the cost references. Change:

```ts
    if (!canAfford(me.resources, BUILDING_COST.DOME)) return fail(state, 'Cannot afford Dome.');
    const next = clone(state);
    next.players[idx].resources = payCost(me.resources, BUILDING_COST.DOME);
```

to:

```ts
    const domeCost = me.techs.includes('ENG2') ? { ORE: 1, ENG: 3 } : BUILDING_COST.DOME;
    if (!canAfford(me.resources, domeCost)) return fail(state, 'Cannot afford Dome.');
    const next = clone(state);
    next.players[idx].resources = payCost(me.resources, domeCost);
```

- [ ] **Step 2: Free routes (ENG3) + route counter in `handleBuildRoute`**

Replace the cost/charge tail of `handleBuildRoute`:

```ts
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];
  if (!canAfford(me.resources, BUILDING_COST.ROUTE)) return fail(state, 'Cannot afford Route.');
  const next = clone(state);
  next.players[idx].resources = payCost(me.resources, BUILDING_COST.ROUTE);
  next.routes.push({ edgeId: e, ownerId: playerId });
  next.longestRouteHolderId = recomputeLongestRoute(g, next);
  return { state: next };
```

with:

```ts
  const idx = playerIndex(state, playerId);
  const me = state.players[idx];
  const free = me.techs.includes('ENG3') && state.stats[playerId].routesThisTurn < 2;
  if (!free && !canAfford(me.resources, BUILDING_COST.ROUTE)) {
    return fail(state, 'Cannot afford Route.');
  }
  const next = clone(state);
  if (!free) next.players[idx].resources = payCost(me.resources, BUILDING_COST.ROUTE);
  next.routes.push({ edgeId: e, ownerId: playerId });
  next.stats[playerId].routesThisTurn += 1;
  next.longestRouteHolderId = recomputeLongestRoute(g, next);
  return { state: next };
}
```

(Note: the trailing `}` above closes `handleBuildRoute`; ensure you don't duplicate it.)

- [ ] **Step 3: Market 2:1 (ASTRO3) in `handleTradeMarket`**

Change:

```ts
  const rate = me.hasCommTower ? MARKET_RATE_COMM : MARKET_RATE_DEFAULT;
```

to:

```ts
  const rate =
    me.hasCommTower || me.techs.includes('ASTRO3') ? MARKET_RATE_COMM : MARKET_RATE_DEFAULT;
```

- [ ] **Step 4: 7-roll BIO2 (no discard) + BIO3 (produce) + counters in `handleRoll`**

Replace the `if (sum === 7) { ... }` block with:

```ts
  if (sum === 7) {
    next.stats[playerId].sevensRolled += 1;
    const pending: Record<string, number> = {};
    for (const p of next.players) {
      if (p.techs.includes('BIO2')) continue; // Storm Shelter: ignore discard
      const n = totalResources(p.resources);
      if (n > DUST_DISCARD_THRESHOLD) pending[p.id] = Math.floor(n / 2);
    }
    next.pendingDiscards = pending;
    // BIO3: each owner's buildings produce on the 7 (stacks with BIO2).
    for (const p of next.players) {
      const bonus = produceOnSeven(g, next, p.id);
      (Object.keys(bonus) as Resource[]).forEach((r) => (p.resources[r] += bonus[r]));
    }
    next.turnPhase = Object.keys(pending).length > 0 ? 'DISCARD' : 'MOVE_STORM';
    return { state: next };
  }
```

- [ ] **Step 5: Reset `routesThisTurn` in `handleEndTurn`; count dust placements + discards**

In `handleEndTurn`, after `next.lastRoll = null;` add:

```ts
  next.stats[playerId].routesThisTurn = 0;
```

In `handleMoveDustStorm`, after `next.dustStormHexId = move.hexId;` add:

```ts
  next.stats[playerId].dustPlacements += 1;
```

In `handleDiscard`, after `delete next.pendingDiscards[playerId];` add:

```ts
  next.stats[playerId].dustDamageTaken += 1;
```

- [ ] **Step 6: Add tests (append to `src/game/reducer.test.ts`)**

```ts
describe('tech effects in the reducer', () => {
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

  it('ENG2 makes a Dome cost 1 ORE + 3 ENG', () => {
    const s = playState();
    s.players[0].techs = ['ENG1', 'ENG2'];
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 1, ENG: 3, RES: 0 };
    const v = s.buildings[0].vertexId;
    const r = applyMove(s, { type: 'BUILD', building: 'DOME', locationId: v }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources).toEqual({ O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 0 });
  });

  it('ENG3 makes the first two routes free', () => {
    const s = playState();
    s.players[0].techs = ['ENG1', 'ENG2', 'ENG3'];
    s.players[0].resources = { O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 0 }; // broke
    const start = s.buildings[0].vertexId;
    const e1 = g.vertexEdges[start].find((e) => e !== s.routes[0].edgeId)!;
    const r = applyMove(s, { type: 'BUILD_ROUTE', edgeId: e1 }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.stats['p1'].routesThisTurn).toBe(1);
  });

  it('ASTRO3 gives a 2:1 market without a Comm Tower', () => {
    const s = playState();
    s.players[0].techs = ['ASTRO1', 'ASTRO2', 'ASTRO3'];
    s.players[0].resources = { O2: 2, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    const r = applyMove(s, { type: 'TRADE_MARKET', give: 'O2', receive: 'RES' }, 'p1');
    expect(r.state.players[0].resources.O2).toBe(0);
    expect(r.state.players[0].resources.RES).toBe(1);
  });

  it('BIO2 owner never owes a discard on a 7', () => {
    const s = playState();
    s.turnPhase = 'AWAIT_ROLL';
    s.players[0].techs = ['BIO1', 'BIO2'];
    s.players[0].resources = { O2: 8, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
    const r = applyMove(s, { type: 'ROLL', roll: [3, 4] }, 'p1');
    expect(r.state.pendingDiscards['p1']).toBeUndefined();
    expect(r.state.turnPhase).toBe('MOVE_STORM');
    expect(r.state.stats['p1'].sevensRolled).toBe(1);
  });
});
```

- [ ] **Step 7: Run + typecheck**

Run: `npx vitest run src/game/reducer.test.ts` then `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: tech effects for costs, routes, market, and the 7-roll"
```

---

## Group C — Missions

### Task C1: Mission definitions

**Files:**
- Modify: `src/game/missions.ts`
- Test: `src/game/missions.test.ts`

Each mission has `id`, `vp`, optional `bonus` resources, and a `condition(ctx)` predicate. `ctx` carries everything a predicate needs, computed once by the caller.

- [ ] **Step 1: Write the failing test (`src/game/missions.test.ts`)**

```ts
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
```

- [ ] **Step 2: Run (fails)**

Run: `npx vitest run src/game/missions.test.ts`
Expected: FAIL — `MISSIONS`/`missionById` not exported.

- [ ] **Step 3: Implement definitions in `src/game/missions.ts`**

Append below the existing `MISSION_IDS`:

```ts
import type { GameState, PlayerState, Resource, Terrain } from './types';
import type { BoardGraph } from './board';
import { buildBoardGraph, hexId } from './board';
import { longestRouteLength } from './scoring';

export interface MissionCtx {
  state: GameState;
  g: BoardGraph;
  player: PlayerState;
  playerId: string;
}

export interface MissionDef {
  id: string;
  vp: number;
  bonus?: Partial<Record<Resource, number>>;
  condition: (ctx: MissionCtx) => boolean;
}

// --- predicate helpers -------------------------------------------------------

function myBuildings(ctx: MissionCtx) {
  return ctx.state.buildings.filter((b) => b.ownerId === ctx.playerId);
}

// terrains adjacent to a vertex
function terrainsAround(ctx: MissionCtx, vertexId: string): Set<Terrain> {
  const out = new Set<Terrain>();
  for (const hid of ctx.g.vertexHexes[vertexId]) {
    const hex = ctx.state.board.hexes.find((h) => h.id === hid);
    if (hex) out.add(hex.terrain);
  }
  return out;
}

function buildingsAdjacentToTerrain(ctx: MissionCtx, terrain: Terrain): number {
  return myBuildings(ctx).filter((b) => terrainsAround(ctx, b.vertexId).has(terrain)).length;
}

const PRODUCING: Terrain[] = ['PLAIN', 'RIDGE', 'CRATER', 'ICE'];

// terrains touched by the player's routes (via their endpoints' hexes)
function routeTerrains(ctx: MissionCtx): Set<Terrain> {
  const out = new Set<Terrain>();
  for (const r of ctx.state.routes) {
    if (r.ownerId !== ctx.playerId) continue;
    for (const v of ctx.g.edgeVertices[r.edgeId]) {
      for (const t of terrainsAround(ctx, v)) out.add(t);
    }
  }
  return out;
}

function ownsKinds(ctx: MissionCtx) {
  const kinds = new Set(myBuildings(ctx).map((b) => b.kind));
  return kinds;
}

// route of mine that shares a vertex with an opponent's route or building
function touchesOpponent(ctx: MissionCtx): boolean {
  const oppId = ctx.state.players.find((p) => p.id !== ctx.playerId)!.id;
  const oppVerts = new Set<string>();
  for (const b of ctx.state.buildings) if (b.ownerId === oppId) oppVerts.add(b.vertexId);
  for (const r of ctx.state.routes) {
    if (r.ownerId !== oppId) continue;
    for (const v of ctx.g.edgeVertices[r.edgeId]) oppVerts.add(v);
  }
  for (const r of ctx.state.routes) {
    if (r.ownerId !== ctx.playerId) continue;
    for (const v of ctx.g.edgeVertices[r.edgeId]) if (oppVerts.has(v)) return true;
  }
  return false;
}

function totalRes(p: PlayerState): number {
  return (Object.values(p.resources) as number[]).reduce((a, b) => a + b, 0);
}

// --- the 18 missions (spec §3.8) --------------------------------------------

export const MISSIONS: MissionDef[] = [
  {
    id: 'pioneer',
    vp: 2,
    condition: (c) => myBuildings(c).filter((b) => b.kind === 'HABITAT' || b.kind === 'DOME').length >= 3,
  },
  { id: 'ice-baron', vp: 2, condition: (c) => buildingsAdjacentToTerrain(c, 'ICE') >= 3 },
  { id: 'engineer', vp: 1, bonus: { ENG: 2 }, condition: (c) => c.player.hasCommTower },
  {
    id: 'cartographer',
    vp: 2,
    condition: (c) => {
      const t = routeTerrains(c);
      return PRODUCING.every((x) => t.has(x));
    },
  },
  {
    id: 'geologist',
    vp: 3,
    condition: (c) => PRODUCING.every((t) => buildingsAdjacentToTerrain(c, t) >= 1),
  },
  { id: 'long-haul', vp: 1, bonus: { ENG: 2 }, condition: (c) => c.state.stats[c.playerId].routesThisTurn >= 4 },
  { id: 'researcher', vp: 2, condition: (c) => c.player.techs.length >= 2 },
  { id: 'industrialist', vp: 2, condition: (c) => myBuildings(c).filter((b) => b.kind === 'DOME').length >= 2 },
  { id: 'dustkeeper', vp: 1, condition: (c) => c.state.stats[c.playerId].dustPlacements >= 3 },
  { id: 'stockpile', vp: 1, condition: (c) => totalRes(c.player) >= 10 },
  { id: 'alchemist', vp: 1, bonus: { RES: 1 }, condition: (c) => c.state.stats[c.playerId].tradesWithOpponent >= 3 },
  {
    id: 'sprinter',
    vp: 2,
    condition: (c) =>
      longestRouteLength(c.g, c.state.routes, c.playerId) >= 5 &&
      c.state.longestRouteHolderId === c.playerId,
  },
  {
    id: 'diversified',
    vp: 3,
    condition: (c) => {
      const k = ownsKinds(c);
      return k.has('HABITAT') && k.has('DOME') && k.has('COMM_TOWER');
    },
  },
  { id: 'astronomer', vp: 1, condition: (c) => c.state.stats[c.playerId].sevensRolled >= 3 },
  { id: 'solar-mogul', vp: 2, condition: (c) => buildingsAdjacentToTerrain(c, 'CRATER') >= 3 },
  { id: 'networker', vp: 1, condition: (c) => touchesOpponent(c) },
  { id: 'survivor', vp: 1, condition: (c) => c.state.stats[c.playerId].dustDamageTaken >= 3 },
  { id: 'first-light', vp: 1, condition: (c) => c.player.techs.length >= 1 },
];

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

// Build a MissionCtx for a player (used by the reducer when claiming).
export function missionCtx(state: GameState, playerId: string): MissionCtx {
  const g = buildBoardGraph();
  const player = state.players[0].id === playerId ? state.players[0] : state.players[1];
  return { state, g, player, playerId };
}

// `hexId` is re-exported only to keep board a used import for tooling clarity.
void hexId;
```

> The `void hexId;` line avoids an unused-import error; if your linter prefers, simply drop `hexId` from the import instead. Verify in Step 4 and pick one.

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/game/missions.test.ts` then `npm run typecheck`
Expected: PASS. If `hexId` triggers an unused warning, remove it from the import and delete the `void hexId;` line.

- [ ] **Step 5: Commit**

```bash
git add src/game/missions.ts src/game/missions.test.ts
git commit -m "feat: mission definitions and predicates"
```

---

### Task C2: CLAIM_MISSION handler

**Files:**
- Modify: `src/game/reducer.ts`
- Modify: `src/game/reducer.test.ts`

`CLAIM_MISSION` (spec §3.8): your turn, ACTIONS phase, the mission must be one of the 3 on the board, and its condition must currently hold. On success: move id to `player.missions`, grant bonus, remove from board, draw a replacement from the deck. Also: count accepted player trades for `alchemist` (wire in `handleTradePlayer`).

- [ ] **Step 1: Replace the CLAIM_MISSION stub in `src/game/reducer.ts`**

Add imports:

```ts
import { missionById, missionCtx } from './missions';
import type { Resource as Res } from './types';
```

(If `Resource` is already imported, skip the alias and reuse it.)

Replace:

```ts
    case 'CLAIM_MISSION':
      return fail(state, 'Missions arrive in Plan 3.');
```

with:

```ts
    case 'CLAIM_MISSION':
      return handleClaimMission(state, move, playerId);
```

Add the handler:

```ts
function handleClaimMission(
  state: GameState,
  move: Extract<Move, { type: 'CLAIM_MISSION' }>,
  playerId: string,
): ApplyResult {
  if (playerId !== state.activePlayerId) return fail(state, 'Not your turn.');
  if (state.turnPhase !== 'ACTIONS') return fail(state, 'Roll before claiming.');
  if (!state.missionsOnBoard.includes(move.missionId)) {
    return fail(state, 'That mission is not on the board.');
  }
  const def = missionById(move.missionId);
  if (!def) return fail(state, 'Unknown mission.');
  if (!def.condition(missionCtx(state, playerId))) {
    return fail(state, 'Mission condition not met.');
  }
  const idx = playerIndex(state, playerId);
  const next = clone(state);
  next.players[idx].missions.push(def.id);
  if (def.bonus) {
    for (const [r, amt] of Object.entries(def.bonus) as [Resource, number][]) {
      next.players[idx].resources[r] += amt;
    }
  }
  // Remove from board and draw a replacement if any remain.
  next.missionsOnBoard = next.missionsOnBoard.filter((m) => m !== def.id);
  const drawn = next.missionDeck.shift();
  if (drawn) next.missionsOnBoard.push(drawn);
  return { state: next };
}
```

- [ ] **Step 2: Count accepted player trades in `handleTradePlayer`**

Just before the final `return { state: next };` of `handleTradePlayer`, add:

```ts
  next.stats[playerId].tradesWithOpponent += 1;
```

- [ ] **Step 3: Add tests (append to `src/game/reducer.test.ts`)**

```ts
describe('CLAIM_MISSION', () => {
  function playState(): GameState {
    const s = newGame();
    s.phase = 'play';
    s.turn = 1;
    s.activePlayerId = 'p1';
    s.turnPhase = 'ACTIONS';
    return s;
  }

  it('claims a board mission when its condition holds, draws a replacement', () => {
    const s = playState();
    // 'researcher' needs 2 techs. Force it onto the board and give p1 2 techs.
    s.missionsOnBoard = ['researcher', s.missionsOnBoard[1], s.missionsOnBoard[2]];
    s.players[0].techs = ['ENG1', 'ENG2'];
    const deckLen = s.missionDeck.length;
    const r = applyMove(s, { type: 'CLAIM_MISSION', missionId: 'researcher' }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].missions).toContain('researcher');
    expect(r.state.missionsOnBoard).not.toContain('researcher');
    expect(r.state.missionsOnBoard).toHaveLength(3); // replacement drawn
    expect(r.state.missionDeck.length).toBe(deckLen - 1);
  });

  it('rejects claiming when the condition is not met', () => {
    const s = playState();
    s.missionsOnBoard = ['researcher', s.missionsOnBoard[1], s.missionsOnBoard[2]];
    expect(applyMove(s, { type: 'CLAIM_MISSION', missionId: 'researcher' }, 'p1').error).toMatch(
      /not met/i,
    );
  });

  it('rejects claiming a mission not on the board', () => {
    const s = playState();
    const offBoard = ['pioneer', 'ice-baron', 'engineer', 'cartographer'].find(
      (m) => !s.missionsOnBoard.includes(m),
    )!;
    expect(applyMove(s, { type: 'CLAIM_MISSION', missionId: offBoard }, 'p1').error).toMatch(
      /not on the board/i,
    );
  });

  it('grants bonus resources (engineer gives 2 ENG)', () => {
    const s = playState();
    s.missionsOnBoard = ['engineer', s.missionsOnBoard[1], s.missionsOnBoard[2]];
    s.players[0].hasCommTower = true;
    const r = applyMove(s, { type: 'CLAIM_MISSION', missionId: 'engineer' }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].resources.ENG).toBe(2);
  });
});
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/game/reducer.test.ts` then `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts src/game/reducer.test.ts
git commit -m "feat: claim mission cards with conditions, bonuses, and redraw"
```

---

### Task C3: Mission VP in scoring + complete `playerVP`

**Files:**
- Modify: `src/game/scoring.ts`
- Test: `src/game/scoring.test.ts`

- [ ] **Step 1: Add `missionVP` and finalize `playerVP` in `src/game/scoring.ts`**

Add import:

```ts
import { missionById } from './missions';
```

Append:

```ts
export function missionVP(state: GameState, playerId: string): number {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return 0;
  return me.missions.reduce((sum, id) => sum + (missionById(id)?.vp ?? 0), 0);
}
```

Replace `playerVP`:

```ts
export function playerVP(state: GameState, playerId: string): number {
  return (
    buildingVP(state, playerId) +
    longestRouteVP(state, playerId) +
    techVP(state, playerId) +
    missionVP(state, playerId)
  );
}
```

> Import-cycle note: `scoring.ts` now imports `missionById` from `missions.ts`, and `missions.ts` imports `longestRouteLength` from `scoring.ts`. This is a cycle. Break it by having `missions.ts` NOT import from `scoring.ts`: move `longestRouteLength` usage in the `sprinter` predicate to use the already-computed `c.player.longestRoute` (kept current by `recomputeLongestRoute`) instead. Update the `sprinter` condition in `missions.ts` to:
> ```ts
> condition: (c) => c.player.longestRoute >= 5 && c.state.longestRouteHolderId === c.playerId,
> ```
> and remove the `import { longestRouteLength } from './scoring';` line from `missions.ts`. This removes the cycle entirely.

- [ ] **Step 2: Apply the cycle fix in `src/game/missions.ts`**

- Remove `import { longestRouteLength } from './scoring';`
- Change the `sprinter` condition to use `c.player.longestRoute` as shown above.

- [ ] **Step 3: Add test (append to `src/game/scoring.test.ts`)**

```ts
import { missionVP, playerVP } from './scoring';

describe('missionVP and total playerVP', () => {
  it('sums claimed mission VP and folds into playerVP', () => {
    const s = createGame({
      id: 'g',
      code: 'CODEM',
      seed: 5,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s.players[0].missions = ['pioneer', 'geologist']; // 2 + 3
    s.buildings = [{ vertexId: 'x', ownerId: 'p1', kind: 'HABITAT' }]; // +1
    expect(missionVP(s, 'p1')).toBe(5);
    expect(playerVP(s, 'p1')).toBe(6);
  });
});
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/game/scoring.test.ts` then `npm run typecheck`
Expected: PASS (no import cycle).

- [ ] **Step 5: Commit**

```bash
git add src/game/scoring.ts src/game/missions.ts src/game/scoring.test.ts
git commit -m "feat: mission VP and complete victory-point total"
```

---

### Task C4: Integration smoke test

**Files:**
- Test: `src/game/integration.test.ts`

A scripted partial game exercising setup → roll → build → research → claim across both players, asserting state stays valid and VP composes.

- [ ] **Step 1: Write the test (`src/game/integration.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { createGame } from './state';
import { applyMove } from './reducer';
import { buildBoardGraph } from './board';
import { playerVP } from './scoring';
import { legalMoves } from './rules';
import type { GameState } from './types';

const g = buildBoardGraph();

function runSetup(s: GameState): GameState {
  const place = (st: GameState) => {
    const blocked = new Set<string>();
    for (const b of st.buildings) {
      blocked.add(b.vertexId);
      for (const n of g.vertexNeighbors[b.vertexId]) blocked.add(n);
    }
    const vertex = g.vertices.find(
      (v) => !blocked.has(v) && g.vertexEdges[v].some((e) => !st.routes.some((r) => r.edgeId === e)),
    )!;
    const edge = g.vertexEdges[vertex].find((e) => !st.routes.some((r) => r.edgeId === e))!;
    const who = st.activePlayerId;
    let r = applyMove(st, { type: 'BUILD', building: 'HABITAT', locationId: vertex }, who);
    expect(r.error).toBeUndefined();
    r = applyMove(r.state, { type: 'BUILD_ROUTE', edgeId: edge }, who);
    expect(r.error).toBeUndefined();
    return r.state;
  };
  let st = s;
  for (let i = 0; i < 4; i++) st = place(st);
  return st;
}

describe('integration', () => {
  it('plays setup then a couple of turns without producing an invalid state', () => {
    let s = createGame({
      id: 'g',
      code: 'INTEG1',
      seed: 11,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s = runSetup(s);
    expect(s.phase).toBe('play');

    // p1 rolls a non-7, takes no action, ends turn.
    let r = applyMove(s, { type: 'ROLL', roll: [2, 3] }, 'p1'); // 5
    expect(r.error).toBeUndefined();
    expect(r.state.turnPhase).toBe('ACTIONS');
    // every legal move applies cleanly
    for (const m of legalMoves(r.state, 'p1')) {
      expect(applyMove(r.state, m, 'p1').error).toBeUndefined();
    }
    r = applyMove(r.state, { type: 'END_TURN' }, 'p1');
    expect(r.state.activePlayerId).toBe('p2');
    expect(r.state.turnPhase).toBe('AWAIT_ROLL');

    // VP is a non-negative number for both players.
    expect(playerVP(r.state, 'p1')).toBeGreaterThanOrEqual(0);
    expect(playerVP(r.state, 'p2')).toBeGreaterThanOrEqual(0);
  });

  it('grants RES via a Lab roll and lets the active player research', () => {
    let s = createGame({
      id: 'g',
      code: 'INTEG2',
      seed: 11,
      p1: { id: 'p1', name: 'A' },
      p2: { id: 'p2', name: 'B' },
    });
    s = runSetup(s);
    // Give p1 plenty of RES directly and confirm research works end-to-end.
    s.players[0].resources.RES = 5;
    s.turnPhase = 'ACTIONS';
    s.lastRoll = [2, 3];
    const r = applyMove(s, { type: 'RESEARCH', techId: 'ENG1' }, 'p1');
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].techs).toEqual(['ENG1']);
    expect(playerVP(r.state, 'p1')).toBeGreaterThanOrEqual(1); // tech adds VP
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run src/game/integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/game/integration.test.ts
git commit -m "test: engine integration smoke test"
```

---

## Task D: Full green gate

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all suites pass (rng, board, state, rules, production, reducer, scoring, tech, missions, integration).

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck` then `npm run build`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: vp-layer green — full suite passing" --allow-empty
```

---

## Self-Review

**Spec coverage (Plan 3's slice):**
- §3.7 Tech Tree: 12 techs, 2/3/3/4 cost, in-order purchase, 1 VP each capped at 4 → Tasks B1, B2. Effects ENG1–4, BIO1–4, ASTRO3–4 → B3, B4 + scoring. ASTRO1/ASTRO2 researchable but effect-deferred (documented). ✓
- §3.8 Missions: 18 defs, claim on your turn if condition holds, board-of-3 with redraw, VP + bonus → Tasks C1, C2, C3. ✓
- §3.9 Longest Route: ≥5 contiguous = 2 VP, ties to first achiever, recomputed on placement → Tasks A2, A3. ✓
- §3.10 VP total now = buildings (+fortified domes) + longest route + tech (≤4) + missions → `playerVP` in C3; win check already consumes `playerVP` (Plan 2). ✓

**Placeholder scan:** all code steps contain complete source. The two deferred ASTRO effects are an explicit, documented scope boundary (they grant VP + satisfy ordering; no resource/VP behavior is faked).

**Type consistency:**
- `TechDef`/`TECHS`/`techById`/`hasTech`/`nextResearchable` names match between `tech.ts`, `reducer.ts`, `scoring.ts`.
- `MissionDef`/`MISSIONS`/`missionById`/`missionCtx`/`MissionCtx` match between `missions.ts`, `reducer.ts`, `scoring.ts`.
- `recomputeLongestRoute(g, state)`, `longestRouteLength(g, routes, playerId)`, `longestRouteVP`, `techVP`, `missionVP`, `buildingVP`, `playerVP` signatures consistent across `scoring.ts` call sites.
- `PlayerStats` fields (`dustPlacements`, `tradesWithOpponent`, `sevensRolled`, `dustDamageTaken`, `routesThisTurn`) referenced identically in `reducer.ts` and `missions.ts`.
- **Import cycle explicitly broken** (Task C3 note): `missions.ts` does not import `scoring.ts`; `sprinter` uses `player.longestRoute` (kept current by `recomputeLongestRoute`).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-mars-frontier-vp-layer.md`.

Executed inline in this session via superpowers:executing-plans.
