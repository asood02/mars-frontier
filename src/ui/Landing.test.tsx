import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Landing from './Landing';
import { useGame } from '../store';

describe('Landing', () => {
  it('shows the title and starts a game on click', () => {
    render(<Landing />);
    expect(screen.getByText(/MARS FRONTIER/i)).toBeInTheDocument();
    screen.getByText(/New Local Game/i).click();
    expect(useGame.getState().game).not.toBeNull();
    expect(useGame.getState().screen).toBe('game');
  });
});
