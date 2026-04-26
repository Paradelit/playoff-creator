// src/screens/LandingScreen.test.jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import LandingScreen from './LandingScreen';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

describe('LandingScreen', () => {
  it('renders hero, features, how-it-works and footer', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <LandingScreen />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /copiloto ia/i })).toBeInTheDocument();
    expect(screen.getByText(/pick, tu copiloto ia/i)).toBeInTheDocument();
    expect(screen.getByText(/empieza en 3 pasos/i)).toBeInTheDocument();
    expect(screen.getAllByText(/centro de ayuda/i).length).toBeGreaterThan(0);
  });
});
