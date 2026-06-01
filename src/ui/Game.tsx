import Board from './Board/Board';
import TurnBar from './Hud/TurnBar';
import ResourceRail from './Hud/ResourceRail';
import ActionBar from './Hud/ActionBar';
import MissionPanel from './Hud/MissionPanel';
import TechPanel from './Hud/TechPanel';
import DiscardModal from './Hud/DiscardModal';
import { useGame } from '../store';

export default function Game() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const setup = game.phase === 'setup1' || game.phase === 'setup2';
  const active = game.players.find((p) => p.id === game.activePlayerId)!;

  return (
    <div className="flex flex-col h-screen">
      <TurnBar />
      {setup && (
        <div className="bg-mars/10 text-mars text-center py-2 font-sans text-sm">
          Setup: {active.name}, place a Habitat then a connected Rover Route by clicking the board.
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex items-center justify-center p-4">
          <Board />
        </div>
        <aside className="w-72 shrink-0 overflow-y-auto p-4 space-y-4 border-l border-white/10">
          <ResourceRail />
          <MissionPanel />
          <TechPanel />
        </aside>
      </div>
      <ActionBar />
      <DiscardModal />
    </div>
  );
}
