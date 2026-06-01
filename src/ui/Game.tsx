import Board from './Board/Board';
import TurnBar from './Hud/TurnBar';
import ResourceRail from './Hud/ResourceRail';
import ActionBar from './Hud/ActionBar';
import MissionPanel from './Hud/MissionPanel';
import TechPanel from './Hud/TechPanel';
import TerraformMeter from './Hud/TerraformMeter';
import DiscardModal from './Hud/DiscardModal';
import { useGame, canAct } from '../store';
import { setupExpectation } from '../game/reducer';

function hint(args: {
  setup: boolean;
  act: boolean;
  phase: string;
  turnPhase: string;
  activeName: string;
}): string {
  const { setup, act, phase, turnPhase, activeName } = args;
  if (!act) return `Waiting for ${activeName}…`;
  if (setup) {
    return 'Your turn — place a Habitat, then a connected Rover Route by clicking the board.';
  }
  if (phase === 'play') {
    if (turnPhase === 'AWAIT_ROLL') return 'Your turn — roll the dice to produce resources.';
    if (turnPhase === 'DISCARD') return 'Dust storm! Discard down in the popup.';
    if (turnPhase === 'MOVE_STORM') return 'Place the dust storm on any hex (it blocks production there).';
    if (turnPhase === 'ACTIONS')
      return 'Build, trade, research, or claim a mission — then End Turn.';
  }
  return '';
}

export default function Game() {
  const game = useGame((s) => s.game);
  const act = useGame(canAct);
  if (!game) return null;
  const setup = game.phase === 'setup1' || game.phase === 'setup2';
  const exp = setup ? setupExpectation(game) : null;
  const activeName = game.players.find((p) => p.id === game.activePlayerId)!.name;

  const message = hint({
    setup: setup && !!exp,
    act,
    phase: game.phase,
    turnPhase: game.turnPhase,
    activeName,
  });

  return (
    <div className="flex flex-col h-screen">
      <TurnBar />
      {message && (
        <div
          className={`text-center py-2 font-sans text-sm ${
            act ? 'bg-mars/10 text-mars' : 'bg-white/5 text-white/50'
          }`}
        >
          {message}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex items-center justify-center p-4">
          <Board />
        </div>
        <aside className="w-72 shrink-0 overflow-y-auto p-4 space-y-4 border-l border-white/10">
          <ResourceRail />
          <TerraformMeter />
          <MissionPanel />
          <TechPanel />
        </aside>
      </div>
      <ActionBar />
      <DiscardModal />
    </div>
  );
}
