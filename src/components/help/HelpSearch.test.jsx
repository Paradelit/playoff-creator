import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HelpSearch from './HelpSearch';

describe('HelpSearch', () => {
  it('renders an input with placeholder', () => {
    render(<HelpSearch query="" onChange={() => {}} onSearch={async () => []} />);
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<HelpSearch query="" onChange={onChange} onSearch={async () => []} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'equipo' } });
    expect(onChange).toHaveBeenCalledWith('equipo');
  });

  it('debounces onSearch calls', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn(async () => []);
    const { rerender } = render(<HelpSearch query="" onChange={() => {}} onSearch={onSearch} />);

    rerender(<HelpSearch query="e" onChange={() => {}} onSearch={onSearch} />);
    rerender(<HelpSearch query="eq" onChange={() => {}} onSearch={onSearch} />);
    rerender(<HelpSearch query="equipo" onChange={() => {}} onSearch={onSearch} />);

    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    await Promise.resolve();
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('equipo');

    vi.useRealTimers();
  });

  it('does not call onSearch for queries < 2 chars', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn(async () => []);
    const { rerender } = render(<HelpSearch query="" onChange={() => {}} onSearch={onSearch} />);
    rerender(<HelpSearch query="e" onChange={() => {}} onSearch={onSearch} />);
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    expect(onSearch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
