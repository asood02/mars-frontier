import type { Hex as HexT } from '../../game/types';
import { numberPips } from '../../game/board';
import { TERRAIN_META, RESOURCE_META } from '../format';

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
  const pipSpan = (pips - 1) * 0.07;

  return (
    <g>
      <polygon points={points} fill={`url(#grad-${hex.terrain})`} stroke="#000000" strokeWidth={0.04} />
      {/* representative terrain icon, faint, behind the token */}
      <text
        x={cx}
        y={cy - 0.04}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={0.85}
        opacity={0.32}
      >
        {meta.icon}
      </text>
      <polygon points={points} fill="url(#hexShade)" opacity={0.55} />

      {/* produced-resource badge (bottom of tile) */}
      {meta.produces && (
        <text
          x={cx}
          y={cy + 0.66}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={0.22}
          fontWeight="bold"
          fill={RESOURCE_META[meta.produces].color}
        >
          {RESOURCE_META[meta.produces].glyph}
        </text>
      )}

      {hex.number !== null && (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={0.34}
            fill="#0a0e1ae6"
            stroke={hot ? '#ff6b35' : '#ffffff33'}
            strokeWidth={0.035}
          />
          <text
            x={cx}
            y={cy - 0.06}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={0.4}
            fill={hot ? '#ff6b35' : '#e5e7eb'}
            fontWeight="bold"
            fontFamily="'Space Grotesk', sans-serif"
          >
            {hex.number}
          </text>
          {/* probability pips */}
          {Array.from({ length: pips }).map((_, i) => (
            <circle
              key={i}
              cx={cx - pipSpan / 2 + i * 0.07}
              cy={cy + 0.2}
              r={0.022}
              fill={hot ? '#ff6b35' : '#cbd5e1'}
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
