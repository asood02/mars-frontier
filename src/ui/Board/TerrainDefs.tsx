import { TERRAIN_META } from '../format';
import type { Terrain } from '../../game/types';

// Per-terrain radial gradients + reusable rocky/dusty grain so every hex reads as
// real Martian soil rather than a flat fill. The grain is computed once via
// feTurbulence and tiled as a pattern, then stamped (clipped) onto each tile.
export default function TerrainDefs() {
  const terrains = Object.keys(TERRAIN_META) as Terrain[];
  return (
    <defs>
      {/* lit-from-above vignette: subtle highlight up top, shadow pooling at the base */}
      <linearGradient id="hexShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.14} />
        <stop offset="45%" stopColor="#000000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.45} />
      </linearGradient>

      {/* dark rocky speckle */}
      <filter id="grainDarkF" x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="3.2"
          numOctaves="3"
          seed="11"
          stitchTiles="stitch"
          result="n"
        />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0.55 0"
        />
      </filter>
      <pattern id="grainDark" width="1.2" height="1.2" patternUnits="userSpaceOnUse">
        <rect width="1.2" height="1.2" filter="url(#grainDarkF)" />
      </pattern>

      {/* pale dust highlight */}
      <filter id="grainLiteF" x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="2.4"
          numOctaves="2"
          seed="29"
          stitchTiles="stitch"
          result="n"
        />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 1
                  0 0 0 0 0.9
                  0 0 0 0 0.78
                  0 0 0 0.4 0"
        />
      </filter>
      <pattern id="grainLite" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
        <rect width="1.6" height="1.6" filter="url(#grainLiteF)" />
      </pattern>

      {terrains.map((t) => {
        const [c0, c1] = TERRAIN_META[t].grad;
        return (
          <radialGradient key={t} id={`grad-${t}`} cx="0.42" cy="0.34" r="0.85">
            <stop offset="0%" stopColor={c0} />
            <stop offset="100%" stopColor={c1} />
          </radialGradient>
        );
      })}
    </defs>
  );
}
