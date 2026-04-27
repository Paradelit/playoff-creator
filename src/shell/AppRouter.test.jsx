import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRouter from './AppRouter';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../components/ModuleBoundary', () => ({
  default: ({ children }) => children,
}));

vi.mock('../screens/LoginScreen', () => ({
  default: () => 'login screen',
}));

vi.mock('../screens/HomeScreen', () => ({
  default: () => 'home screen',
}));

vi.mock('../router/LegacyPathRedirect', () => ({
  default: () => 'legacy redirect',
}));

vi.mock('./publicRoutes', () => ({
  PUBLIC_ROUTE_DEFS: [
    { path: '/', element: 'landing screen' },
    { path: '/ayuda', element: 'help screen' },
  ],
}));

import { useAuth } from '../contexts/AuthContext';

function renderRouter(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe('AppRouter', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('renders public routes immediately even before auth is ready', () => {
    useAuth.mockReturnValue({ user: null, authReady: false });

    renderRouter('/');

    expect(screen.getByText('landing screen')).toBeInTheDocument();
    expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();
  });

  it('keeps protected routes behind the auth loading state', () => {
    useAuth.mockReturnValue({ user: null, authReady: false });

    renderRouter('/area-privada');

    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('sends logged-out share links to login instead of forcing the private app route', () => {
    useAuth.mockReturnValue({ user: null, authReady: true });

    renderRouter('/s/SHARE1');

    expect(screen.getByText('login screen')).toBeInTheDocument();
  });
});
