import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PublicThemeProvider } from '../../contexts/PublicThemeContext';
import PlayoffScrollTelling from './PlayoffScrollTelling';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

function renderPlayoffStory() {
  return render(
    <MemoryRouter>
      <PublicThemeProvider>
        <PlayoffScrollTelling />
      </PublicThemeProvider>
    </MemoryRouter>,
  );
}

describe('PlayoffScrollTelling', () => {
  it('renders the full bracket SSR fallback with fictional teams', () => {
    renderPlayoffStory();

    expect(screen.getByText(/cb demo aro · torneo de reyes 2026/i)).toBeInTheDocument();
    expect(screen.getAllByText('Cadete A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mini Mixto').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sénior').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('playoff-bracket-cell')).toHaveLength(7);
  });

  it('keeps the CTA pointed to /login when the user is logged out', () => {
    renderPlayoffStory();
    expect(screen.getByTestId('playoff-cta')).toHaveAttribute('href', '/login');
  });
});
