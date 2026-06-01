import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import TurnBar from './TurnBar';
import ResourceRail from './ResourceRail';
import { useGame } from '../../store';

describe('HUD', () => {
  beforeEach(() => useGame.getState().newLocalGame(42));
  it('TurnBar shows both players and turn info', () => {
    const { getByText } = render(<TurnBar />);
    expect(getByText('Player 1')).toBeInTheDocument();
    expect(getByText(/setup1/i)).toBeInTheDocument();
  });
  it('ResourceRail renders the resources header', () => {
    const { getByText } = render(<ResourceRail />);
    expect(getByText(/resources/i)).toBeInTheDocument();
  });
});
