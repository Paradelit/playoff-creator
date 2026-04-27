import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeroSection, { PICK_BLOCKS, USER_MSG } from './HeroSection';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';

function renderHero() {
  return render(
    <MemoryRouter>
      <HeroSection />
    </MemoryRouter>,
  );
}

describe('HeroSection', () => {
  it('renders the full SSR fallback conversation by default', () => {
    useAuth.mockReturnValue({ user: null });
    renderHero();

    expect(screen.getByTestId('hero-user-message')).toHaveTextContent(USER_MSG);
    expect(screen.getAllByTestId('hero-pick-block')).toHaveLength(PICK_BLOCKS.length);
  });

  it('shows "Empezar gratis" CTA when not authenticated', () => {
    useAuth.mockReturnValue({ user: null });
    renderHero();
    expect(screen.getByRole('link', { name: /empezar gratis/i })).toHaveAttribute('href', '/login');
  });

  it('shows "Ir a tu área" CTA when authenticated', () => {
    useAuth.mockReturnValue({ user: { email: 'coach@test.com' } });
    renderHero();
    expect(screen.getByRole('link', { name: /ir a tu área/i })).toHaveAttribute('href', '/area-privada');
  });

  it('shows the session badge with the user email when authenticated', () => {
    useAuth.mockReturnValue({ user: { email: 'coach@test.com' } });
    renderHero();
    expect(screen.getByText(/coach@test.com/)).toBeInTheDocument();
  });

  it('always shows the secondary CTA to /ayuda', () => {
    useAuth.mockReturnValue({ user: null });
    renderHero();
    expect(screen.getByRole('link', { name: /ver guías/i })).toHaveAttribute('href', '/ayuda');
  });
});
