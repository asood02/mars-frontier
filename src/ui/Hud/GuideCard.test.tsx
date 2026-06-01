import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import GuideCard from './GuideCard';
import TurnBar from './TurnBar';
import { useGame } from '../../store';
import { RESOURCE_META, BUILDING_META, BUILDABLES } from '../format';
import { RESOURCES } from '../../game/types';

describe('GuideCard', () => {
  beforeEach(() => useGame.getState().newLocalGame(42));

  it('lists every resource with its label', () => {
    render(<GuideCard />);
    for (const r of RESOURCES) {
      expect(screen.getByText(RESOURCE_META[r].label)).toBeInTheDocument();
    }
  });

  it('lists every building with its label', () => {
    render(<GuideCard />);
    for (const b of BUILDABLES) {
      expect(screen.getByText(BUILDING_META[b].label)).toBeInTheDocument();
    }
  });

  it('shows derived "produced by" and "used for" copy', () => {
    render(<GuideCard />);
    // Oxygen comes from Plains and is used to build Habitats — proves derivation ran.
    expect(screen.getAllByText(/Produced by/i).length).toBeGreaterThanOrEqual(RESOURCES.length);
    expect(screen.getByText(/Plains/)).toBeInTheDocument();
  });

  it('opens from the TurnBar Guide button', () => {
    render(<TurnBar />);
    expect(useGame.getState().guideOpen).toBe(false);
    screen.getByRole('button', { name: /open guide/i }).click();
    expect(useGame.getState().guideOpen).toBe(true);
  });
});
