import type { Resource } from '../game/types';
import { RESOURCE_META } from './format';

// A single consistent icon set for the five resources, drawn as crisp SVG so it
// reads the same on the board (nested <svg>) and in the HUD (inline <svg>):
//   Oxygen  → gas bubbles   Water → droplet   Ore → crystal
//   Energy  → bolt          Research → lab flask
// Shapes inherit `fill` from the <svg>, so one `color` controls the whole icon.
const ICONS: Record<Resource, JSX.Element> = {
  O2: (
    <>
      <circle cx="10" cy="13.5" r="6" />
      <circle cx="17.5" cy="9" r="4" />
      <circle cx="18.5" cy="17.5" r="2.6" />
    </>
  ),
  H2O: <path d="M12 2C12 2 19 10.5 19 15.5A7 7 0 0 1 5 15.5C5 10.5 12 2 12 2Z" />,
  ORE: (
    <>
      <path d="M12 2L21.5 11.5L12 22L2.5 11.5Z" />
      <path d="M12 2L21.5 11.5H2.5Z" opacity="0.35" />
    </>
  ),
  ENG: <path d="M13 2L4 14H10L8 22L20 8H12.5Z" />,
  RES: (
    <>
      <path d="M9 2H15V4H9Z" />
      <path d="M10 4H14V10L19 18.5A2.2 2.2 0 0 1 17 22H7A2.2 2.2 0 0 1 5 18.5L10 10Z" />
    </>
  ),
};

export function ResourceGlyph(props: {
  resource: Resource;
  size?: number; // px in the HUD, or board user-units when x/y are given
  color?: string;
  x?: number;
  y?: number;
  className?: string;
}) {
  const { resource, size = 16, color, x, y, className } = props;
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? RESOURCE_META[resource].color}
      role="img"
      aria-label={RESOURCE_META[resource].label}
      className={className}
    >
      <title>{RESOURCE_META[resource].label}</title>
      {ICONS[resource]}
    </svg>
  );
}

export default ResourceGlyph;
