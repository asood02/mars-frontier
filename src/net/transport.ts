import type { GameState } from '../game/types';

// Lobby/handshake messages from the relay server.
export type LobbyEvent =
  | { t: 'created'; code: string; seat: number; capacity: number; filled: number }
  | { t: 'joined'; code: string; seat: number; capacity: number; filled: number }
  | { t: 'opponent'; joined: boolean; capacity?: number; filled?: number }
  | { t: 'error'; message: string };

// Minimal surface a browser WebSocket satisfies; lets us inject a fake in tests.
export interface SocketLike {
  send(data: string): void;
  close(): void;
  readyState: number;
  addEventListener(type: 'open' | 'message' | 'close' | 'error', cb: (ev: any) => void): void;
}
export type SocketFactory = (url: string) => SocketLike;

export interface Transport {
  create(capacity?: number): void;
  join(code: string): void;
  sendState(state: GameState): void;
  onLobby(cb: (e: LobbyEvent) => void): void;
  onState(cb: (state: GameState) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

const OPEN = 1;

const defaultFactory: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike;

export function defaultWsUrl(): string {
  const env = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  return env ?? 'ws://localhost:8787';
}

export function createTransport(url: string, factory: SocketFactory = defaultFactory): Transport {
  const socket = factory(url);
  const queue: string[] = [];
  let open = false;
  const lobbyCbs: ((e: LobbyEvent) => void)[] = [];
  const stateCbs: ((s: GameState) => void)[] = [];
  const closeCbs: (() => void)[] = [];

  const flush = () => {
    while (queue.length) socket.send(queue.shift()!);
  };
  const raw = (obj: unknown) => {
    const json = JSON.stringify(obj);
    if (open || socket.readyState === OPEN) socket.send(json);
    else queue.push(json);
  };

  socket.addEventListener('open', () => {
    open = true;
    flush();
  });
  socket.addEventListener('message', (ev: { data: unknown }) => {
    let msg: any;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg?.t === 'state') stateCbs.forEach((cb) => cb(msg.state as GameState));
    else lobbyCbs.forEach((cb) => cb(msg as LobbyEvent));
  });
  socket.addEventListener('close', () => closeCbs.forEach((cb) => cb()));

  return {
    create: (capacity = 2) => raw({ t: 'create', capacity }),
    join: (code) => raw({ t: 'join', code }),
    sendState: (state) => raw({ t: 'state', state }),
    onLobby: (cb) => void lobbyCbs.push(cb),
    onState: (cb) => void stateCbs.push(cb),
    onClose: (cb) => void closeCbs.push(cb),
    close: () => socket.close(),
  };
}
