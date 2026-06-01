import type { Resource } from '../game/types';

export const RESOURCE_META: Record<Resource, { label: string; color: string; glyph: string }> = {
  O2: { label: 'Oxygen', color: '#4ade80', glyph: 'O₂' },
  H2O: { label: 'Water', color: '#3b82f6', glyph: 'H₂O' },
  ORE: { label: 'Ore', color: '#fb923c', glyph: '⛰' },
  ENG: { label: 'Energy', color: '#facc15', glyph: '⚡' },
  RES: { label: 'Research', color: '#a78bfa', glyph: '🔬' },
};
