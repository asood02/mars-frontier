import { useEffect, useRef, useState } from 'react';
import { useGame, canAct } from '../../store';

export default function Dice() {
  const game = useGame((s) => s.game)!;
  const roll = useGame((s) => s.roll);
  const act = useGame(canAct);
  const canRoll = game.phase === 'play' && game.turnPhase === 'AWAIT_ROLL' && act;

  const [rolling, setRolling] = useState(false);
  const [faces, setFaces] = useState<[number, number]>([1, 1]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const [d1, d2] = rolling ? faces : (game.lastRoll ?? [0, 0]);

  const doRoll = () => {
    if (!canRoll || rolling) return;
    setRolling(true);
    const start = Date.now();
    timer.current = setInterval(() => {
      setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
      if (Date.now() - start > 650) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setRolling(false);
        roll(); // commit the real roll → game.lastRoll updates
      }
    }, 70);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        {[d1, d2].map((d, i) => (
          <div
            key={i}
            className={`w-11 h-11 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-display text-2xl font-bold ${
              rolling ? 'dice-tumble' : 'dice-settle'
            }`}
            style={{ animationDelay: rolling ? `${i * 0.04}s` : '0s' }}
          >
            {d || '–'}
          </div>
        ))}
      </div>
      <button
        disabled={!canRoll || rolling}
        onClick={doRoll}
        className="font-display px-5 py-2 rounded-full bg-cyan/90 text-space font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 transition"
      >
        {rolling ? 'Rolling…' : `Roll${game.lastRoll && !canRoll ? ` (${(game.lastRoll[0] + game.lastRoll[1])})` : ''}`}
      </button>
    </div>
  );
}
