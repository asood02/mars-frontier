# Mars Frontier

A **2–4 player** online strategic colony-builder set on Mars — a Catan-inspired hex-and-resource
core loop with a Mission Card race, a Tech Tree, a Dust Storm, coastal **trade depots**, and a
shared **Terraforming** track. The board scales with the player count. First to **10 victory
points** wins.

Victory points come from buildings, the longest rover route, tech, mission cards, and contributing
to terraforming (each milestone you cross scores VP). Trade depots on the coast give 2:1 trades, and
once terraforming warms the planet the Crater Lakes thaw into water sources.

## Stack

- **React 18 + TypeScript + Vite** front end, **Tailwind** styling, **SVG** board.
- **Zustand** store wrapping a pure, fully unit-tested game reducer (`src/game/`).
- **WebSocket relay** (`server/`) for online play — no database or account required.
- **Vitest** + Testing Library (118 tests).

## Run

```bash
npm install

# Local hotseat (two players, one screen):
npm run dev            # http://localhost:5173 → "New Local Game"

# Online play (two browsers / devices):
npm run server         # starts the relay on ws://localhost:8787
npm run dev            # in another terminal
# → one player clicks "Host Online" and shares the 6-char room code;
#   the other clicks "Join Online" and enters it.
```

Point the client at a different relay with `VITE_WS_URL` (see `.env.example`). The relay is a tiny
stateless hub; deploy it anywhere that runs Node + WebSockets to play over the internet.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md). In short: the static frontend goes on any static host
(Netlify/Vercel — configs included) and the WebSocket relay goes on any Node/container host
(Render blueprint `render.yaml` or the included `Dockerfile`). Point the frontend at the relay
with `VITE_WS_URL=wss://<your-relay>` and rebuild.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run server` | WebSocket relay for online play |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm test` | Full Vitest suite |
| `npm run typecheck` | `tsc -b --noEmit` |

## Project layout

```
src/game/    pure game engine (types, board, reducer, rules, tech, missions, scoring) — no React
src/net/     WebSocket transport + relay room logic tests
src/ui/      React components (Board, HUD, Lobby, screens)
src/store.ts Zustand store: local + online modes
server/      WebSocket relay (run with `npm run server`)
docs/superpowers/  design spec + implementation plans
```

## Status

Engine, local hotseat, and online multiplayer are complete and tested. Deferred polish: Framer-Motion
production/placement animations, onboarding tooltips, a dedicated mobile tab layout, a player-to-player
trade modal, and sound. A hosted Supabase backend is supported as an alternative transport but optional
— the bundled WebSocket relay needs no account.
