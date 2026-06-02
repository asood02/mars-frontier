import type { BuildingKind } from '../../game/types';

// Drawn building structures so each piece reads as what it is:
//   HABITAT    — a domed habitat pod with an airlock
//   DOME       — a larger geodesic dome with lattice struts
//   COMM_TOWER — a lattice mast with a dish
// All tinted by the owning player's color, with a dark outline for contrast.
export default function Vertex(props: {
  pos: [number, number];
  kind: BuildingKind | null;
  color: string | null; // owning player's color
  legal: boolean;
  onClick?: () => void;
}) {
  const { pos, kind, color, legal, onClick } = props;
  const [x, y] = pos;
  const c = color ?? '#94a3b8';
  const ink = '#0a0e1a';
  if (!kind && !legal) return null;

  return (
    <g
      role={legal ? 'button' : undefined}
      aria-label={legal ? 'Build here' : undefined}
      className={legal ? 'cursor-pointer' : ''}
      onClick={legal ? onClick : undefined}
    >
      {legal && (
        <circle
          cx={x}
          cy={y}
          r={0.13}
          fill="#facc15"
          fillOpacity={0.12}
          stroke="#facc15"
          strokeWidth={0.035}
          strokeOpacity={0.85}
          className="animate-pulse"
        />
      )}

      {kind === 'HABITAT' && (
        <g stroke={ink} strokeWidth={0.03} strokeLinejoin="round">
          {/* domed pod on a base, with a small airlock */}
          <rect x={x - 0.17} y={y + 0.03} width={0.34} height={0.07} rx={0.02} fill={c} />
          <path d={`M ${x - 0.17} ${y + 0.04} A 0.17 0.17 0 0 1 ${x + 0.17} ${y + 0.04} Z`} fill={c} />
          <rect x={x - 0.045} y={y - 0.02} width={0.09} height={0.1} fill={ink} opacity={0.55} stroke="none" />
        </g>
      )}

      {kind === 'DOME' && (
        <g stroke={ink} strokeWidth={0.035} strokeLinejoin="round">
          <circle cx={x} cy={y} r={0.23} fill={c} />
          {/* geodesic struts */}
          <g stroke={ink} strokeWidth={0.022} opacity={0.55} fill="none">
            <path d={`M ${x - 0.23} ${y} h 0.46`} />
            <path d={`M ${x} ${y - 0.23} v 0.46`} />
            <path d={`M ${x - 0.16} ${y - 0.16} L ${x + 0.16} ${y + 0.16}`} />
            <path d={`M ${x - 0.16} ${y + 0.16} L ${x + 0.16} ${y - 0.16}`} />
          </g>
          <circle cx={x} cy={y} r={0.06} fill="#ffffff" opacity={0.85} stroke="none" />
        </g>
      )}

      {kind === 'COMM_TOWER' && (
        <g stroke={ink} strokeWidth={0.03} strokeLinejoin="round">
          {/* lattice mast */}
          <polygon points={`${x - 0.13},${y + 0.18} ${x + 0.13},${y + 0.18} ${x + 0.05},${y - 0.15} ${x - 0.05},${y - 0.15}`} fill={c} />
          <line x1={x - 0.08} y1={y + 0.03} x2={x + 0.08} y2={y + 0.03} stroke={ink} strokeWidth={0.022} />
          {/* dish */}
          <circle cx={x} cy={y - 0.19} r={0.09} fill={c} />
          <circle cx={x} cy={y - 0.19} r={0.032} fill={ink} stroke="none" />
        </g>
      )}
    </g>
  );
}
