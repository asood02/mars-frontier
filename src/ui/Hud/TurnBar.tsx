import { useGame } from '../../store';
import { playerVP } from '../../game/scoring';

export default function TurnBar() {
  const game = useGame((s) => s.game)!;
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white/5 backdrop-blur border-b border-white/10">
      {game.players.map((p, i) => {
        const active = p.id === game.activePlayerId;
        return (
          <div
            key={p.id}
            className={`flex items-center gap-2 font-display ${active ? 'text-mars' : 'text-white/50'}`}
            style={{ order: i === 0 ? 0 : 2 }}
          >
            <span
              className={`w-2 h-2 rounded-full ${active ? 'bg-mars animate-pulse' : 'bg-white/20'}`}
            />
            {p.name}
            <span className="text-2xl font-bold ml-2">{playerVP(game, p.id)}</span>
            <span className="text-xs text-white/40">VP</span>
          </div>
        );
      })}
      <div
        className="font-sans text-xs uppercase tracking-[0.3em] text-cyan/70"
        style={{ order: 1 }}
      >
        Turn {game.turn} · {game.phase}
      </div>
    </div>
  );
}
