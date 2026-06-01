import type { BuildingKind } from '../../game/types';

export default function Vertex(props: {
  pos: [number, number];
  kind: BuildingKind | null;
  owner: 'p1' | 'p2' | null;
  legal: boolean;
  onClick?: () => void;
}) {
  const { pos, kind, owner, legal, onClick } = props;
  const color = owner === 'p1' ? '#ff6b35' : owner === 'p2' ? '#00d9ff' : '#94a3b8';
  if (!kind && !legal) return null;
  return (
    <g
      role={legal ? 'button' : undefined}
      aria-label={legal ? 'Build here' : undefined}
      className={legal ? 'cursor-pointer' : ''}
      onClick={legal ? onClick : undefined}
    >
      {legal && (
        <circle cx={pos[0]} cy={pos[1]} r={0.28} fill="#facc15" opacity={0.5} className="animate-pulse" />
      )}
      {kind === 'HABITAT' && (
        <circle cx={pos[0]} cy={pos[1]} r={0.2} fill={color} stroke="#0a0e1a" strokeWidth={0.04} />
      )}
      {kind === 'DOME' && (
        <g>
          <circle cx={pos[0]} cy={pos[1]} r={0.26} fill={color} stroke="#0a0e1a" strokeWidth={0.05} />
          <circle cx={pos[0]} cy={pos[1]} r={0.12} fill="#0a0e1a" opacity={0.4} />
        </g>
      )}
      {kind === 'COMM_TOWER' && (
        <rect
          x={pos[0] - 0.16}
          y={pos[1] - 0.16}
          width={0.32}
          height={0.32}
          fill={color}
          stroke="#0a0e1a"
          strokeWidth={0.04}
          transform={`rotate(45 ${pos[0]} ${pos[1]})`}
        />
      )}
    </g>
  );
}
