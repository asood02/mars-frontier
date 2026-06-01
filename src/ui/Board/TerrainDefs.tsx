import { TERRAIN_META } from '../format';
import type { Terrain } from '../../game/types';

// Per-terrain radial gradients (richer than a flat fill) + a depth overlay.
export default function TerrainDefs() {
  const terrains = Object.keys(TERRAIN_META) as Terrain[];
  return (
    <defs>
      <linearGradient id="hexShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
        <stop offset="55%" stopColor="#000000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.4} />
      </linearGradient>
      {terrains.map((t) => {
        const [c0, c1] = TERRAIN_META[t].grad;
        return (
          <radialGradient key={t} id={`grad-${t}`} cx="0.5" cy="0.4" r="0.75">
            <stop offset="0%" stopColor={c0} />
            <stop offset="100%" stopColor={c1} />
          </radialGradient>
        );
      })}
    </defs>
  );
}
