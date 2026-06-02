import { useGame, canAct } from '../../store';
import { missionById, missionCtx } from '../../game/missions';
import { RESOURCE_META } from '../format';
import type { Resource } from '../../game/types';

export default function MissionPanel() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const act = useGame(canAct);
  const canClaim = game.phase === 'play' && game.turnPhase === 'ACTIONS' && act;

  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4">
      <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Goals</div>
      <p className="text-[11px] text-white/40 mb-3 leading-snug">
        Side objectives worth bonus VP. Do what the card says; when you’ve met it on your turn it
        lights up — click to <span className="text-mars">claim</span> it for instant points.
      </p>
      <div className="space-y-2">
        {game.missionsOnBoard.map((id) => {
          const def = missionById(id)!;
          const met = canClaim && def.condition(missionCtx(game, game.activePlayerId));
          const bonus = def.bonus
            ? Object.entries(def.bonus)
                .map(([r, n]) => `${n} ${RESOURCE_META[r as Resource].label}`)
                .join(', ')
            : '';
          return (
            <button
              key={id}
              disabled={!met}
              onClick={() => dispatch({ type: 'CLAIM_MISSION', missionId: id })}
              title={met ? 'Click to claim this goal' : 'Not met yet'}
              className={`w-full text-left rounded-xl px-3 py-2 border transition
                ${met ? 'border-mars bg-mars/15 hover:bg-mars/25 cursor-pointer' : 'border-white/10 bg-black/20'}`}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="font-display text-sm capitalize">{id.replace(/-/g, ' ')}</span>
                <span className="text-mars font-bold text-sm whitespace-nowrap">+{def.vp} VP</span>
              </div>
              <div className="text-[11px] text-white/55 leading-snug mt-0.5">
                <span className="text-white/40">How: </span>
                {def.desc}
                {bonus && <span className="text-white/40"> · also +{bonus}</span>}
              </div>
              <div
                className={`text-[10px] mt-1 font-display uppercase tracking-wide ${met ? 'text-mars' : 'text-white/30'}`}
              >
                {met ? '✓ Ready — click to claim' : '🔒 Not met yet'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
