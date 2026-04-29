import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import LandingScreen from './LandingScreen';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

describe('LandingScreen', () => {
  it('renders hero, features, storytelling and footer', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <LandingScreen />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /tu pizarra/i })).toBeInTheDocument();
    expect(screen.getByText(/pick, tu copiloto ia/i)).toBeInTheDocument();
    expect(screen.getByText(/tu fin de semana, ordenado en 5 segundos/i)).toBeInTheDocument();
    expect(screen.getByText(/un pdf\. un playoff listo\./i)).toBeInTheDocument();
    expect(screen.getByText(/tres movimientos\. y entrenas\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/centro de ayuda/i).length).toBeGreaterThan(0);
  });
});
