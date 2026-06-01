import { useGame } from '../store';
import Landing from './Landing';
import Lobby from './Lobby';
import Game from './Game';
import GameOver from './GameOver';
import Tutorial from './Tutorial';

export default function App() {
  const screen = useGame((s) => s.screen);
  const tutorialOpen = useGame((s) => s.tutorialOpen);
  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, #2e1810 0%, #43261a 32%, #2a160e 68%, #170c07 100%)',
      }}
    >
      <MarsScape />
      <div className="relative z-10">
        {screen === 'landing' && <Landing />}
        {screen === 'lobby' && <Lobby />}
        {screen === 'game' && <Game />}
        {screen === 'gameover' && <GameOver />}
      </div>
      {tutorialOpen && <Tutorial />}
    </div>
  );
}

// Martian ambience: a low sun glow over a dusty sky, faint stars, and a fine
// soil-grain texture (feTurbulence baked into a data-URI) so the backdrop reads
// like Martian rock and dust rather than empty space.
function MarsScape() {
  const soil =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* low sun haze */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 74% 2%, rgba(255,176,112,0.22), transparent 62%)',
        }}
      />
      {/* faint stars near the top of the sky */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 18% 14%, #ffffff66, transparent),' +
            'radial-gradient(1px 1px at 64% 9%, #ffffff44, transparent),' +
            'radial-gradient(1px 1px at 88% 18%, #ffffff55, transparent)',
          backgroundSize: '300px 300px',
        }}
      />
      {/* dusty soil grain */}
      <div
        className="absolute inset-0 mix-blend-overlay opacity-[0.18]"
        style={{ backgroundImage: `url("${soil}")`, backgroundSize: '220px 220px' }}
      />
      {/* darker rocky ground fading in at the bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: 'linear-gradient(0deg, rgba(10,6,3,0.55), transparent)' }}
      />
    </div>
  );
}
