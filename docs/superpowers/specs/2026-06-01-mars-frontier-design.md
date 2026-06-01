# Mars Frontier — Design Spec

**Date:** 2026-06-01
**Status:** Approved
**Audience:** Implementer (next-step writing-plans skill)

---

## 1. Vision

A 2-player online strategic colony-builder set on Mars. Players compete to claim terrain, build infrastructure, research technology, and survive Martian hazards. Inspired by Catan's hex-and-resource core loop, but redesigned for tight 2-player tension via a public **Mission Card** race, a **Tech Tree**, and a **Dust Storm** event in place of Catan's trade-broken-with-2-players model.

Length: 45–60 minutes per game. Target audience: anyone who has played a euro game once before; should not require reading rules — the UI teaches as you play.

**Non-goals:**
- 3+ player support (out of scope; design is balanced for exactly 2).
- AI opponent.
- Mobile-first (must work on mobile, but desktop is the primary target).
- Server-authoritative anti-cheat (clients trust each other; this is friend-vs-friend, not ranked).

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Mature, types catch game-logic bugs early |
| Build tool | Vite | Fast dev, minimal config, perfect for SPA on Netlify |
| Styling | Tailwind CSS | Speeds up modern sleek UI without leaking custom CSS |
| Animations | Framer Motion | Dice rolls, building placements, resource flights |
| Client state | Zustand | Lightweight, no boilerplate, fits a single game-state store |
| Board rendering | SVG (no canvas) | Crisp at any zoom; native hit testing; accessible |
| Backend | Supabase (Postgres + Realtime) | Free tier sufficient, official Netlify integration, gives us a DB for free |
| Auth | Supabase anonymous auth | Zero signup friction |
| Hosting | Netlify | User-requested; static SPA deploy from `/dist` |
| Test runner | Vitest | Pure game-logic reducer is fully unit-testable |

**Repository layout:**
```
mars-frontier/
├─ docs/superpowers/specs/      # this file lives here
├─ public/                       # static assets, favicon
├─ src/
│  ├─ game/                      # pure game logic (no React, no Supabase)
│  │  ├─ types.ts               # GameState, Move, Resource, Building types
│  │  ├─ board.ts               # hex generation, adjacency, number assignment
│  │  ├─ reducer.ts             # applyMove(state, move) → state
│  │  ├─ rules.ts               # legalMoves(state, player) → Move[]
│  │  ├─ tech.ts                # tech definitions
│  │  ├─ missions.ts            # mission card definitions
│  │  └─ reducer.test.ts        # unit tests for game logic
│  ├─ net/
│  │  ├─ supabase.ts            # client init
│  │  ├─ room.ts                # create/join/subscribe
│  │  └─ sync.ts                # push moves, listen for opponent moves
│  ├─ ui/
│  │  ├─ App.tsx
│  │  ├─ Lobby.tsx
│  │  ├─ Game.tsx
│  │  ├─ Board/
│  │  │  ├─ Board.tsx           # SVG board
│  │  │  ├─ Hex.tsx             # one hex tile
│  │  │  ├─ Vertex.tsx          # building placement spot
│  │  │  └─ Edge.tsx            # rover route placement spot
│  │  ├─ Hud/
│  │  │  ├─ ResourceRail.tsx
│  │  │  ├─ TurnBar.tsx
│  │  │  ├─ ActionBar.tsx
│  │  │  ├─ Dice.tsx
│  │  │  ├─ MissionPanel.tsx
│  │  │  └─ TechPanel.tsx
│  │  └─ Tutorial.tsx
│  ├─ store.ts                   # Zustand store wrapping game state + net layer
│  └─ main.tsx                   # entry, routing
├─ supabase/
│  └─ migrations/
│     └─ 0001_init.sql           # tables + RLS policies
├─ .env.example                  # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├─ netlify.toml                  # build config
├─ index.html
├─ package.json
├─ tsconfig.json
├─ tailwind.config.ts
├─ vite.config.ts
└─ README.md
```

---

## 3. Game Rules (authoritative)

### 3.1 Board
- 30 hexes arranged in a 6×6 offset grid, clipped to a rough hexagonal outline (similar shape to Catan but ~50% larger).
- Each hex has a **terrain** and a **number token** (2–12, excluding 7) determining when it produces.
- Terrain distribution: 8 Plain · 7 Ridge · 6 Crater · 6 Ice · 2 Lab · 1 blank "Crater Lake" (no production).
- Number tokens follow Catan's bell-curve frequency (more 6s and 8s, fewer 2s and 12s). Random per game.
- **Lab tiles** produce 1 Research each on their roll (no Habitat needed — global production to current player only).

### 3.2 Resources
| Resource | Code | Terrain |
|---|---|---|
| Oxygen | `O2` | Plain |
| Water | `H2O` | Ice |
| Ore | `ORE` | Ridge |
| Energy | `ENG` | Crater |
| Research | `RES` | Lab |

