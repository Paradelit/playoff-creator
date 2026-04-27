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

    expect(screen.getByRole('heading', { level: 1, name: /entrena/i })).toBeInTheDocument();
    expect(screen.getByText(/pick, tu copiloto ia/i)).toBeInTheDocument();
    expect(screen.getByText(/tu fin de semana en 5 segundos/i)).toBeInTheDocument();
    expect(screen.getByText(/un pdf\. un cuadro perfecto\./i)).toBeInTheDocument();
    expect(screen.getByText(/empieza en 3 pasos/i)).toBeInTheDocument();
    expect(screen.getAllByText(/centro de ayuda/i).length).toBeGreaterThan(0);
  });
});
