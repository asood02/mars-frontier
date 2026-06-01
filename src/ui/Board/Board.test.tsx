import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Board from './Board';
import { useGame } from '../../store';

describe('Board', () => {
  beforeEach(() => useGame.getState().newLocalGame(42));
  it('renders an SVG with the board label', () => {
    const { getByLabelText } = render(<Board />);
    expect(getByLabelText('Mars Frontier board')).toBeInTheDocument();
  });
  it('renders at least 30 hex polygons', () => {
    const { container } = render(<Board />);
    expect(container.querySelectorAll('polygon').length).toBeGreaterThanOrEqual(30);
  });
});
