import { useEffect, useRef, useState } from 'react';
import { useGame, canAct } from '../../store';
import { sound } from '../../sound';

// Pip positions on a 100×100 die face.
const A = 28;
const B = 50;
const C = 72;
const PIPS: Record<number, [number, number][]> = {
  1: [[B, B]],
  2: [[A, A], [C, C]],
  3: [[A, A], [B, B], [C, C]],
  4: [[A, A], [C, A], [A, C], [C, C]],
  5: [[A, A], [C, A], [B, B], [A, C], [C, C]],
  6: [[A, A], [C, A], [A, B], [C, B], [A, C], [C, C]],
};

function DieFace({ value, rolling, delay }: { value: number; rolling: boolean; delay: number }) {
  const v = value >= 1 && value <= 6 ? value : 1;
  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-11 h-11 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${rolling ? 'dice-tumble' : 'dice-settle'}`}
      style={{ animationDelay: `${delay}s` }}
      aria-hidden
    >
      <defs>
        <linearGradient id="dieRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2483d" />
          <stop offset="100%" stopColor="#b11f17" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="88" height="88" rx="18" fill="url(#dieRed)" stroke="#7e1410" strokeWidth="3" />
      <rect x="12" y="10" width="76" height="36" rx="14" fill="#ffffff" opacity="0.12" />
      {value === 0
        ? null
        : PIPS[v].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill="#fff" />)}
    </svg>
  );
}

export default function Dice() {
  const game = useGame((s) => s.game)!;
  const roll = useGame((s) => s.roll);
  const act = useGame(canAct);
  const canRoll = game.phase === 'play' && game.turnPhase === 'AWAIT_ROLL' && act;

  const [rolling, setRolling] = useState(false);
  const [faces, setFaces] = useState<[number, number]>([1, 1]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const [d1, d2] = rolling ? faces : (game.lastRoll ?? [0, 0]);

  const doRoll = () => {
    if (!canRoll || rolling) return;
    sound.dice();
    setRolling(true);
    const start = Date.now();
    timer.current = setInterval(() => {
      setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
      if (Date.now() - start > 650) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setRolling(false);
        roll();
      }
    }, 80);
  };

  const showResult = !!game.lastRoll && !canRoll && !rolling;
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        <DieFace value={d1} rolling={rolling} delay={0} />
        <DieFace value={d2} rolling={rolling} delay={0.05} />
      </div>
      <button
        disabled={!canRoll || rolling}
        onClick={doRoll}
        className="font-display px-5 py-2 rounded-full bg-cyan/90 text-space font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 transition"
      >
        {rolling ? 'Rolling…' : `Roll${showResult ? ` · ${game.lastRoll![0] + game.lastRoll![1]}` : ''}`}
      </button>
    </div>
  );
}
