import type { Hex as HexT, Terrain } from '../../game/types';
import { numberPips } from '../../game/board';
import { TERRAIN_META, RESOURCE_META } from '../format';

// Deterministic per-hex PRNG so the drawn terrain features vary tile-to-tile but
// stay stable across re-renders (seeded from the hex id).
function makeRng(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Hand-drawn terrain features — the "illustration" that makes each tile read like
// a Catan terrain rather than a flat color. Kept within ~r0.55 of center so they
// never collide with the resource badge (top) or number token (bottom).
function TerrainMotif({
  terrain,
  cx,
  cy,
  rng,
}: {
  terrain: Terrain;
  cx: number;
  cy: number;
  rng: () => number;
}) {
  const at = (spread: number): [number, number] => [
    cx + (rng() - 0.5) * spread,
    cy + (rng() - 0.5) * spread * 0.7,
  ];

  switch (terrain) {
    case 'CRATER': {
      const els = [];
      for (let i = 0; i < 3; i++) {
        const [x, y] = at(1.0);
        const r = 0.1 + rng() * 0.14;
        els.push(
          <g key={i}>
            <ellipse cx={x} cy={y} rx={r} ry={r * 0.66} fill="#000000" opacity={0.32} />
            <ellipse cx={x} cy={y - r * 0.14} rx={r * 0.74} ry={r * 0.46} fill="#d6a87f" opacity={0.22} />
          </g>,
        );
      }
      return <>{els}</>;
    }
    case 'RIDGE': {
      const els = [];
      for (let i = 0; i < 4; i++) {
        const [x, y] = at(1.05);
        const w = 0.16 + rng() * 0.2;
        els.push(
          <polygon
            key={i}
            points={`${x},${y} ${x + w},${y + w * 0.5} ${x + w * 0.45},${y - w * 0.65}`}
            fill="#2a1206"
            opacity={0.42}
          />,
        );
      }
      return <>{els}</>;
    }
    case 'ICE': {
      const els = [];
      for (let i = 0; i < 4; i++) {
        const [x, y] = at(1.05);
        const dx = (rng() - 0.5) * 0.55;
        const dy = (rng() - 0.5) * 0.45;
        els.push(
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x + dx}
            y2={y + dy}
            stroke="#eef6fb"
            strokeWidth={0.024}
            opacity={0.6}
            strokeLinecap="round"
          />,
        );
      }
      return <>{els}</>;
    }
    case 'PLAIN': {
      const els = [];
      for (let i = 0; i < 7; i++) {
        const [x, y] = at(1.15);
        els.push(<circle key={i} cx={x} cy={y} r={0.025 + rng() * 0.03} fill="#86b35e" opacity={0.5} />);
      }
      return <>{els}</>;
    }
    case 'LAB': {
      return (
        <g>
          <path d={`M ${cx - 0.2} ${cy + 0.12} a 0.2 0.2 0 0 1 0.4 0 Z`} fill="#2a2038" opacity={0.85} />
          <path
            d={`M ${cx - 0.2} ${cy + 0.12} a 0.2 0.2 0 0 1 0.4 0`}
            fill="none"
            stroke="#d9ccec"
            strokeWidth={0.028}
            opacity={0.8}
          />
          <line x1={cx} y1={cy - 0.06} x2={cx} y2={cy - 0.26} stroke="#d9ccec" strokeWidth={0.028} opacity={0.8} />
          <circle cx={cx} cy={cy - 0.28} r={0.03} fill="#a78bfa" />
        </g>
      );
    }
    case 'LAKE': {
      const els = [];
      for (let i = 0; i < 3; i++) {
        const y = cy - 0.08 + i * 0.16;
        els.push(
          <path
            key={i}
            d={`M ${cx - 0.3} ${y} q 0.15 -0.1 0.3 0 t 0.3 0`}
            stroke="#9fd4e6"
            strokeWidth={0.024}
            fill="none"
            opacity={0.5}
          />,
        );
      }
      return <>{els}</>;
    }
    default:
      return null;
  }
}

export default function Hex(props: {
  hex: HexT;
  cx: number;
  cy: number;
  corners: [number, number][];
  hasStorm: boolean;
}) {
  const { hex, cx, cy, corners, hasStorm } = props;
  const points = corners.map(([x, y]) => `${x},${y}`).join(' ');
  const meta = TERRAIN_META[hex.terrain];
  const hot = hex.number === 6 || hex.number === 8;
  const pips = hex.number !== null ? numberPips(hex.number) : 0;
  const pipSpan = (pips - 1) * 0.06;
  const rng = makeRng(hex.id);
  const tokenY = cy + 0.4;

  return (
    <g>
      {/* base terrain color */}
      <polygon points={points} fill={`url(#grad-${hex.terrain})`} stroke="#1a0d06" strokeWidth={0.05} />
      {/* rocky + dusty grain, clipped to the tile */}
      <polygon points={points} fill="url(#grainDark)" opacity={0.28} />
      <polygon points={points} fill="url(#grainLite)" opacity={0.16} />
      {/* drawn terrain features */}
      <TerrainMotif terrain={hex.terrain} cx={cx} cy={cy} rng={rng} />
      {/* lit-from-above depth */}
      <polygon points={points} fill="url(#hexShade)" />

      {/* resource badge — top of the tile, clear of the number token */}
      {meta.produces && (
        <g>
          <circle
            cx={cx}
            cy={cy - 0.46}
            r={0.17}
            fill="#160b06d9"
            stroke={RESOURCE_META[meta.produces].color}
            strokeWidth={0.03}
          />
          <text
            x={cx}
            y={cy - 0.45}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={0.17}
            fontWeight="bold"
            fill={RESOURCE_META[meta.produces].color}
          >
            {RESOURCE_META[meta.produces].glyph}
          </text>
        </g>
      )}

      {/* number token — Catan-style cream disc, low so it never hides the art */}
      {hex.number !== null && (
        <g>
          <circle
            cx={cx}
            cy={tokenY}
            r={0.27}
            fill="#f4ead3"
            stroke={hot ? '#c0341a' : '#7a5a2a'}
            strokeWidth={0.03}
          />
          <text
            x={cx}
            y={tokenY - 0.04}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={hot ? 0.34 : 0.3}
            fill={hot ? '#c0341a' : '#3a2a14'}
            fontWeight="bold"
            fontFamily="'Space Grotesk', sans-serif"
          >
            {hex.number}
          </text>
          {/* probability pips */}
          {Array.from({ length: pips }).map((_, i) => (
            <circle
              key={i}
              cx={cx - pipSpan / 2 + i * 0.06}
              cy={tokenY + 0.16}
              r={0.018}
              fill={hot ? '#c0341a' : '#5a4424'}
            />
          ))}
        </g>
      )}

      {hasStorm && (
        <polygon points={points} fill="#ff6b35" opacity={0.32} className="animate-pulse" />
      )}
    </g>
  );
}