### 3.3 Setup
1. Both players place 1 Habitat + 1 connected Rover Route. Player 1 goes first.
2. Both players place a 2nd Habitat + Rover Route. Player 2 goes first this round (snake order).
3. Starting resources: 1 of each adjacent hex's terrain for the 2nd Habitat.
4. Player 1 starts turn 1.

### 3.4 Turn Sequence
1. **Roll** 2d6.
   - **Sum = 7** → trigger Dust Storm phase:
     - Both players with >7 cards discard `floor(count/2)` of their choice.
     - Active player moves the Dust Storm marker to any hex (cannot stay on previous hex). That hex produces nothing while occupied.
   - **Sum ≠ 7** → every hex with that number produces:
     - 1 of its resource per adjacent Habitat
     - 2 of its resource per adjacent Dome
     - If hex has the Dust Storm or is the Crater Lake, it produces nothing.
2. **Action phase** (any order, any number until "End Turn"):
   - **Trade** with opponent (mutual consent, any ratio) OR with Supply Drop (fixed 3:1, or 2:1 if you own ≥1 Comm Tower).
   - **Build** Habitat / Dome / Rover Route / Comm Tower (see costs below).
   - **Research** a Tech card (see tech tree).
   - **Claim** a Mission Card if its condition is currently met.
3. **End turn** button → opponent's turn.

