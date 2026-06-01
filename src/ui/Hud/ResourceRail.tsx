import { useGame, viewerId } from '../../store';
import { RESOURCE_META, resourceHelp } from '../format';
import { RESOURCES } from '../../game/types';

export default function ResourceRail() {
  const game = useGame((s) => s.game)!;
  const vid = useGame(viewerId);
  const me = game.players.find((p) => p.id === vid)!;
  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4">
      <div className="text-xs uppercase tracking-widest text-white/40 mb-3">
        {me.name}'s resources
      </div>
      <div className="grid grid-cols-5 gap-2">
        {RESOURCES.map((r) => (
          <div
            key={r}
            title={resourceHelp(r)}
            className="flex flex-col items-center rounded-xl bg-black/30 py-2"
          >
            <span style={{ color: RESOURCE_META[r].color }} className="text-base leading-none">
              {RESOURCE_META[r].glyph}
            </span>
            <span className="font-display text-xl font-bold leading-tight">{me.resources[r]}</span>
            <span className="text-[9px] uppercase tracking-wide text-white/35">
              {RESOURCE_META[r].label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
