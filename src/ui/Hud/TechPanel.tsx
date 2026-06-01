import { useGame, viewerId, canAct } from '../../store';
import { TECHS, nextResearchable } from '../../game/tech';
import type { TechTrack } from '../../game/tech';

const TRACKS: TechTrack[] = ['ENG', 'BIO', 'ASTRO'];
const TRACK_LABEL: Record<TechTrack, string> = {
  ENG: 'Engineering',
  BIO: 'Biotech',
  ASTRO: 'Astro',
};

export default function TechPanel() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const vid = useGame(viewerId);
  const act = useGame(canAct);
  const me = game.players.find((p) => p.id === vid)!;
  const canResearch = game.phase === 'play' && game.turnPhase === 'ACTIONS' && act;
  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4">
      <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Tech</div>
      <p className="text-[11px] text-white/35 mb-3 leading-tight">
        Spend Research (🔬) to buy upgrades in order. Each gives +1 VP (max 4) and a permanent
        effect.
      </p>
      <div className="space-y-2">
        {TRACKS.map((track) => {
          const next = nextResearchable(me, track);
          const owned = TECHS.filter((t) => t.track === track && me.techs.includes(t.id)).length;
          const affordable = !!next && me.resources.RES >= next.cost && canResearch;
          return (
            <div key={track} className="rounded-xl bg-black/20 p-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-wider text-cyan/60">
                  {TRACK_LABEL[track]}
                </span>
                <span className="text-[10px] text-white/40">{owned}/4</span>
              </div>
              {next ? (
                <button
                  disabled={!affordable}
                  onClick={() => dispatch({ type: 'RESEARCH', techId: next.id })}
                  title={next.desc}
                  className={`w-full text-left rounded-lg px-2 py-1 mt-1 border transition
                    ${affordable ? 'border-res-rsh bg-res-rsh/10 hover:bg-res-rsh/20 cursor-pointer' : 'border-white/10 opacity-70'}`}
                >
                  <div className="flex justify-between text-xs font-display">
                    <span>{next.name}</span>
                    <span style={{ color: '#a78bfa' }}>{next.cost}🔬</span>
                  </div>
                  <div className="text-[10px] text-white/45 leading-tight">{next.desc}</div>
                </button>
              ) : (
                <div className="text-xs text-mars mt-1">All researched ✓</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
