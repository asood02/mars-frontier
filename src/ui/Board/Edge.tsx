export default function Edge(props: {
  a: [number, number];
  b: [number, number];
  owner: 'p1' | 'p2' | null;
  legal: boolean;
  onClick?: () => void;
}) {
  const { a, b, owner, legal, onClick } = props;
  const color = owner === 'p1' ? '#ff6b35' : owner === 'p2' ? '#00d9ff' : '#ffffff22';
  return (
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={legal ? '#facc15' : color}
      strokeWidth={owner || legal ? 0.16 : 0.06}
      strokeLinecap="round"
      className={legal ? 'cursor-pointer animate-pulse' : ''}
      role={legal ? 'button' : undefined}
      aria-label={legal ? 'Build route here' : undefined}
      onClick={legal ? onClick : undefined}
    />
  );
}
