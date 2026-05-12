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

import PricingScreen from './PricingScreen';
import { useAuth } from '../contexts/AuthContext';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <PricingScreen />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('PricingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza los 3 planes (Free, Pro, Pro Club)', () => {
    useAuth.mockReturnValue({ user: null });
    renderPage();
    expect(screen.getByText(/Coach Free/i)).toBeInTheDocument();
    expect(screen.getByText(/Coach Pro/i)).toBeInTheDocument();
    // "Pro Club" aparece en card title + CTA + FAQ; basta con verificar que al
    // menos uno está presente.
    expect(screen.getAllByText(/Pro Club/i).length).toBeGreaterThan(0);
  });

  it('muestra los precios de DISPLAY_PRICES', () => {
    useAuth.mockReturnValue({ user: null });
    renderPage();
    expect(screen.getByText(/€4,99 \/ mes/)).toBeInTheDocument();
    expect(screen.getByText(/€49 \/ año/)).toBeInTheDocument();
    expect(screen.getByText(/€3,99 \/ asiento \/ mes/)).toBeInTheDocument();
  });

  it('CTAs de Pro y Pro Club apuntan a /login si no hay sesión', () => {
    useAuth.mockReturnValue({ user: null });
    renderPage();
    const proCta = screen.getByRole('link', { name: /Hazte Pro/i });
    expect(proCta).toHaveAttribute('href', '/login?redirect=%2Fupgrade');
    const clubCta = screen.getByRole('link', { name: /Activar Pro Club/i });
    expect(clubCta).toHaveAttribute('href', '/login?redirect=%2Fupgrade%2Fclub');
  });

  it('CTAs de Pro y Pro Club apuntan a /upgrade directo si hay sesión', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-1' } });
    renderPage();
    expect(screen.getByRole('link', { name: /Hazte Pro/i })).toHaveAttribute('href', '/upgrade');
    expect(screen.getByRole('link', { name: /Activar Pro Club/i })).toHaveAttribute('href', '/upgrade/club');
  });

  it('incluye sección FAQ con preguntas comunes', () => {
    useAuth.mockReturnValue({ user: null });
    renderPage();
    expect(screen.getByText(/Dudas comunes/i)).toBeInTheDocument();
    expect(screen.getByText(/cap de Free/i)).toBeInTheDocument();
    expect(screen.getByText(/cancelar Pro/i)).toBeInTheDocument();
  });
});
