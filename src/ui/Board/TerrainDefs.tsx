// SVG <pattern> defs giving each terrain a resource-evocative texture.
// patternUnits="userSpaceOnUse" so motifs tile seamlessly across hexes.
// Colors mirror the resource each terrain produces (spec §3.2 / §5.1):
//   PLAIN→O2 green, ICE→H2O blue, RIDGE→ORE orange, CRATER→ENG yellow,
//   LAB→RES purple, LAKE→deep water (no resource).
export default function TerrainDefs() {
  const T = 0.5; // pattern tile size in board units
  return (
    <defs>
      {/* depth: faint top-light to bottom-shadow over each hex */}
      <linearGradient id="hexShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.08} />
        <stop offset="55%" stopColor="#000000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.35} />
      </linearGradient>

      {/* PLAIN — oxygen bubbles */}
      <pattern id="tex-PLAIN" width={T} height={T} patternUnits="userSpaceOnUse">
        <rect width={T} height={T} fill="#16271f" />
        <circle cx={0.14} cy={0.16} r={0.055} fill="#4ade80" opacity={0.4} />
        <circle cx={0.37} cy={0.36} r={0.038} fill="#4ade80" opacity={0.28} />
        <circle cx={0.31} cy={0.09} r={0.022} fill="#4ade80" opacity={0.22} />
      </pattern>

      {/* ICE — crystalline diagonals */}
      <pattern id="tex-ICE" width={T} height={T} patternUnits="userSpaceOnUse">
        <rect width={T} height={T} fill="#122a3f" />
        <path d="M0 0.5 L0.5 0" stroke="#3b82f6" strokeWidth={0.035} opacity={0.35} />
        <path d="M0 0.22 L0.22 0" stroke="#60a5fa" strokeWidth={0.025} opacity={0.3} />
        <path d="M0.28 0.5 L0.5 0.28" stroke="#60a5fa" strokeWidth={0.025} opacity={0.3} />
      </pattern>

      {/* RIDGE — ore strata chevrons */}
      <pattern id="tex-RIDGE" width={T} height={T} patternUnits="userSpaceOnUse">
        <rect width={T} height={T} fill="#2c1f14" />
        <path d="M0 0.42 L0.25 0.26 L0.5 0.42" fill="none" stroke="#fb923c" strokeWidth={0.04} opacity={0.42} />
        <path d="M0 0.2 L0.25 0.04 L0.5 0.2" fill="none" stroke="#fb923c" strokeWidth={0.03} opacity={0.28} />
      </pattern>

      {/* CRATER — energy pulse rings */}
      <pattern id="tex-CRATER" width={T} height={T} patternUnits="userSpaceOnUse">
        <rect width={T} height={T} fill="#221c33" />
        <circle cx={0.25} cy={0.25} r={0.18} fill="none" stroke="#facc15" strokeWidth={0.028} opacity={0.32} />
        <circle cx={0.25} cy={0.25} r={0.09} fill="none" stroke="#facc15" strokeWidth={0.028} opacity={0.45} />
      </pattern>

      {/* LAB — research grid */}
      <pattern id="tex-LAB" width={T} height={T} patternUnits="userSpaceOnUse">
        <rect width={T} height={T} fill="#241a33" />
        <path d="M0.25 0 V0.5 M0 0.25 H0.5" stroke="#a78bfa" strokeWidth={0.028} opacity={0.32} />
        <circle cx={0.25} cy={0.25} r={0.05} fill="#a78bfa" opacity={0.3} />
      </pattern>

      {/* LAKE — still water, no resource */}
      <pattern id="tex-LAKE" width={T} height={T} patternUnits="userSpaceOnUse">
        <rect width={T} height={T} fill="#0c1830" />
        <path d="M0 0.3 q0.125 -0.08 0.25 0 t0.25 0" fill="none" stroke="#1e3a5f" strokeWidth={0.03} opacity={0.6} />
        <path d="M0 0.42 q0.125 -0.08 0.25 0 t0.25 0" fill="none" stroke="#1e3a5f" strokeWidth={0.03} opacity={0.4} />
      </pattern>
    </defs>
  );
}
