import type { Hex as HexT } from '../../game/types';

const TERRAIN_FILL: Record<string, string> = {
  PLAIN: '#1f3a2e',
  RIDGE: '#3a2a1f',
  CRATER: '#2a2336',
  ICE: '#16304a',
  LAB: '#2e2336',
  LAKE: '#0c1830',
};

export default function Hex(props: {
  hex: HexT;
  cx: number;
  cy: number;
  corners: [number, number][];
  hasStorm: boolean;
}) {
  const { hex, cx, cy, corners, hasStorm } = props;
  const points = corners.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <g>
      <polygon
        points={points}
        fill={TERRAIN_FILL[hex.terrain] ?? '#222'}
        stroke="#ffffff14"
        strokeWidth={0.03}
      />
      {hex.number !== null && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={0.5}
          fill={hex.number === 6 || hex.number === 8 ? '#ff6b35' : '#e5e7eb'}
          fontWeight="bold"
        >
          {hex.number}
        </text>
      )}
      {hasStorm && (
        <polygon points={points} fill="#ff6b35" opacity={0.28} className="animate-pulse" />
      )}
    </g>
  );
}
