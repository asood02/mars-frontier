import type { BuildingKind, Resource, Terrain } from '../game/types';
import { BUILDING_COST, RESOURCES, TERRAIN_RESOURCE } from '../game/types';

export const RESOURCE_META: Record<Resource, { label: string; color: string; glyph: string }> = {
  O2: { label: 'Oxygen', color: '#4ade80', glyph: 'O₂' },
  H2O: { label: 'Water', color: '#3b82f6', glyph: 'H₂O' },
  ORE: { label: 'Ore', color: '#fb923c', glyph: '⛏' },
  ENG: { label: 'Energy', color: '#facc15', glyph: '⚡' },
  RES: { label: 'Research', color: '#a78bfa', glyph: '🔬' },
};

// Representative imagery + the resource each terrain yields (spec §3.2).
export const TERRAIN_META: Record<
  Terrain,
  { label: string; icon: string; produces: Resource | null; grad: [string, string] }
> = {
  PLAIN: { label: 'Plains', icon: '🌿', produces: 'O2', grad: ['#9a6a3c', '#5a3a20'] },
  RIDGE: { label: 'Ridge', icon: '⛰️', produces: 'ORE', grad: ['#8a4526', '#4a2412'] },
  CRATER: { label: 'Crater', icon: '🔆', produces: 'ENG', grad: ['#7d5648', '#3a261d'] },
  ICE: { label: 'Ice Field', icon: '🧊', produces: 'H2O', grad: ['#bcd8e6', '#6c8fa3'] },
  LAB: { label: 'Lab', icon: '🔬', produces: 'RES', grad: ['#7b6790', '#3d2f4c'] },
  LAKE: { label: 'Crater Lake', icon: '🌊', produces: null, grad: ['#23606f', '#0c2c38'] },
};

// Display metadata for everything you can build — the shared source of truth for
// the Guide card and any build UI. VP values mirror src/game/scoring.ts.
export const BUILDING_META: Record<
  BuildingKind | 'ROUTE',
  { label: string; icon: string; gives: string; vp: string }
> = {
  HABITAT: {
    label: 'Habitat',
    icon: '⬡',
    gives: 'Produces 1 resource from each adjacent tile on its number',
    vp: '1 VP',
  },
  DOME: {
    label: 'Dome',
    icon: '◉',
    gives: 'Upgrades a Habitat — produces 2 from each adjacent tile',
    vp: '2 VP',
  },
  COMM_TOWER: {
    label: 'Comm Tower',
    icon: '◆',
    gives: 'Unlocks 2:1 market trades',
    vp: '1 VP',
  },
  ROUTE: {
    label: 'Rover Route',
    icon: '▬',
    gives: 'Connects your colony — the longest route (5+) scores',
    vp: '2 VP (longest)',
  },
};

export type Buildable = keyof typeof BUILDING_META;
export const BUILDABLES = Object.keys(BUILDING_META) as Buildable[];

// Terrain label(s) whose production yields this resource (inverts TERRAIN_RESOURCE).
export function producedByTerrains(resource: Resource): string[] {
  return (Object.keys(TERRAIN_META) as Terrain[])
    .filter((t) => TERRAIN_RESOURCE[t] === resource)
    .map((t) => TERRAIN_META[t].label);
}

// Building label(s) whose cost includes this resource (scans BUILDING_COST).
export function usedForBuildings(resource: Resource): string[] {
  return BUILDABLES.filter((b) => (BUILDING_COST[b][resource] ?? 0) > 0).map(
    (b) => BUILDING_META[b].label,
  );
}

// One-line "what this resource does" string, used for tooltips.
export function resourceHelp(resource: Resource): string {
  const from = producedByTerrains(resource).join(', ') || '—';
  const use = usedForBuildings(resource).join(', ') || '—';
  return `${RESOURCE_META[resource].label} — produced by ${from}; used for ${use}`;
}

// The cost of a buildable as [resource, amount] pairs (for rendering cost rows).
export function costPairs(b: Buildable): [Resource, number][] {
  return RESOURCES.filter((r) => (BUILDING_COST[b][r] ?? 0) > 0).map((r) => [
    r,
    BUILDING_COST[b][r] as number,
  ]);
}
