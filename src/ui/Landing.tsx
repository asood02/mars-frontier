import { useState } from 'react';
import { useGame } from '../store';

export default function Landing() {
  const newLocalGame = useGame((s) => s.newLocalGame);
  const hostOnline = useGame((s) => s.hostOnline);
  const joinOnline = useGame((s) => s.joinOnline);
  const [showJoin, setShowJoin] = useState(false);
  const [code, setCode] = useState('');

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

      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <button
          onClick={() => newLocalGame()}
          className="w-full font-display text-lg px-10 py-4 rounded-full bg-mars text-space font-bold tracking-wide
                     hover:scale-105 hover:shadow-[0_0_40px_rgba(255,107,53,0.5)] transition-all"
        >
          New Local Game
        </button>

        <div className="flex gap-3 w-full">
          <button
            onClick={hostOnline}
            className="flex-1 font-display px-6 py-3 rounded-full border border-cyan/50 text-cyan hover:bg-cyan/10 transition"
          >
            Host Online
          </button>
          <button
            onClick={() => setShowJoin((v) => !v)}
            className="flex-1 font-display px-6 py-3 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition"
          >
            Join Online
          </button>
        </div>

        {showJoin && (
          <form
            className="flex gap-2 w-full"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().length >= 4) joinOnline(code.trim());
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              className="flex-1 bg-white/5 border border-white/15 rounded-full px-5 py-3 font-display tracking-[0.3em] text-center uppercase placeholder:text-white/30 focus:outline-none focus:border-cyan/60"
            />
            <button
              type="submit"
              className="font-display px-6 py-3 rounded-full bg-cyan/90 text-space font-bold hover:scale-105 transition"
            >
              Join
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
