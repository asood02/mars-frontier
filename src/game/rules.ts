import type { BoardGraph } from './board';
import type { Building, Route, Resource } from './types';

export function buildingAt(buildings: Building[], vertexId: string): Building | undefined {
  return buildings.find((b) => b.vertexId === vertexId);
}

export function routeAt(routes: Route[], edgeId: string): Route | undefined {
  return routes.find((r) => r.edgeId === edgeId);
}

// Set of vertices that are an endpoint of any of the player's routes.
export function playerRouteEndpoints(
  g: BoardGraph,
  routes: Route[],
  playerId: string,
): Set<string> {
  const set = new Set<string>();
  for (const r of routes) {
    if (r.ownerId !== playerId) continue;
    const [a, b] = g.edgeVertices[r.edgeId];
    set.add(a);
    set.add(b);
  }
  return set;
}

// True if any building (any owner) sits on the vertex or a graph-adjacent vertex.
export function violatesDistanceRule(
  g: BoardGraph,
  buildings: Building[],
  vertexId: string,
): boolean {
  if (buildingAt(buildings, vertexId)) return true;
  for (const n of g.vertexNeighbors[vertexId]) {
    if (buildingAt(buildings, n)) return true;
  }
  return false;
}

export function canAfford(
  resources: Record<Resource, number>,
  cost: Partial<Record<Resource, number>>,
): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(
    ([res, amt]) => resources[res] >= amt,
  );
}

// Returns a NEW record with the cost subtracted. Does not mutate the input.
export function payCost(
  resources: Record<Resource, number>,
  cost: Partial<Record<Resource, number>>,
): Record<Resource, number> {
  const out = { ...resources };
  for (const [res, amt] of Object.entries(cost) as [Resource, number][]) {
    out[res] -= amt;
  }
  return out;
}
