import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeroSection from './HeroSection';

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
  it('shows "Empezar gratis" CTA when not authenticated', () => {
    useAuth.mockReturnValue({ user: null });
    renderHero();
    expect(screen.getByRole('link', { name: /empezar gratis/i })).toHaveAttribute('href', '/login');
  });

  it('shows "Ir a tu área privada" CTA when authenticated', () => {
    useAuth.mockReturnValue({ user: { email: 'coach@test.com' } });
    renderHero();
    expect(screen.getByRole('link', { name: /ir a tu área privada/i })).toHaveAttribute('href', '/area-privada');
  });

  it('shows session badge with email when authenticated', () => {
    useAuth.mockReturnValue({ user: { email: 'coach@test.com' } });
    renderHero();
    expect(screen.getByText(/coach@test.com/)).toBeInTheDocument();
  });

  it('always shows secondary CTA to /ayuda', () => {
    useAuth.mockReturnValue({ user: null });
    renderHero();
    expect(screen.getByRole('link', { name: /ver centro de ayuda/i })).toHaveAttribute('href', '/ayuda');
  });
});
