import { create } from 'zustand';
import type { GameState, Move } from './game/types';
import { createGame } from './game/state';
import { applyMove } from './game/reducer';
import { createTransport, defaultWsUrl } from './net/transport';
import type { Transport } from './net/transport';
import { sound } from './sound';

function playForMove(move: Move, gameover: boolean) {
  if (gameover) return sound.win();
  switch (move.type) {
    case 'BUILD':
      return sound.build();
    case 'BUILD_ROUTE':
      return sound.route();
    case 'RESEARCH':
      return sound.research();
    case 'CLAIM_MISSION':
      return sound.claim();
    case 'MOVE_DUST_STORM':
      return sound.storm();
    default:
      return;
  }
}

export type Screen = 'landing' | 'lobby' | 'game' | 'gameover';
export type Interaction = 'idle' | 'habitat' | 'dome' | 'route' | 'commTower' | 'storm';
export type Mode = 'local' | 'online';
export type Connection = 'idle' | 'connecting' | 'waiting' | 'connected' | 'error';

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `g-${Math.random().toString(36).slice(2)}`;
}

// The transport lives outside React state (it's not render data).
let transport: Transport | null = null;
function teardownTransport() {
  if (transport) {
    transport.close();
    transport = null;
  }
}

interface GameStore {
  game: GameState | null;
  screen: Screen;
  interaction: Interaction;
  error: string | null;
  mode: Mode;
  seat: 0 | 1 | null;
  myPlayerId: 'p1' | 'p2' | null;
  roomCode: string | null;
  connection: Connection;

  newLocalGame: (seed?: number) => void;
  hostOnline: () => void;
  joinOnline: (code: string) => void;
  goLanding: () => void;
  setInteraction: (i: Interaction) => void;
  dispatch: (move: Move) => void;
  roll: () => void;
}

export const useGame = create<GameStore>((set, get) => {
  // Wire a freshly created transport's event handlers to the store.
  const attach = (t: Transport) => {
    t.onState((state) => {
      set({
        game: state,
        connection: 'connected',
        screen: state.phase === 'gameover' ? 'gameover' : 'game',
        error: null,
      });
    });
    t.onLobby((e) => {
      if (e.t === 'created') {
        set({ seat: 0, myPlayerId: 'p1', roomCode: e.code, connection: 'waiting' });
      } else if (e.t === 'joined') {
        set({ seat: 1, myPlayerId: 'p2', roomCode: e.code, connection: 'waiting' });
      } else if (e.t === 'opponent' && e.joined) {
        // Host: opponent arrived → author the initial state and broadcast it.
        if (get().seat === 0) {
          const game = createGame({
            id: newId(),
            code: get().roomCode ?? randomCode(),
            seed: Math.floor(Math.random() * 1e9),
            p1: { id: 'p1', name: 'Player 1' },
            p2: { id: 'p2', name: 'Player 2' },
          });
          set({ game, screen: 'game', connection: 'connected', error: null });
          t.sendState(game);
        }
      } else if (e.t === 'opponent' && !e.joined) {
        set({ connection: 'error', error: 'Opponent disconnected.' });
      } else if (e.t === 'error') {
        set({ connection: 'error', error: e.message });
      }
    });
    t.onClose(() => set({ connection: 'error', error: 'Disconnected from server.' }));
  };

  return {
    game: null,
    screen: 'landing',
    interaction: 'idle',
    error: null,
    mode: 'local',
    seat: null,
    myPlayerId: null,
    roomCode: null,
    connection: 'idle',

    newLocalGame: (seed = Math.floor(Math.random() * 1e9)) => {
      teardownTransport();
      const game = createGame({
        id: newId(),
        code: randomCode(),
        seed,
        p1: { id: 'p1', name: 'Player 1' },
        p2: { id: 'p2', name: 'Player 2' },
      });
      set({
        game,
        screen: 'game',
        interaction: 'idle',
        error: null,
        mode: 'local',
        seat: null,
        myPlayerId: null,
        roomCode: null,
        connection: 'idle',
      });
    },

    hostOnline: () => {
      teardownTransport();
      transport = createTransport(defaultWsUrl());
      attach(transport);
      set({
        mode: 'online',
        screen: 'lobby',
        connection: 'connecting',
        game: null,
        error: null,
        seat: null,
        myPlayerId: null,
        roomCode: null,
      });
      transport.create();
    },

    joinOnline: (code) => {
      teardownTransport();
      transport = createTransport(defaultWsUrl());
      attach(transport);
      set({
        mode: 'online',
        screen: 'lobby',
        connection: 'connecting',
        game: null,
        error: null,
        seat: null,
        myPlayerId: null,
        roomCode: code.toUpperCase(),
      });
      transport.join(code.toUpperCase());
    },

    goLanding: () => {
      teardownTransport();
      set({
        screen: 'landing',
        game: null,
        mode: 'local',
        connection: 'idle',
        seat: null,
        myPlayerId: null,
        roomCode: null,
        error: null,
      });
    },

    setInteraction: (interaction) => set({ interaction, error: null }),

    dispatch: (move) => {
      const s = get();
      const game = s.game;
      if (!game) return;
      const author =
        s.mode === 'online'
          ? (s.myPlayerId ?? game.activePlayerId)
          : move.type === 'DISCARD'
            ? (Object.keys(game.pendingDiscards)[0] ?? game.activePlayerId)
            : game.activePlayerId;
      const { state, error } = applyMove(game, move, author);
      if (error) {
        sound.error();
        set({ error });
        return;
      }
      playForMove(move, state.phase === 'gameover');
      set({
        game: state,
        interaction: 'idle',
        error: null,
        screen: state.phase === 'gameover' ? 'gameover' : 'game',
      });
      if (s.mode === 'online' && transport) transport.sendState(state);
    },

    roll: () => {
      const d = (): number => 1 + Math.floor(Math.random() * 6);
      get().dispatch({ type: 'ROLL', roll: [d(), d()] });
    },
  };
});

// --- selectors ---------------------------------------------------------------

// Whose hand/panels the local viewer sees: their own seat online, else the
// active player (local hotseat shares one screen).
export function viewerId(s: Pick<GameStore, 'mode' | 'myPlayerId' | 'game'>): string {
  if (s.mode === 'online' && s.myPlayerId) return s.myPlayerId;
  return s.game?.activePlayerId ?? 'p1';
}

// Whether the local viewer may act right now.
export function canAct(s: Pick<GameStore, 'mode' | 'myPlayerId' | 'game'>): boolean {
  if (!s.game) return false;
  if (s.mode === 'local') return true;
  return s.game.activePlayerId === s.myPlayerId;
}
