// Type declarations for the plain-JS relay room logic so TS callers (tests,
// any future client import) get a typed surface without a build step.
export type Directive = { to: unknown; msg: Record<string, unknown> };
export interface Rooms {
  byCode: Map<string, unknown>;
  byClient: Map<unknown, unknown>;
}
export function makeRooms(): Rooms;
export function createRoom(rooms: Rooms, client: unknown, rand?: () => number): Directive[];
export function joinRoom(rooms: Rooms, client: unknown, code: string): Directive[];
export function relayState(rooms: Rooms, client: unknown, state: unknown): Directive[];
export function leave(rooms: Rooms, client: unknown): Directive[];
export function handleMessage(
  rooms: Rooms,
  client: unknown,
  msg: { t?: string; [k: string]: unknown },
  rand?: () => number,
): Directive[];
