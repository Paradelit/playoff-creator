import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FavoriteToggle from './FavoriteToggle';

describe('FavoriteToggle', () => {
  it('reflects active state via aria-pressed', () => {
    const { rerender } = render(<FavoriteToggle active={false} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    rerender(<FavoriteToggle active={true} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle on click and stops propagation', () => {
    const onToggle = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <FavoriteToggle active={false} onToggle={onToggle} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('disables itself while the toggle handler is pending', async () => {
    let resolve;
    const onToggle = vi.fn(() => new Promise((r) => (resolve = r)));
    render(<FavoriteToggle active={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    resolve();
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled());
  });
});
