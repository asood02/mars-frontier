import { create } from 'zustand';
import type { GameState, Move } from './game/types';
import { MIN_PLAYERS, MAX_PLAYERS } from './game/types';
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

function tutorialSeen(): boolean {
  try {
    return localStorage.getItem('mf-tutorial-seen') === '1';
  } catch {
    return false;
  }
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
  seat: number | null;
  myPlayerId: string | null;
  roomCode: string | null;
  capacity: number; // table size for the online room
  filled: number; // players currently seated
  connection: Connection;
  tutorialOpen: boolean;
  guideOpen: boolean;

  newLocalGame: (seed?: number, playerCount?: number) => void;
  hostOnline: (playerCount?: number) => void;
  joinOnline: (code: string) => void;
  goLanding: () => void;
  setInteraction: (i: Interaction) => void;
  dispatch: (move: Move) => void;
  roll: () => void;
  openTutorial: () => void;
  closeTutorial: () => void;
  openGuide: () => void;
  closeGuide: () => void;
}

export const useGame = create<GameStore>((set, get) => {
  // Wire a freshly created transport's event handlers to the store.
  const attach = (t: Transport) => {
    t.onState((state) => {
      const firstTime = !get().game;
      set({
        game: state,
        connection: 'connected',
        screen: state.phase === 'gameover' ? 'gameover' : 'game',
        error: null,
      });
      if (firstTime && !tutorialSeen()) set({ tutorialOpen: true });
    });
    t.onLobby((e) => {
      if (e.t === 'created') {
        set({
          seat: 0,
          myPlayerId: 'p1',
          roomCode: e.code,
          capacity: e.capacity,
          filled: e.filled,
          connection: 'waiting',
        });
      } else if (e.t === 'joined') {
        set({
          seat: e.seat,
          myPlayerId: `p${e.seat + 1}`,
          roomCode: e.code,
          capacity: e.capacity,
          filled: e.filled,
          connection: 'waiting',
        });
      } else if (e.t === 'opponent' && e.joined) {
        const capacity = e.capacity ?? get().capacity;
        const filled = e.filled ?? get().filled + 1;
        set({ capacity, filled });
        // Host authors the initial state once every seat is filled, then broadcasts.
        if (get().seat === 0 && filled >= capacity) {
          const players = Array.from({ length: capacity }, (_, i) => ({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
          }));
          const game = createGame({
            id: newId(),
            code: get().roomCode ?? randomCode(),
            seed: Math.floor(Math.random() * 1e9),
            players,
          });
          set({
            game,
            screen: 'game',
            connection: 'connected',
            error: null,
            tutorialOpen: !tutorialSeen(),
          });
          t.sendState(game);
        }
      } else if (e.t === 'opponent' && !e.joined) {
        set({ connection: 'error', error: 'A player disconnected.' });
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
    capacity: 2,
    filled: 0,
    connection: 'idle',
    tutorialOpen: false,
    guideOpen: false,

    newLocalGame: (seed = Math.floor(Math.random() * 1e9), playerCount = 2) => {
      teardownTransport();
      const count = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, playerCount));
      const players = Array.from({ length: count }, (_, i) => ({
        id: `p${i + 1}`,
        name: `Player ${i + 1}`,
      }));
      const game = createGame({ id: newId(), code: randomCode(), seed, players });
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
        tutorialOpen: !tutorialSeen(),
      });
    },

    hostOnline: (playerCount = 2) => {
      teardownTransport();
      const capacity = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, playerCount));
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
        capacity,
        filled: 0,
      });
      transport.create(capacity);
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

    openTutorial: () => set({ tutorialOpen: true }),
    closeTutorial: () => {
      try {
        localStorage.setItem('mf-tutorial-seen', '1');
      } catch {
        /* ignore */
      }
      set({ tutorialOpen: false });
    },

    openGuide: () => set({ guideOpen: true }),
    closeGuide: () => set({ guideOpen: false }),
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
