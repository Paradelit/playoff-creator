import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryChipPicker from './CategoryChipPicker';

function Harness({ initial = [], onChange }) {
  const [tags, setTags] = useState(initial);
  return (
    <CategoryChipPicker
      tags={tags}
      onChange={(next) => {
        setTags(next);
        onChange(next);
      }}
    />
  );
}

describe('CategoryChipPicker', () => {
  it('adds the canonical label to tags when a chip is toggled on', () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Tiro').closest('button'));
    expect(onChange).toHaveBeenLastCalledWith(['Tiro']);
  });

  it('removes any alias of the category when toggled off', () => {
    const onChange = vi.fn();
    render(<Harness initial={['shooting', 'Defensa']} onChange={onChange} />);
    const tiroBtn = screen.getByText('Tiro').closest('button');
    expect(tiroBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(tiroBtn);
    expect(onChange).toHaveBeenLastCalledWith(['Defensa']);
  });

  it('preserves free-form tags that are not part of the curated taxonomy', () => {
    const onChange = vi.fn();
    render(<Harness initial={['tiro-exterior', 'Defensa']} onChange={onChange} />);
    fireEvent.click(screen.getByText('Pase').closest('button'));
    expect(onChange).toHaveBeenLastCalledWith(['tiro-exterior', 'Defensa', 'Pase']);
  });

  it('highlights chips for tags that match via aliases', () => {
    render(<Harness initial={['tiro', 'defensivo']} onChange={() => {}} />);
    expect(screen.getByText('Tiro').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Defensa').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Pase').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
