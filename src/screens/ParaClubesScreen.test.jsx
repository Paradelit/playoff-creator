/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/usePublicTheme', () => ({ usePublicTheme: () => ({ theme: 'light' }) }));
vi.mock('../components/landing/LandingFooter', () => ({ default: () => <footer data-testid="footer" /> }));

import ParaClubesScreen from './ParaClubesScreen';
import { useAuth } from '../contexts/AuthContext';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ParaClubesScreen />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('ParaClubesScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza hero + features + how-it-works', () => {
    useAuth.mockReturnValue({ user: null });
    renderPage();
    expect(screen.getByText(/Un workspace/)).toBeInTheDocument();
    expect(screen.getByText(/Cómo es la vida del club/i)).toBeInTheDocument();
    expect(screen.getByText(/Cómo se monta en 4 pasos/i)).toBeInTheDocument();
  });

  it('CTAs principales sin sesión van a /login con redirect a /upgrade/club', () => {
    useAuth.mockReturnValue({ user: null });
    renderPage();
    const ctas = screen.getAllByRole('link', { name: /Activar Pro Club/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2); // hero + final CTA
    ctas.forEach((cta) => {
      expect(cta).toHaveAttribute('href', '/login?redirect=%2Fupgrade%2Fclub');
    });
  });

  it('CTAs con sesión van directos a /upgrade/club', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-1' } });
    renderPage();
    const ctas = screen.getAllByRole('link', { name: /Activar Pro Club/i });
    ctas.forEach((cta) => {
      expect(cta).toHaveAttribute('href', '/upgrade/club');
    });
  });

  it('muestra el precio per-seat en el hero', () => {
    useAuth.mockReturnValue({ user: null });
    renderPage();
    expect(screen.getByText(/€3,99 \/ asiento \/ mes/)).toBeInTheDocument();
  });

  it('enlace "Ver precios" lleva a /precios', () => {
    useAuth.mockReturnValue({ user: null });
    renderPage();
    expect(screen.getByRole('link', { name: /Ver precios/i })).toHaveAttribute('href', '/precios');
  });
});
