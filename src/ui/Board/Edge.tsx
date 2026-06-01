export default function Edge(props: {
  a: [number, number];
  b: [number, number];
  color: string | null; // owning player's color, or null if unbuilt
  legal: boolean;
  onClick?: () => void;
}) {
  const { a, b, color, legal, onClick } = props;
  const common = {
    x1: a[0],
    y1: a[1],
    x2: b[0],
    y2: b[1],
    strokeLinecap: 'round' as const,
  };

  if (color) {
    // A built rover route: dark casing + colored roadbed + dashed track centerline.
    return (
      <g>
        <line {...common} stroke="#0a0e1a" strokeWidth={0.17} />
        <line {...common} stroke={color} strokeWidth={0.12} />
        <line
          {...common}
          stroke="#ffffff"
          strokeWidth={0.028}
          strokeDasharray="0.05 0.05"
          opacity={0.7}
        />
      </g>
    );
  }

  if (legal) {
    return (
      <line
        {...common}
        stroke="#facc15"
        strokeWidth={0.09}
        strokeDasharray="0.07 0.05"
        className="cursor-pointer animate-pulse"
        role="button"
        aria-label="Build route here"
        onClick={onClick}
      />
    );
  }

  // Unbuilt edge: a faint hint of the road network.
  return <line {...common} stroke="#ffffff22" strokeWidth={0.04} />;
}
