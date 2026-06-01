import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';

function reset() {
  useGame.getState().newLocalGame(42);
}

describe('store', () => {
  beforeEach(reset);

  it('newLocalGame starts a game in setup and screen=game', () => {
    const s = useGame.getState();
    expect(s.screen).toBe('game');
    expect(s.game?.phase).toBe('setup1');
    expect(s.interaction).toBe('idle');
  });

  it('dispatch applies a move for the active player and clears interaction', () => {
    const { game } = useGame.getState();
    const vertex = game!.board.vertices[0];
    useGame.getState().setInteraction('habitat');
    useGame.getState().dispatch({ type: 'BUILD', building: 'HABITAT', locationId: vertex });
    const after = useGame.getState();
    expect(after.game!.buildings).toHaveLength(1);
    expect(after.interaction).toBe('idle');
    expect(after.error).toBeNull();
  });

  it('dispatch records an error on an illegal move and does not change state', () => {
    const before = useGame.getState().game!.buildings.length;
    useGame
      .getState()
      .dispatch({ type: 'BUILD_ROUTE', edgeId: useGame.getState().game!.board.edges[0] });
    const s = useGame.getState();
    expect(s.error).toMatch(/habitat/i);
    expect(s.game!.buildings).toHaveLength(before);
  });

  it('exposes a roll() function', () => {
    expect(typeof useGame.getState().roll).toBe('function');
  });
});
