import { useState } from 'react';
import { useGame } from '../../store';
import { RESOURCES } from '../../game/types';
import type { Resource } from '../../game/types';
import { RESOURCE_META } from '../format';

export default function DiscardModal() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const owingId = Object.keys(game.pendingDiscards)[0];
  const [draft, setDraft] = useState<Record<Resource, number>>({
    O2: 0,
    H2O: 0,
    ORE: 0,
    ENG: 0,
    RES: 0,
  });
  if (game.turnPhase !== 'DISCARD' || !owingId) return null;
  const owed = game.pendingDiscards[owingId];
  const player = game.players.find((p) => p.id === owingId)!;
  const chosen = RESOURCES.reduce((s, r) => s + draft[r], 0);

  const bump = (r: Resource, d: number) =>
    setDraft((prev) => ({
      ...prev,
      [r]: Math.max(0, Math.min(player.resources[r], prev[r] + d)),
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="rounded-2xl bg-space border border-mars/40 p-6 w-[28rem]">
        <h2 className="font-display text-2xl text-mars">Dust Storm!</h2>
        <p className="text-white/60 text-sm mt-1">
          {player.name} must discard {owed} ({chosen}/{owed} selected)
        </p>
        <div className="grid grid-cols-5 gap-2 my-4">
          {RESOURCES.map((r) => (
            <div key={r} className="rounded-xl bg-black/30 p-2 text-center">
              <div style={{ color: RESOURCE_META[r].color }}>{RESOURCE_META[r].glyph}</div>
              <div className="text-xs text-white/40">have {player.resources[r]}</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <button onClick={() => bump(r, -1)} className="w-5 h-5 rounded bg-white/10">
                  –
                </button>
                <span className="font-display w-5">{draft[r]}</span>
                <button onClick={() => bump(r, 1)} className="w-5 h-5 rounded bg-white/10">
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          disabled={chosen !== owed}
          onClick={() => dispatch({ type: 'DISCARD', cards: draft })}
          className="w-full font-display py-2 rounded-full bg-mars text-space font-bold disabled:opacity-30"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
