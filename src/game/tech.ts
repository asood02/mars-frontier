import type { PlayerState } from './types';

export type TechTrack = 'ENG' | 'BIO' | 'ASTRO';

export interface TechDef {
  id: string;
  track: TechTrack;
  tier: 1 | 2 | 3 | 4;
  cost: number;
  vp: number;
  name: string;
  desc: string;
}

const TIER_COST: Record<number, number> = { 1: 2, 2: 3, 3: 3, 4: 4 };

function track(prefix: TechTrack, cards: [string, string][]): TechDef[] {
  return cards.map(([name, desc], i) => {
    const tier = (i + 1) as 1 | 2 | 3 | 4;
    return { id: `${prefix}${tier}`, track: prefix, tier, cost: TIER_COST[tier], vp: 1, name, desc };
  });
}

export const TECHS: TechDef[] = [
  ...track('ENG', [
    ['Ridge Mining', '+1 Ore from each Ridge'],
    ['Efficient Domes', 'Domes cost 1 Ore + 3 Energy'],
    ['Rapid Rovers', 'First 2 routes each turn are free'],
    ['Fortified Dome', 'Your Domes are worth 3 VP'],
  ]),
  ...track('BIO', [
    ['Oxygen Farms', '+1 Oxygen from each Plain'],
    ['Storm Shelter', 'Ignore the 7-roll discard'],
    ['Resilient Habitats', 'Your buildings also produce on a 7'],
    ['Greenhouse', 'Habitats beside Ice also give +1 Oxygen'],
  ]),
  ...track('ASTRO', [
    ['Recalibrate', 'Re-roll once per turn (coming soon)'],
    ['Stargazer', 'Peek the top mission (coming soon)'],
    ['Open Market', 'Trade 2:1 with the supply drop'],
    ['Solar Array', 'Domes give 3 Energy from Craters'],
  ]),
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
