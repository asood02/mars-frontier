import { useGame } from '../store';

export default function Landing() {
  const newLocalGame = useGame((s) => s.newLocalGame);
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <p className="font-sans tracking-[0.4em] text-cyan/70 text-sm mb-4">
          2-PLAYER COLONY BUILDER
        </p>
        <h1 className="font-display text-7xl sm:text-8xl font-bold text-mars drop-shadow-[0_0_30px_rgba(255,107,53,0.35)]">
          MARS FRONTIER
        </h1>
        <p className="mt-6 max-w-md mx-auto text-white/50">
          Claim terrain, build domes, research tech, and survive the dust storms. First to 10
          victory points wins.
        </p>
      </div>
      <button
        onClick={() => newLocalGame()}
        className="font-display text-lg px-10 py-4 rounded-full bg-mars text-space font-bold tracking-wide
                   hover:scale-105 hover:shadow-[0_0_40px_rgba(255,107,53,0.5)] transition-all"
      >
        New Local Game
      </button>
    </main>
  );
}
