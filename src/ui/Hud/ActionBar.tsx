import { useGame, canAct } from '../../store';
import type { Interaction } from '../../store';
import Dice from './Dice';

const BUILD_BUTTONS: { mode: Interaction; label: string }[] = [
  { mode: 'habitat', label: 'Habitat' },
  { mode: 'dome', label: 'Dome' },
  { mode: 'route', label: 'Route' },
  { mode: 'commTower', label: 'Comm Tower' },
];

export default function ActionBar() {
  const game = useGame((s) => s.game)!;
  const interaction = useGame((s) => s.interaction);
  const setInteraction = useGame((s) => s.setInteraction);
  const dispatch = useGame((s) => s.dispatch);
  const error = useGame((s) => s.error);
  const act = useGame(canAct);

  const inActions = game.phase === 'play' && game.turnPhase === 'ACTIONS' && act;
  const inStorm = game.phase === 'play' && game.turnPhase === 'MOVE_STORM' && act;

  return (
    <div className="bg-white/5 backdrop-blur border-t border-white/10 px-6 py-3 flex flex-wrap items-center gap-3">
      <Dice />
      <div className="h-6 w-px bg-white/10" />
      {BUILD_BUTTONS.map((b) => (
        <button
          key={b.mode}
          disabled={!inActions}
          onClick={() => setInteraction(interaction === b.mode ? 'idle' : b.mode)}
          className={`font-display text-sm px-4 py-2 rounded-full border transition disabled:opacity-30
            ${interaction === b.mode ? 'bg-mars text-space border-mars' : 'border-white/20 text-white/80 hover:bg-white/10'}`}
        >
          {b.label}
        </button>
      ))}
      {inStorm && (
        <button
          onClick={() => setInteraction(interaction === 'storm' ? 'idle' : 'storm')}
          className={`font-display text-sm px-4 py-2 rounded-full border transition
            ${interaction === 'storm' ? 'bg-mars text-space border-mars' : 'border-mars/60 text-mars'}`}
        >
          Move Dust Storm
        </button>
      )}
      <div className="flex-1" />
      {error && <span className="text-sm text-red-400 font-sans">{error}</span>}
      <button
        disabled={!inActions}
        onClick={() => dispatch({ type: 'END_TURN' })}
        className="font-display text-sm px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition"
      >
        End Turn
      </button>
    </div>
  );
}