### 3.5 Building costs
| Building | Cost | VP |
|---|---|---|
| Habitat | 1 O₂ + 1 H₂O + 1 ORE + 1 ENG | 1 |
| Dome (upgrade Habitat) | 2 ORE + 3 ENG | 2 (replaces Habitat's 1) |
| Rover Route | 1 ORE + 1 ENG | — |
| Comm Tower | 2 ENG + 2 RES | 1 |
| Tech Card | 2–4 RES (per card) | 1 (max 4 from tech) |

### 3.6 Placement rules
- **Habitat:** on a vertex; must be connected via your own Rover Routes to one of your existing buildings; cannot be adjacent (graph-distance 1) to any building.
- **Dome:** replaces one of your existing Habitats; same location.
- **Rover Route:** on an edge; must touch one of your existing Routes, Habitats, or Domes.
- **Comm Tower:** on a vertex adjacent to ≥2 of your buildings; only 1 per player.

### 3.7 Tech Tree
Three tracks of 4 cards each. Each card costs 2/3/3/4 Research (escalating). Each grants 1 VP + a permanent effect. Maximum 4 tech cards counted toward VP (you can buy more for the effect only).

| Track | T1 (2 RES) | T2 (3 RES) | T3 (3 RES) | T4 (4 RES) |
|---|---|---|---|---|
| **Engineering** | +1 ORE yield from Ridges | Dome costs 1 ORE 3 ENG | Build 2 Routes per turn free | Fortified Dome: Domes are worth 3 VP |
| **Biotech** | +1 O₂ yield from Plains | Ignore 7-roll discard | Habitats produce on 7 (see note) | Greenhouse: any Habitat adjacent to Ice gives +1 O₂ |

**Biotech T3 — "Habitats produce on 7" clarification:** when a 7 is rolled, the Dust Storm still moves and discards still apply for players lacking T2. But *this* player's Habitats and Domes also produce their adjacent hexes' normal resources, as if a non-7 had been rolled (Dust Storm and Crater Lake still block their hexes as normal). This stacks: T2 + T3 means no discard AND production.
| **Astrophysics** | Re-roll dice 1×/turn | Peek top mission | Trade 2:1 always | Solar Array: Domes get 3 ENG from Craters |

A player must buy tech in order within a track (T1 → T4).

### 3.8 Mission Cards
- 18-card deck shuffled at game start.
- 3 cards face up on the "Mission Board" at all times. When one is claimed, draw a replacement.
- Each mission has a condition and a reward (1–3 VP, sometimes + bonus resources).
- A player may claim a mission only on their own turn, and only if the condition is currently satisfied by their state.

**Mission examples** (18 total, designed for variety):
1. *Pioneer:* First to build 3 Habitats — 2 VP
2. *Ice Baron:* Control 3 Ice-adjacent buildings — 2 VP
3. *Engineer:* Own Comm Tower — 1 VP + 2 ENG
4. *Cartographer:* Routes touching all 4 terrains — 2 VP
5. *Geologist:* Own a building in all 4 producing terrains — 3 VP
6. *Long Haul:* Build 4 Route segments in one turn — 1 VP + 2 ENG
7. *Researcher:* Own 2 Tech Cards — 2 VP
8. *Industrialist:* Have 2 Domes — 2 VP
9. *Dustkeeper:* Be the one to place Dust Storm 3 times — 1 VP
10. *Stockpile:* Hold 10 resources at end of your turn — 1 VP
11. *Alchemist:* Trade with opponent 3 times — 1 VP + 1 RES
12. *Sprinter:* Win Longest Route (≥5 segments) — 2 VP
13. *Diversified:* Own 1 of each building type — 3 VP
14. *Astronomer:* Roll three 7s during the game — 1 VP
15. *Solar Mogul:* Control 3 Crater-adjacent buildings — 2 VP
16. *Networker:* Build 2nd Route extension to opponent's edge — 1 VP
17. *Survivor:* Take Dust Storm damage 3 times — 1 VP
18. *First Light:* Be first to research T1 of any track — 1 VP

### 3.9 Longest Route
Continuous chain of routes ≥5 segments owned by one player = **2 VP**. Recomputed after every Route placement; ties go to whoever achieved length first.

### 3.10 Victory
First player at the **start of their turn** with ≥10 VP wins. (Catan rule — gives opponent the chance to break the lead during the active turn before scoring locks.) VP sources: Habitats (1) · Domes (2) · Comm Tower (1) · Tech Cards (1 each, max 4) · Longest Route (2) · Mission Cards (1–3 each).

---

## 4. Data Model

### 4.1 Client `GameState` (TypeScript)
```ts
type Resource = 'O2' | 'H2O' | 'ORE' | 'ENG' | 'RES';
type Terrain = 'PLAIN' | 'RIDGE' | 'CRATER' | 'ICE' | 'LAB' | 'LAKE';
type BuildingKind = 'HABITAT' | 'DOME' | 'COMM_TOWER';

interface Hex { id: string; q: number; r: number; terrain: Terrain; number: number | null; }
interface Building { vertexId: string; ownerId: string; kind: BuildingKind; }
interface Route { edgeId: string; ownerId: string; }
interface PlayerState {
  id: string;
  name: string;
  resources: Record<Resource, number>;
  techs: string[];          // tech card ids
  missions: string[];       // claimed mission ids
  longestRoute: number;
  hasCommTower: boolean;
}
interface GameState {
  id: string;
  phase: 'lobby' | 'setup1' | 'setup2' | 'play' | 'gameover';
  turn: number;
  activePlayerId: string;
  players: [PlayerState, PlayerState];
  board: { hexes: Hex[]; vertices: string[]; edges: string[]; };
  buildings: Building[];
  routes: Route[];
  dustStormHexId: string | null;
  lastRoll: [number, number] | null;
  missionDeck: string[];           // remaining card ids (face-down)
  missionsOnBoard: string[];       // 3 visible mission ids
  log: GameEvent[];                // human-readable turn history
  winnerId: string | null;
}
```

### 4.2 `Move` types (all moves the reducer accepts)
```ts
type Move =
  | { type: 'ROLL'; roll: [number, number] }
  | { type: 'MOVE_DUST_STORM'; hexId: string }
  | { type: 'DISCARD'; cards: Partial<Record<Resource, number>> }
  | { type: 'TRADE_PLAYER'; offer: Partial<Record<Resource, number>>; want: Partial<Record<Resource, number>>; accepted: boolean }
  | { type: 'TRADE_MARKET'; give: Resource; receive: Resource }
  | { type: 'BUILD'; building: BuildingKind; locationId: string }
  | { type: 'BUILD_ROUTE'; edgeId: string }
  | { type: 'RESEARCH'; techId: string }
  | { type: 'CLAIM_MISSION'; missionId: string }
  | { type: 'END_TURN' };
```

The reducer is pure: `applyMove(state, move, playerId) → { state, error? }`. All legality is checked inside.

### 4.3 Supabase schema
```sql
-- migrations/0001_init.sql
create table games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,         -- 6-char room code
  state jsonb not null,              -- full GameState
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table moves (
  id bigserial primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_id text not null,
  move jsonb not null,
  applied_at timestamptz default now()
);

alter publication supabase_realtime add table games;
-- RLS: anyone with the room code can read/write the game row.
-- For v1, we trust clients (friend vs friend). Anti-cheat can be added later
-- by moving applyMove into a Postgres function.
```

### 4.4 Sync flow
1. Player makes a legal move locally → reducer updates state → push `{move, newState}` to Supabase (`UPDATE games SET state = $1`, `INSERT INTO moves`).
2. Opponent's Realtime subscription on `games` fires → replaces local state with received state.
3. Single-writer-per-turn invariant: only `activePlayerId` can write. Enforced client-side and via RLS policy `WHERE state->>'activePlayerId' = auth.uid()`.

---

## 5. UI / UX

### 5.1 Visual language
- **Background:** deep space navy `#0a0e1a` with subtle starfield (CSS gradient + ::before noise).
- **Primary:** Mars orange `#ff6b35`.
- **Accent:** Cyan `#00d9ff`.
- **Resource colors:** O₂ green `#4ade80` · H₂O blue `#3b82f6` · ORE orange `#fb923c` · ENG yellow `#facc15` · RES purple `#a78bfa`.
- **Type:** `Inter` (UI) + `Space Grotesk` (display headings).
- **Surfaces:** Glassmorphism panels (`bg-white/5 backdrop-blur border border-white/10`).
- **Iconography:** Lucide icons + custom flat resource glyphs.

### 5.2 Screens
1. **Landing:** big "Mars Frontier" title, two buttons: **Create Game** / **Join Game**.
2. **Lobby:** room code displayed large, copy button, "Waiting for player 2…" / "Start" once full.
3. **Game:** the board + HUD (described below).
4. **Game Over:** winner screen with stats (turns played, missions completed, resources spent), "Rematch" / "Home".

### 5.3 In-game layout (desktop)
```
┌─────────────────────────────────────────────────────────────┐
│ TURN BAR: P1 ●●●●●● 6VP  |  TURN 12  |  P2 ●●●● 4VP        │
├──────────────────────────────────────────┬──────────────────┤
│                                          │ YOUR RESOURCES   │
│                                          │ O₂ 3 H₂O 2 ...   │
│            HEX BOARD (SVG)               │                  │
│                                          │ MISSIONS         │
│                                          │ [card][card][card│
│                                          │                  │
│                                          │ TECH             │
│                                          │ [eng][bio][astro]│
├──────────────────────────────────────────┴──────────────────┤
│ DICE [⚂⚄=9]  [Build ▾] [Trade ▾] [Research ▾] [End Turn]   │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Mobile layout
- Board fills viewport above the fold; HUD collapses into tabs at the bottom (Resources / Missions / Tech / Log).
- Action bar fixed at bottom with the four buttons.

### 5.5 Animations (Framer Motion)
- Dice: 800ms tumble with shadow-bounce, lands on final value with 1px elastic settle.
- Resource fly: SVG resource icon spawns at producing hex, arcs to player rail in 400ms.
- Building drop-in: opacity 0 → 1, scale 0.6 → 1, 300ms spring.
- Dust Storm: pulsing orange overlay on the hex, drifting particle backdrop.
- Mission claim: card lifts out of slot, glows orange, deposits into player's missions list.

### 5.6 Onboarding
First-time players get 5 anchored tooltips on their first turn: (1) "These are your resources." (2) "Click a hex to see what it produces." (3) "Press Build to place your first Habitat." (4) "Roll the dice to start your turn." (5) "First to 10 VP wins." Dismissible, never shown again (localStorage flag).

### 5.7 Accessibility
- All interactive SVG elements have `role="button"`, `aria-label`, keyboard focus, and visible focus ring.
- Color is never the only indicator — every resource has both color and icon.
- Color-blind-safe palette (verified against Coblis simulator).
- Min font size 14px; min tap target 44×44px on mobile.

---

## 6. Multiplayer Flow

1. **Create:** Player A → POST `games` (state=initialGameState, code=randomCode6()) → navigate to `/g/{code}`.
2. **Join:** Player B enters code → SELECT game by code → write self into `state.players[1]` → state.phase transitions to `setup1`.
3. **Sync:** both clients subscribe to `games:id=eq.{id}` realtime channel.
4. **Move:** active client applies move locally → UPDATE games row with new state → INSERT moves row for audit.
5. **Disconnect:** localStorage stores `{gameId, playerId}` — refresh re-enters the game immediately.
6. **Turn timer:** 60s default. Visible countdown on active player's screen; auto-passes if expired (the other client can call a "force pass" RPC).
7. **Game end:** state.phase = 'gameover', state.winnerId set; both clients show Game Over screen; Rematch button reuses the same room code and resets state.

---

## 7. Testing Strategy

- **Unit tests (Vitest):** every reducer case (`reducer.test.ts`) — legality checks, resource math, VP calculation, win condition, edge cases (empty hands, illegal placements, dust storm).
- **Property tests:** for each move type, applying a sequence of random legal moves never produces an invalid state.
- **Component smoke tests:** Board renders 30 hexes, dice button rolls, action bar disabled when not your turn.
- **Manual playtest:** two browsers locally; one full game per major milestone.
- No E2E test framework for v1 (overkill).

---

## 8. Deployment

- `netlify.toml`:
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
- Env vars set in Netlify UI: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Supabase project provisioned separately; migration applied via Supabase CLI or web dashboard.

---

## 9. Out-of-Scope (deferred)

- AI opponent
- 3+ player support
- Ranked/ELO matchmaking
- Anti-cheat (server-authoritative reducer)
- Persistent player profiles / login
- Mobile-app shell
- Sound effects (could ship as polish phase)
- Localization

---

## 10. Open Questions

None — all design decisions are made. Implementation can proceed.
