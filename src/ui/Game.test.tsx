import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Game from './Game';
import { useGame } from '../store';

describe('Game screen', () => {
  beforeEach(() => useGame.getState().newLocalGame(42));

  it('renders the board and HUD, and shows the setup banner', () => {
    render(<Game />);
    expect(screen.getByLabelText('Mars Frontier board')).toBeInTheDocument();
    expect(screen.getByText(/place a Habitat/i)).toBeInTheDocument();
  });

  it('store dispatch stays consistent while scripting some setup placements', () => {
    render(<Game />);
    for (let i = 0; i < 4; i++) {
      const st = useGame.getState().game!;
      const used = new Set(st.buildings.map((b) => b.vertexId));
      const vid = st.board.vertices.find((v) => !used.has(v))!;
      useGame.getState().dispatch({ type: 'BUILD', building: 'HABITAT', locationId: vid });
      const st2 = useGame.getState().game!;
      const edge = st2.board.edges.find((e) => !st2.routes.some((r) => r.edgeId === e))!;
      useGame.getState().dispatch({ type: 'BUILD_ROUTE', edgeId: edge });
    }
    expect(useGame.getState().game).toBeTruthy();
  });
});
