import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Tutorial from './Tutorial';
import { useGame } from '../store';

describe('Tutorial', () => {
  beforeEach(() => useGame.getState().openTutorial());

  it('shows the first slide and advances to the last', () => {
    render(<Tutorial />);
    expect(screen.getByText(/HOW TO PLAY/i)).toBeInTheDocument();
    expect(screen.getByText('Goal')).toBeInTheDocument();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Play')).toBeInTheDocument();
  });

  it('closing marks the tutorial seen', () => {
    render(<Tutorial />);
    fireEvent.click(screen.getByText('Skip'));
    expect(useGame.getState().tutorialOpen).toBe(false);
  });
});
