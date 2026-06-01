import { useGame } from '../store';
import { playerVP } from '../game/scoring';

export default function GameOver() {
  const game = useGame((s) => s.game)!;
  const newLocalGame = useGame((s) => s.newLocalGame);
  const goLanding = useGame((s) => s.goLanding);
  const winner = game.players.find((p) => p.id === game.winnerId)!;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="font-sans tracking-[0.4em] text-cyan/70 text-sm">MISSION COMPLETE</p>
      <h1 className="font-display text-6xl font-bold text-mars">{winner.name} wins</h1>
      <div className="flex gap-8 font-sans text-white/70">
        {game.players.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white/5 border border-white/10 px-8 py-5">
            <div className="font-display text-lg text-white">{p.name}</div>
            <div className="text-4xl font-bold text-mars mt-1">{playerVP(game, p.id)}</div>
            <div className="text-xs uppercase tracking-widest mt-1">victory points</div>
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => newLocalGame()}
          className="font-display px-8 py-3 rounded-full bg-mars text-space font-bold hover:scale-105 transition"
        >
          Rematch
        </button>
        <button
          onClick={goLanding}
          className="font-display px-8 py-3 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition"
        >
          Home
        </button>
      </div>
    </main>
  );
}
