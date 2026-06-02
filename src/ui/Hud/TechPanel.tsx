import { useGame, viewerId, canAct } from '../../store';
import { TECHS, nextResearchable } from '../../game/tech';
import type { TechTrack } from '../../game/tech';
import { ResourceGlyph } from '../ResourceGlyph';

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
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-widest text-white/40">Tech</span>
        <span className="flex items-center gap-1 text-xs text-white/60">
          You have
          <ResourceGlyph resource="RES" size={13} />
          <b className="text-white/85">{me.resources.RES}</b>
        </span>
      </div>
      <p className="text-[11px] text-white/40 mb-3 leading-snug">
        Permanent upgrades. Spend <b className="text-white/70">Research</b> — earned from{' '}
        <b className="text-white/70">Labs</b> and some goals — to buy a track’s techs in order. Each
        is <span className="text-white/70">+1 VP</span> (up to 4) plus its effect.
      </p>
      <div className="space-y-2">
        {TRACKS.map((track) => {
          const next = nextResearchable(me, track);
          const owned = TECHS.filter((t) => t.track === track && me.techs.includes(t.id)).length;
          const affordable = !!next && me.resources.RES >= next.cost && canResearch;
          const short = next ? next.cost - me.resources.RES : 0;
          return (
            <div key={track} className="rounded-xl bg-black/20 p-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-wider text-cyan/60">
                  {TRACK_LABEL[track]}
                </span>
                <span className="text-[10px] text-white/40">{owned}/4 owned</span>
              </div>
              {next ? (
                <button
                  disabled={!affordable}
                  onClick={() => dispatch({ type: 'RESEARCH', techId: next.id })}
                  title={affordable ? 'Click to research' : next.desc}
                  className={`w-full text-left rounded-lg px-2 py-1 mt-1 border transition
                    ${affordable ? 'border-res-rsh bg-res-rsh/15 hover:bg-res-rsh/25 cursor-pointer' : 'border-white/10'}`}
                >
                  <div className="flex justify-between items-center text-xs font-display">
                    <span>{next.name}</span>
                    <span className="flex items-center gap-0.5 text-res-rsh">
                      {next.cost}
                      <ResourceGlyph resource="RES" size={12} />
                    </span>
                  </div>
                  <div className="text-[10px] text-white/50 leading-snug">{next.desc}</div>
                  {!affordable && canResearch && short > 0 && (
                    <div className="text-[10px] text-white/30 mt-0.5">Need {short} more Research</div>
                  )}
                </button>
              ) : (
                <div className="text-xs text-mars mt-1">All researched ✓ (+4 VP)</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
