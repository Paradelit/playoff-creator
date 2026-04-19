import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryChip from './CategoryChip';

const TIRO = { id: 'tiro', label: 'Tiro', emoji: '🎯' };

describe('CategoryChip', () => {
  it('renders the category emoji and label', () => {
    render(<CategoryChip category={TIRO} onClick={() => {}} />);
    expect(screen.getByText('Tiro')).toBeInTheDocument();
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  it('shows the count badge when count is positive', () => {
    render(<CategoryChip category={TIRO} count={5} onClick={() => {}} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('hides the count badge when count is zero or missing', () => {
    const { rerender } = render(<CategoryChip category={TIRO} count={0} onClick={() => {}} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    rerender(<CategoryChip category={TIRO} onClick={() => {}} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('reflects active state via aria-pressed and fires onClick', () => {
    const onClick = vi.fn();
    render(<CategoryChip category={TIRO} active onClick={onClick} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
