# UI Clarity Quick-Wins — Design

**Date:** 2026-06-01
**Status:** Approved (design); pending spec review
**Workstream:** #0 of the "ports + multiplayer + Mars mechanics" expansion (see conversation). Independent of the other workstreams — pure UI, no engine or relay changes.

## Goal

Make the game readable to a new player without external instructions:

1. Explain **what each resource does** — where it comes from and what it's spent on.
2. Provide a **Catan-style building/cost reference card** — each building's cost and what it gives.
3. Make the **resource symbols on board tiles larger** and clearly legible.

Non-goals: no changes to game rules, scoring, production, networking, or the number of players. This is presentation only.

## Approach

A single **Guide reference card** opened from a button in the top bar (chosen over an always-visible sidebar panel or tooltip-only, because the sidebar is already dense and will get denser with 3–4 players later; an on-demand overlay scales and mirrors a physical Catan reference card). Lightweight hover tooltips on the resource counters are added as a complement, not a replacement.

All reference content is **derived from existing constants** so it cannot drift from real game behavior.

## Components

### 1. `BUILDING_META` (in `src/ui/format.ts`)

A new exported record giving each buildable a display label, icon, and a short "gives" description. This is the shared source of truth for the Guide card and any future build UI.

```ts
export const BUILDING_META: Record<
  BuildingKind | 'ROUTE',
  { label: string; icon: string; gives: string; vp: string }
> = {
  HABITAT:    { label: 'Habitat',    icon: '⬡', gives: 'Produces 1 resource from each adjacent tile on its number', vp: '1 VP' },
  DOME:       { label: 'Dome',       icon: '◉', gives: 'Upgrades a Habitat; produces 2 from each adjacent tile',     vp: '2 VP' },
  COMM_TOWER: { label: 'Comm Tower', icon: '◆', gives: 'Unlocks 2:1 market trades',                                  vp: '1 VP' },
  ROUTE:      { label: 'Rover Route',icon: '▬', gives: 'Connects your colony; longest route (5+) scores',            vp: '2 VP (longest)' },
};
```

Exact icon/label/wording may be refined during implementation to match the existing visual language, but the shape and the four entries are fixed. Building VP values must match `src/game/scoring.ts` (Habitat 1, Comm Tower 1, Dome 2, longest route 2). The Dome "Fortified" tech (3 VP) is a tech effect and is intentionally not shown on the base card.

### 2. `GuideCard` component (`src/ui/Hud/GuideCard.tsx`)

A dismissible modal overlay using the same styling conventions as `src/ui/Tutorial.tsx` (centered card, dimmed backdrop, close affordance, `role="dialog"`/`aria-label`). Closes via a Close button and backdrop click.

Two sections:

- **Resources** — one row per `Resource` in `RESOURCES` order. Each row shows:
  - the colored glyph + name (from `RESOURCE_META`);
  - **Produced by:** the terrain label(s) that yield it — computed by inverting `TERRAIN_RESOURCE` and mapping the terrain to `TERRAIN_META[...].label`;
  - **Used for:** the building labels whose `BUILDING_COST` includes this resource — computed by scanning `BUILDING_COST` and mapping keys through `BUILDING_META`.
- **Buildings** — one row per key of `BUILDING_COST` (`HABITAT`, `DOME`, `COMM_TOWER`, `ROUTE`). Each row shows:
  - icon + label (from `BUILDING_META`);
  - **Cost:** the resource glyphs × counts from `BUILDING_COST`, each glyph colored via `RESOURCE_META`;
  - **Gives:** the `gives` text + `vp` from `BUILDING_META`.

The component is pure/derived — it reads only constants, takes no game state, and has no side effects beyond calling `closeGuide`.

### 3. Store toggle (`src/store.ts`)

Add `guideOpen: boolean` plus `openGuide` / `closeGuide` actions, mirroring the existing `tutorialOpen` / `openTutorial` / `closeTutorial` pattern. Default `false`. No persistence (unlike the tutorial's `localStorage` "seen" flag) — the Guide is reference, openable anytime.

### 4. Top-bar button (`src/ui/Hud/TurnBar.tsx`)

Add a **"Guide"** button next to the existing `?` (How to play) button, wired to `openGuide`. Same visual treatment as the `?` button (small, bordered, hover state), labeled "Guide" with an appropriate `title`/`aria-label`.

### 5. App wiring (`src/ui/App.tsx`)

Render `{guideOpen && <GuideCard />}` alongside the existing `{tutorialOpen && <Tutorial />}`.

### 6. Resource tooltips (`src/ui/Hud/ResourceRail.tsx`)

Add a `title` attribute to each resource counter: `"<name> — produced by <terrain>, used for <buildings>"`, derived the same way as the Guide rows. Purely additive; no layout change.

### 7. Larger tile badge (`src/ui/Board/Hex.tsx`)

Enlarge the existing resource badge: circle radius `0.17 → 0.245`, glyph font size `0.17 → 0.24`. Keep it centered at roughly `cy - 0.46` (verify it stays clear of the top vertex and does not collide with the number token at `cy + 0.4`); nudge upward slightly only if needed for clearance. No change to the number token or terrain art.

## Data Flow

```
constants (RESOURCE_META, TERRAIN_RESOURCE, TERRAIN_META, BUILDING_COST, BUILDING_META)
        │  (pure derivation: invert / scan)
        ▼
   GuideCard rows  ──renders──▶ overlay
   ResourceRail title strings ──renders──▶ tooltips
```

No new game state, no reducer changes, no network messages.

## Error Handling

None required — the card is static reference derived from compile-time constants. If a constant is missing a mapping (e.g., a terrain with no resource), the derivation simply omits it; the LAKE terrain (produces nothing) correctly contributes to no resource's "produced by" list.

## Testing

`src/ui/Hud/GuideCard.test.tsx` (Testing Library, matching `Tutorial.test.tsx` / `Landing.test.tsx` conventions):

- renders a row for all 5 resources (assert each `RESOURCE_META` name is present);
- renders a row for all 4 buildings (assert each `BUILDING_META` label is present);
- shows at least one cost glyph and one "produced by" terrain (sanity that derivation ran).

A store/TurnBar interaction check: clicking the Guide button sets `guideOpen` / renders the card (can live in `GuideCard.test.tsx` or `Hud.test.tsx`).

Existing tests must remain green; the Board/Hex tests only assert polygon counts and labels, which are unaffected by badge sizing.

## Files

| File | Change |
|---|---|
| `src/ui/format.ts` | add `BUILDING_META` |
| `src/ui/Hud/GuideCard.tsx` | new — the reference overlay |
| `src/ui/Hud/GuideCard.test.tsx` | new — tests |
| `src/store.ts` | add `guideOpen` + `openGuide`/`closeGuide` |
| `src/ui/App.tsx` | render `<GuideCard/>` when open |
| `src/ui/Hud/TurnBar.tsx` | add "Guide" button |
| `src/ui/Hud/ResourceRail.tsx` | add tooltips |
| `src/ui/Board/Hex.tsx` | enlarge resource badge |

## Verification

- `npm run typecheck` clean; `npm test` all green (incl. new GuideCard test).
- Manual (Playwright, local): open a game → click **Guide** → card shows all resources with produced-by/used-for and all buildings with costs → close it; confirm tile badges are visibly larger and legible.
