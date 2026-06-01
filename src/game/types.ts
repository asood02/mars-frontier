// Shared types for the Mars Frontier game core (spec §4.1–§4.2).

export type Resource = 'O2' | 'H2O' | 'ORE' | 'ENG' | 'RES';
export type Terrain = 'PLAIN' | 'RIDGE' | 'CRATER' | 'ICE' | 'LAB' | 'LAKE';
export type BuildingKind = 'HABITAT' | 'DOME' | 'COMM_TOWER';
export type Phase = 'lobby' | 'setup1' | 'setup2' | 'play' | 'gameover';

export interface Hex {
  id: string;
  q: number;
  r: number;
  terrain: Terrain;
  number: number | null; // null only for LAKE (no production)
}

export interface Building {
  vertexId: string;
  ownerId: string;
  kind: BuildingKind;
}

export interface Route {
  edgeId: string;
  ownerId: string;
}

export interface GameEvent {
  turn: number;
  playerId: string;
  text: string;
}

export interface PlayerState {
  id: string;
  name: string;
  resources: Record<Resource, number>;
  techs: string[]; // tech card ids
  missions: string[]; // claimed mission ids
  longestRoute: number;
  hasCommTower: boolean;
}

export interface BoardData {
  hexes: Hex[];
  vertices: string[];
  edges: string[];
}

export interface GameState {
  id: string;
  code: string; // 6-char room code (used by multiplayer in Plan 4)
  phase: Phase;
  turn: number;
  activePlayerId: string;
  players: [PlayerState, PlayerState];
  board: BoardData;
  buildings: Building[];
  routes: Route[];
  dustStormHexId: string | null;
  lastRoll: [number, number] | null;
  missionDeck: string[]; // remaining face-down mission ids
  missionsOnBoard: string[]; // 3 visible mission ids
  log: GameEvent[];
  winnerId: string | null;
}

// Every move the reducer (Plan 2) will accept (spec §4.2).
export type Move =
  | { type: 'ROLL'; roll: [number, number] }
  | { type: 'MOVE_DUST_STORM'; hexId: string }
  | { type: 'DISCARD'; cards: Partial<Record<Resource, number>> }
  | {
      type: 'TRADE_PLAYER';
      offer: Partial<Record<Resource, number>>;
      want: Partial<Record<Resource, number>>;
      accepted: boolean;
    }
  | { type: 'TRADE_MARKET'; give: Resource; receive: Resource }
  | { type: 'BUILD'; building: BuildingKind; locationId: string }
  | { type: 'BUILD_ROUTE'; edgeId: string }
  | { type: 'RESEARCH'; techId: string }
  | { type: 'CLAIM_MISSION'; missionId: string }
  | { type: 'END_TURN' };

export const RESOURCES: readonly Resource[] = ['O2', 'H2O', 'ORE', 'ENG', 'RES'];

// Which resource each producing terrain yields (spec §3.2). LAKE produces nothing.
export const TERRAIN_RESOURCE: Partial<Record<Terrain, Resource>> = {
  PLAIN: 'O2',
  ICE: 'H2O',
  RIDGE: 'ORE',
  CRATER: 'ENG',
  LAB: 'RES',
};

export function emptyResources(): Record<Resource, number> {
  return { O2: 0, H2O: 0, ORE: 0, ENG: 0, RES: 0 };
}

export function totalResources(r: Record<Resource, number>): number {
  return RESOURCES.reduce((sum, k) => sum + r[k], 0);
}
