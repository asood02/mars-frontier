import { useGame, canAct } from '../../store';
import { missionById, missionCtx } from '../../game/missions';

export default function MissionPanel() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const act = useGame(canAct);
  const canClaim = game.phase === 'play' && game.turnPhase === 'ACTIONS' && act;
  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4">
      <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Missions</div>
      <p className="text-[11px] text-white/35 mb-3 leading-tight">
        Bonus goals. Claim one on your turn when its condition is met — it scores VP instantly.
      </p>
      <div className="space-y-2">
        {game.missionsOnBoard.map((id) => {
          const def = missionById(id)!;
          const met = canClaim && def.condition(missionCtx(game, game.activePlayerId));
          const bonusText = def.bonus
            ? ' + ' + Object.entries(def.bonus).map(([r, n]) => `${n} ${r}`).join(', ')
            : '';
          return (
            <button
              key={id}
              disabled={!met}
              onClick={() => dispatch({ type: 'CLAIM_MISSION', missionId: id })}
              title={met ? 'Click to claim' : 'Condition not yet met'}
              className={`w-full text-left rounded-xl px-3 py-2 border transition
                ${met ? 'border-mars bg-mars/10 hover:bg-mars/20 cursor-pointer' : 'border-white/10 bg-black/20 opacity-70'}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-display text-sm capitalize">{id.replace(/-/g, ' ')}</span>
                <span className="text-mars font-bold text-sm">
                  {def.vp} VP{bonusText}
                </span>
              </div>
              <div className="text-[11px] text-white/45 leading-tight">{def.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
