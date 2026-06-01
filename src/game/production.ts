import type { BoardGraph } from './board';
import type { GameState, Resource } from './types';
import { TERRAIN_RESOURCE, emptyResources } from './types';
import { buildingAt } from './rules';

// Returns resource deltas keyed by player id for a given (non-7) roll sum.
export function produce(
  g: BoardGraph,
  state: GameState,
  rollSum: number,
): Record<string, Record<Resource, number>> {
  const delta: Record<string, Record<Resource, number>> = {
    [state.players[0].id]: emptyResources(),
    [state.players[1].id]: emptyResources(),
  };

  for (const hex of state.board.hexes) {
    if (hex.number !== rollSum) continue;
    if (hex.id === state.dustStormHexId) continue;
    if (hex.terrain === 'LAKE') continue;

    // Lab: 1 RES to the active player, no adjacency (spec §3.1).
    if (hex.terrain === 'LAB') {
      delta[state.activePlayerId].RES += 1;
      continue;
    }

    const res = TERRAIN_RESOURCE[hex.terrain] as Resource | undefined;
    if (!res) continue;
    for (const v of g.hexVertices[hex.id]) {
      const b = buildingAt(state.buildings, v);
      if (!b) continue;
      delta[b.ownerId][res] += b.kind === 'DOME' ? 2 : 1;
    }
  }
  return delta;
}
