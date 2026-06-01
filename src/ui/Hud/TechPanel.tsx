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
      <div className="text-xs uppercase tracking-widest text-white/40 mb-3">Tech</div>
      <div className="grid grid-cols-3 gap-2">
        {TRACKS.map((track) => {
          const next = nextResearchable(me, track);
          const owned = TECHS.filter((t) => t.track === track && me.techs.includes(t.id)).length;
          const affordable = !!next && me.resources.RES >= next.cost && canResearch;
          return (
            <div key={track} className="rounded-xl bg-black/20 p-2">
              <div className="text-[10px] uppercase tracking-wider text-cyan/60">
                {TRACK_LABEL[track]}
              </div>
              <div className="text-xs text-white/50 mb-1">{owned}/4</div>
              {next ? (
                <button
                  disabled={!affordable}
                  onClick={() => dispatch({ type: 'RESEARCH', techId: next.id })}
                  className={`w-full text-left rounded-lg px-2 py-1 text-xs border transition
                    ${affordable ? 'border-res-rsh bg-res-rsh/10 hover:bg-res-rsh/20' : 'border-white/10 opacity-60'}`}
                >
                  {next.name}
                  <span className="float-right" style={{ color: '#a78bfa' }}>
                    {next.cost}🔬
                  </span>
                </button>
              ) : (
                <div className="text-xs text-mars">Maxed</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
