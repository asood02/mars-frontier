import { useState } from 'react';
import { useGame } from '../store';

interface Slide {
  title: string;
  body: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: 'Goal',
    body: (
      <>
        Build a Martian colony and be the first to <b className="text-mars">10 victory points</b>.
        You earn VP from buildings, the longest rover route, tech cards, and mission cards.
      </>
    ),
  },
  {
    title: 'Tiles make resources',
    body: (
      <>
        Each tile shows what it produces: <span className="text-res-o2">🌿 Plains → Oxygen</span>,{' '}
        <span className="text-res-h2o">🧊 Ice → Water</span>,{' '}
        <span className="text-res-ore">⛰️ Ridge → Ore</span>,{' '}
        <span className="text-res-eng">🔆 Crater → Energy</span>,{' '}
        <span className="text-res-rsh">🔬 Lab → Research</span>. The number is its dice roll; the dots
        show how likely that roll is.
      </>
    ),
  },
  {
    title: 'Your turn',
    body: (
      <>
        1. <b>Roll</b> the dice — every tile with that number pays its neighbours.
        <br />
        2. <b>Spend</b> resources to build Habitats/Domes/Routes/Comm Towers, trade, research tech, or
        claim a mission.
        <br />
        3. <b>End Turn</b>.
      </>
    ),
  },
  {
    title: 'Setup & placement',
    body: (
      <>
        First, each player places <b>2 Habitats</b>, each with a connected <b>Rover Route</b>, by
        clicking the glowing spots. Habitats can't be adjacent. New buildings must connect to your own
        routes.
      </>
    ),
  },
  {
    title: 'Watch the storm',
    body: (
      <>
        Roll a <b className="text-mars">7</b> and the Dust Storm strikes: players holding 8+ resources
        discard half, and you move the storm onto a tile to block its production. Tech and missions let
        you bend these rules.
      </>
    ),
  },
];

export default function Tutorial() {
  const close = useGame((s) => s.closeTutorial);
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-space border border-mars/40 p-8 shadow-[0_0_60px_rgba(255,107,53,0.2)]">
        <div className="flex items-center justify-between mb-2">
          <p className="font-sans tracking-[0.35em] text-cyan/70 text-xs">HOW TO PLAY</p>
          <span className="text-white/30 text-xs">
            {i + 1} / {SLIDES.length}
          </span>
        </div>
        <h2 className="font-display text-3xl text-mars mb-4">{SLIDES[i].title}</h2>
        <div className="text-white/75 leading-relaxed min-h-[6rem]">{SLIDES[i].body}</div>

        <div className="flex items-center justify-between mt-8">
          <button onClick={close} className="text-white/40 hover:text-white/70 text-sm transition">
            Skip
          </button>
          <div className="flex gap-2">
            {SLIDES.map((_, k) => (
              <span
                key={k}
                className={`w-2 h-2 rounded-full ${k === i ? 'bg-mars' : 'bg-white/20'}`}
              />
            ))}
          </div>
          {last ? (
            <button
              onClick={close}
              className="font-display px-6 py-2 rounded-full bg-mars text-space font-bold hover:scale-105 transition"
            >
              Play
            </button>
          ) : (
            <button
              onClick={() => setI((v) => v + 1)}
              className="font-display px-6 py-2 rounded-full bg-cyan/90 text-space font-bold hover:scale-105 transition"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
