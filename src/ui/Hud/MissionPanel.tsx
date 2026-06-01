import { useGame, canAct } from '../../store';
import { missionById, missionCtx } from '../../game/missions';

export default function MissionPanel() {
  const game = useGame((s) => s.game)!;
  const dispatch = useGame((s) => s.dispatch);
  const act = useGame(canAct);
  const canClaim = game.phase === 'play' && game.turnPhase === 'ACTIONS' && act;
  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4">
      <div className="text-xs uppercase tracking-widest text-white/40 mb-3">Missions</div>
      <div className="space-y-2">
        {game.missionsOnBoard.map((id) => {
          const def = missionById(id)!;
          const met = canClaim && def.condition(missionCtx(game, game.activePlayerId));
          return (
            <button
              key={id}
              disabled={!met}
              onClick={() => dispatch({ type: 'CLAIM_MISSION', missionId: id })}
              className={`w-full text-left rounded-xl px-3 py-2 border transition
                ${met ? 'border-mars bg-mars/10 hover:bg-mars/20 cursor-pointer' : 'border-white/10 bg-black/20 opacity-70'}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-display text-sm capitalize">{id.replace(/-/g, ' ')}</span>
                <span className="text-mars font-bold">{def.vp} VP</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
