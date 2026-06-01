import { useGame } from '../../store';
import { playerVP } from '../../game/scoring';

export default function TurnBar() {
  const game = useGame((s) => s.game)!;
  const openTutorial = useGame((s) => s.openTutorial);
  const openGuide = useGame((s) => s.openGuide);
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 bg-white/5 backdrop-blur border-b border-white/10">
      <div className="flex items-center gap-4 min-w-0 flex-wrap">
        {game.players.map((p) => {
          const active = p.id === game.activePlayerId;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 font-display ${active ? 'text-mars' : 'text-white/50'}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${active ? 'bg-mars animate-pulse' : 'bg-white/20'}`}
              />
              <span className="truncate max-w-[7rem]">{p.name}</span>
              <span className="text-2xl font-bold">{playerVP(game, p.id)}</span>
              <span className="text-xs text-white/40">VP</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-sans text-xs uppercase tracking-[0.3em] text-cyan/70 hidden sm:inline">
          Turn {game.turn} · {game.phase}
        </span>
        <button
          onClick={openGuide}
          title="Resource & building guide"
          aria-label="Open guide"
          className="px-3 h-6 rounded-full border border-white/20 text-white/70 text-xs hover:bg-white/10 transition"
        >
          Guide
        </button>
        <button
          onClick={openTutorial}
          title="How to play"
          aria-label="How to play"
          className="w-6 h-6 rounded-full border border-white/20 text-white/60 text-xs hover:bg-white/10 transition"
        >
          ?
        </button>
      </div>
    </div>
  );
}
