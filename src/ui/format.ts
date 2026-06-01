import type { Resource, Terrain } from '../game/types';

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
  PLAIN: { label: 'Plains', icon: '🌿', produces: 'O2', grad: ['#1f3a2a', '#10241a'] },
  RIDGE: { label: 'Ridge', icon: '⛰️', produces: 'ORE', grad: ['#3b2a18', '#21160d'] },
  CRATER: { label: 'Crater', icon: '🔆', produces: 'ENG', grad: ['#2f2742', '#1b1630'] },
  ICE: { label: 'Ice Field', icon: '🧊', produces: 'H2O', grad: ['#1a3e5a', '#0e2840'] },
  LAB: { label: 'Lab', icon: '🔬', produces: 'RES', grad: ['#322449', '#1d1632'] },
  LAKE: { label: 'Crater Lake', icon: '🌊', produces: null, grad: ['#102a44', '#08182c'] },
};
