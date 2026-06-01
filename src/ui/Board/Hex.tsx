import type { Hex as HexT } from '../../game/types';

export default function Hex(props: {
  hex: HexT;
  cx: number;
  cy: number;
  corners: [number, number][];
  hasStorm: boolean;
}) {
  const { hex, cx, cy, corners, hasStorm } = props;
  const points = corners.map(([x, y]) => `${x},${y}`).join(' ');
  const hot = hex.number === 6 || hex.number === 8;
  return (
    <g>
      <polygon points={points} fill={`url(#tex-${hex.terrain})`} stroke="#000000" strokeWidth={0.04} />
      {/* subtle top-light gradient for depth */}
      <polygon points={points} fill="url(#hexShade)" opacity={0.5} />
      {hex.number !== null && (
        <g>
          <circle cx={cx} cy={cy} r={0.32} fill="#0a0e1ad9" stroke={hot ? '#ff6b35' : '#ffffff33'} strokeWidth={0.03} />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={0.42}
            fill={hot ? '#ff6b35' : '#e5e7eb'}
            fontWeight="bold"
            fontFamily="'Space Grotesk', sans-serif"
          >
            {hex.number}
          </text>
          {hot && <circle cx={cx} cy={cy + 0.42} r={0.03} fill="#ff6b35" />}
        </g>
      )}
      {hasStorm && (
        <polygon points={points} fill="#ff6b35" opacity={0.3} className="animate-pulse" />
      )}
    </g>
  );
}
