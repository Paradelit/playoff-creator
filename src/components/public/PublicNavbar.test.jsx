import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';
import { PublicThemeProvider } from '../../contexts/PublicThemeContext';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

import { useAuth } from '../../contexts/AuthContext';

function renderNav(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PublicThemeProvider>
        <PublicNavbar />
      </PublicThemeProvider>
    </MemoryRouter>,
  );
}

describe('PublicNavbar', () => {
  it('renders the brand link to /', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /pick&coach/i })).toHaveAttribute('href', '/');
  });

  it('shows the Inicio and Centro de ayuda navigation links', () => {
    renderNav();
    expect(screen.getAllByRole('link', { name: /inicio/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /centro de ayuda/i }).length).toBeGreaterThan(0);
  });

  it('shows the Entrar CTA when not authenticated', () => {
    useAuth.mockReturnValue({ user: null });
    renderNav();
    const ctas = screen.getAllByRole('link', { name: /entrar/i });
    expect(ctas[0]).toHaveAttribute('href', '/login');
  });

  it('shows the Mi área CTA when authenticated', () => {
    useAuth.mockReturnValue({ user: { uid: 'abc', email: 'a@b.c' } });
    renderNav();
    const ctas = screen.getAllByRole('link', { name: /mi área/i });
    expect(ctas[0]).toHaveAttribute('href', '/area-privada');
  });

  it('toggles the public theme and persists it', () => {
    useAuth.mockReturnValue({ user: null });
    renderNav();

    const toggle = screen.getAllByRole('switch', { name: /cambiar a modo claro/i })[0];
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);

    expect(screen.getAllByRole('switch', { name: /cambiar a modo oscuro/i })[0]).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(window.localStorage.getItem('pickcoach.publicTheme')).toBe('light');
  });
});
