import { create } from 'zustand';
import type { GameState, Move } from './game/types';
import { createGame } from './game/state';
import { applyMove } from './game/reducer';

export type Screen = 'landing' | 'game' | 'gameover';
export type Interaction = 'idle' | 'habitat' | 'dome' | 'route' | 'commTower' | 'storm';

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

interface GameStore {
  game: GameState | null;
  screen: Screen;
  interaction: Interaction;
  error: string | null;

  newLocalGame: (seed?: number) => void;
  goLanding: () => void;
  setInteraction: (i: Interaction) => void;
  dispatch: (move: Move) => void;
  roll: () => void;
}

// Which player should author a given move. DISCARD can come from a non-active
// player who still owes cards; everything else is the active player.
function authorFor(game: GameState, move: Move): string {
  if (move.type === 'DISCARD') {
    const owing = Object.keys(game.pendingDiscards);
    return owing[0] ?? game.activePlayerId;
  }
  return game.activePlayerId;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `g-${Math.random().toString(36).slice(2)}`;
}

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  screen: 'landing',
  interaction: 'idle',
  error: null,

  newLocalGame: (seed = Math.floor(Math.random() * 1e9)) => {
    const game = createGame({
      id: newId(),
      code: randomCode(),
      seed,
      p1: { id: 'p1', name: 'Player 1' },
      p2: { id: 'p2', name: 'Player 2' },
    });
    set({ game, screen: 'game', interaction: 'idle', error: null });
  },

  goLanding: () => set({ screen: 'landing', game: null }),

  setInteraction: (interaction) => set({ interaction, error: null }),

  dispatch: (move) => {
    const { game } = get();
    if (!game) return;
    const { state, error } = applyMove(game, move, authorFor(game, move));
    if (error) {
      set({ error });
      return;
    }
    set({
      game: state,
      interaction: 'idle',
      error: null,
      screen: state.phase === 'gameover' ? 'gameover' : 'game',
    });
  },

  roll: () => {
    const d = (): number => 1 + Math.floor(Math.random() * 6);
    get().dispatch({ type: 'ROLL', roll: [d(), d()] });
  },
}));
