import type { PlayerState } from './types';

export type TechTrack = 'ENG' | 'BIO' | 'ASTRO';

export interface TechDef {
  id: string;
  track: TechTrack;
  tier: 1 | 2 | 3 | 4;
  cost: number;
  vp: number;
  name: string;
}

const TIER_COST: Record<number, number> = { 1: 2, 2: 3, 3: 3, 4: 4 };

function track(prefix: TechTrack, names: [string, string, string, string]): TechDef[] {
  return names.map((name, i) => {
    const tier = (i + 1) as 1 | 2 | 3 | 4;
    return { id: `${prefix}${tier}`, track: prefix, tier, cost: TIER_COST[tier], vp: 1, name };
  });
}

export const TECHS: TechDef[] = [
  ...track('ENG', ['Ridge Mining', 'Efficient Domes', 'Rapid Rovers', 'Fortified Dome']),
  ...track('BIO', ['Oxygen Farms', 'Storm Shelter', 'Resilient Habitats', 'Greenhouse']),
  ...track('ASTRO', ['Recalibrate', 'Stargazer', 'Open Market', 'Solar Array']),
];

export function techById(id: string): TechDef | undefined {
  return TECHS.find((t) => t.id === id);
}

export function hasTech(player: PlayerState, id: string): boolean {
  return player.techs.includes(id);
}

// The next tech a player may buy in a track (tier order), or null if maxed.
export function nextResearchable(player: PlayerState, trackId: TechTrack): TechDef | null {
  const owned = player.techs.filter((id) => techById(id)?.track === trackId).length;
  if (owned >= 4) return null;
  return TECHS.find((t) => t.track === trackId && t.tier === owned + 1) ?? null;
}
