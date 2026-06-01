import { useGame } from '../store';

export default function Lobby() {
  const connection = useGame((s) => s.connection);
  const roomCode = useGame((s) => s.roomCode);
  const seat = useGame((s) => s.seat);
  const capacity = useGame((s) => s.capacity);
  const filled = useGame((s) => s.filled);
  const error = useGame((s) => s.error);
  const goLanding = useGame((s) => s.goLanding);

  const copy = () => {
    if (roomCode && navigator.clipboard) navigator.clipboard.writeText(roomCode).catch(() => {});
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="font-sans tracking-[0.4em] text-cyan/70 text-sm">ONLINE LOBBY</p>

      {connection === 'connecting' && (
        <p className="font-display text-2xl text-white/70 animate-pulse">Connecting…</p>
      )}

      {connection === 'waiting' && (
        <>
          {seat === 0 ? (
            <>
              <p className="text-white/60">
                Share this code with your {capacity > 2 ? 'opponents' : 'opponent'}:
              </p>
              <button
                onClick={copy}
                title="Copy"
                className="font-display text-6xl font-bold text-mars tracking-[0.2em] hover:scale-105 transition"
              >
                {roomCode}
              </button>
              <p className="text-white/40 text-sm animate-pulse">
                Waiting for players… ({filled}/{capacity} joined)
              </p>
            </>
          ) : (
            <p className="font-display text-2xl text-white/70 animate-pulse">
              Joining {roomCode}…
            </p>
          )}
        </>
      )}

      {connection === 'error' && (
        <p className="font-display text-2xl text-red-400">{error ?? 'Connection error.'}</p>
      )}

      <button
        onClick={goLanding}
        className="font-display px-8 py-3 rounded-full border border-white/20 text-white/80 hover:bg-white/10 transition"
      >
        Cancel
      </button>

      <p className="text-white/30 text-xs max-w-sm">
        Online play needs the relay server running: <code>npm run server</code> (set{' '}
        <code>VITE_WS_URL</code> to point elsewhere).
      </p>
    </main>
  );
}
