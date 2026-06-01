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
  PLAIN: { label: 'Plains', icon: '🌿', produces: 'O2', grad: ['#9a6a3c', '#5a3a20'] },
  RIDGE: { label: 'Ridge', icon: '⛰️', produces: 'ORE', grad: ['#8a4526', '#4a2412'] },
  CRATER: { label: 'Crater', icon: '🔆', produces: 'ENG', grad: ['#7d5648', '#3a261d'] },
  ICE: { label: 'Ice Field', icon: '🧊', produces: 'H2O', grad: ['#bcd8e6', '#6c8fa3'] },
  LAB: { label: 'Lab', icon: '🔬', produces: 'RES', grad: ['#7b6790', '#3d2f4c'] },
  LAKE: { label: 'Crater Lake', icon: '🌊', produces: null, grad: ['#23606f', '#0c2c38'] },
};
