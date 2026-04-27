import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

import { useAuth } from '../../contexts/AuthContext';

function renderNav() {
  return render(
    <MemoryRouter>
      <PublicNavbar />
    </MemoryRouter>,
  );
}

describe('PublicNavbar', () => {
  it('renders brand link to /', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /pick&coach/i })).toHaveAttribute('href', '/');
  });

  it('shows Inicio and Centro de ayuda nav links', () => {
    renderNav();
    expect(screen.getAllByRole('link', { name: /inicio/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /centro de ayuda/i }).length).toBeGreaterThan(0);
  });

  it('shows Iniciar sesión CTA when not authenticated', () => {
    useAuth.mockReturnValue({ user: null });
    renderNav();
    const ctas = screen.getAllByRole('link', { name: /iniciar sesión/i });
    expect(ctas[0]).toHaveAttribute('href', '/login');
  });

  it('shows Mi área privada CTA when authenticated', () => {
    useAuth.mockReturnValue({ user: { uid: 'abc', email: 'a@b.c' } });
    renderNav();
    const ctas = screen.getAllByRole('link', { name: /mi área privada/i });
    expect(ctas[0]).toHaveAttribute('href', '/area-privada');
  });
});
