import { useGame } from '../../store';

export default function Dice() {
  const game = useGame((s) => s.game)!;
  const roll = useGame((s) => s.roll);
  const canRoll = game.phase === 'play' && game.turnPhase === 'AWAIT_ROLL';
  const [d1, d2] = game.lastRoll ?? [0, 0];
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        {[d1, d2].map((d, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-display text-xl font-bold"
          >
            {d || '–'}
          </div>
        ))}
      </div>
      <button
        disabled={!canRoll}
        onClick={roll}
        className="font-display px-5 py-2 rounded-full bg-cyan/90 text-space font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 transition"
      >
        Roll {game.lastRoll ? `(${d1 + d2})` : ''}
      </button>
    </div>
  );
}
