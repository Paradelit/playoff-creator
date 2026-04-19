import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsageBadge from './UsageBadge';

const NOW = new Date(2026, 3, 18).getTime();
const DAY = 24 * 60 * 60 * 1000;

describe('UsageBadge', () => {
  it('renders nothing when there is no usage', () => {
    const { container } = render(<UsageBadge count={0} lastUsedMs={0} now={NOW} />);
    expect(container.firstChild).toBeNull();
  });

  it('formats a single use and relative date', () => {
    render(<UsageBadge count={1} lastUsedMs={NOW - 2 * DAY} now={NOW} />);
    expect(screen.getByText('Usado 1 vez')).toBeInTheDocument();
    expect(screen.getByText('hace 2 días')).toBeInTheDocument();
  });

  it('pluralizes usage count', () => {
    render(<UsageBadge count={4} lastUsedMs={NOW} now={NOW} />);
    expect(screen.getByText('Usado 4 veces')).toBeInTheDocument();
    expect(screen.getByText('hoy')).toBeInTheDocument();
  });

  it('uses "ayer" for yesterday', () => {
    render(<UsageBadge count={1} lastUsedMs={NOW - DAY} now={NOW} />);
    expect(screen.getByText('ayer')).toBeInTheDocument();
  });

  it('formats weeks and months', () => {
    const { rerender } = render(<UsageBadge count={2} lastUsedMs={NOW - 10 * DAY} now={NOW} />);
    expect(screen.getByText('hace 1 sem.')).toBeInTheDocument();
    rerender(<UsageBadge count={2} lastUsedMs={NOW - 60 * DAY} now={NOW} />);
    expect(screen.getByText('hace 2 meses')).toBeInTheDocument();
  });
});
