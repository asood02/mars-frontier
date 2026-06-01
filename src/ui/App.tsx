import { useGame } from '../store';
import Landing from './Landing';
import Game from './Game';
import GameOver from './GameOver';

export default function App() {
  const screen = useGame((s) => s.screen);
  return (
    <div className="min-h-screen bg-space text-white relative overflow-hidden">
      <Starfield />
      <div className="relative z-10">
        {screen === 'landing' && <Landing />}
        {screen === 'game' && <Game />}
        {screen === 'gameover' && <GameOver />}
      </div>
    </div>
  );
}

// Subtle CSS starfield (radial-gradient dots). No animation here (Plan 6 polishes).
function Starfield() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-60"
      style={{
        backgroundImage:
          'radial-gradient(1px 1px at 20% 30%, #fff3, transparent),' +
          'radial-gradient(1px 1px at 70% 60%, #fff2, transparent),' +
          'radial-gradient(2px 2px at 40% 80%, #fff2, transparent),' +
          'radial-gradient(1px 1px at 90% 20%, #fff3, transparent)',
        backgroundSize: '200px 200px',
      }}
    />
  );
}
