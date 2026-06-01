import type { BoardGraph } from './board';
import type { GameState, Resource, PlayerState } from './types';
import { TERRAIN_RESOURCE, emptyResources, LAKE_THAW_TI } from './types';
import { buildingAt } from './rules';

function playerOf(state: GameState, id: string): PlayerState {
  return state.players[0].id === id ? state.players[0] : state.players[1];
}

// Yield for one building from one matching hex, applying tech bonuses.
function yieldFor(owner: PlayerState, kind: 'HABITAT' | 'DOME', terrain: string): number {
  const dome = kind === 'DOME';
  let base = dome ? 2 : 1;
  if (terrain === 'RIDGE' && owner.techs.includes('ENG1')) base += 1; // +1 ORE
  if (terrain === 'PLAIN' && owner.techs.includes('BIO1')) base += 1; // +1 O2
  if (terrain === 'CRATER' && dome && owner.techs.includes('ASTRO4')) base = 3; // Solar Array
  return base;
}

// Returns resource deltas keyed by player id for a given (non-7) roll sum.
export function produce(
  g: BoardGraph,
  state: GameState,
  rollSum: number,
): Record<string, Record<Resource, number>> {
  const delta: Record<string, Record<Resource, number>> = {};
  for (const p of state.players) delta[p.id] = emptyResources();

  for (const hex of state.board.hexes) {
    if (hex.number !== rollSum) continue;
    if (hex.id === state.dustStormHexId) continue;
    // Crater Lakes are barren until terraforming thaws them into water sources.
    if (hex.terrain === 'LAKE' && state.terraformIndex < LAKE_THAW_TI) continue;

    if (hex.terrain === 'LAB') {
      delta[state.activePlayerId].RES += 1; // global to active player (spec §3.1)
      continue;
    }

    const res = (hex.terrain === 'LAKE' ? 'H2O' : TERRAIN_RESOURCE[hex.terrain]) as
      | Resource
      | undefined;
    if (!res) continue;
    for (const v of g.hexVertices[hex.id]) {
      const b = buildingAt(state.buildings, v);
      if (!b || b.kind === 'COMM_TOWER') continue;
      const owner = playerOf(state, b.ownerId);
      delta[b.ownerId][res] += yieldFor(owner, b.kind, hex.terrain);
      // Greenhouse: a Habitat adjacent to a producing Ice hex also yields +1 O2.
      if (hex.terrain === 'ICE' && b.kind === 'HABITAT' && owner.techs.includes('BIO4')) {
        delta[b.ownerId].O2 += 1;
      }
    }
  }
  return delta;
}

// Production triggered by a 7 for a BIO3 owner: ALL their buildings produce from
// every adjacent producing hex (dust storm / lake still block). Spec §3.7.
export function produceOnSeven(
  g: BoardGraph,
  state: GameState,
  playerId: string,
): Record<Resource, number> {
  const out = emptyResources();
  const owner = playerOf(state, playerId);
  if (!owner.techs.includes('BIO3')) return out;
  for (const b of state.buildings) {
    if (b.ownerId !== playerId || b.kind === 'COMM_TOWER') continue;
    for (const hid of g.vertexHexes[b.vertexId]) {
      const hex = state.board.hexes.find((h) => h.id === hid);
      if (!hex || hex.id === state.dustStormHexId) continue;
      if (hex.terrain === 'LAKE' && state.terraformIndex < LAKE_THAW_TI) continue;
      if (hex.terrain === 'LAB') continue; // labs are global-only
      const res = (hex.terrain === 'LAKE' ? 'H2O' : TERRAIN_RESOURCE[hex.terrain]) as
        | Resource
        | undefined;
      if (!res) continue;
      out[res] += yieldFor(owner, b.kind, hex.terrain);
      if (hex.terrain === 'ICE' && b.kind === 'HABITAT' && owner.techs.includes('BIO4')) {
        out.O2 += 1;
      }
    }
  }
  return out;
}
