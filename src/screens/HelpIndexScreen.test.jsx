import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import HelpIndexScreen from './HelpIndexScreen';

vi.mock('../content/helpArticles', () => ({
  HELP_ARTICLES: [
    {
      id: 'a1',
      slug: 'crear-equipo',
      category: 'app-usage',
      title: 'Crear equipo',
      summary: 'Crea tu equipo',
      body: '',
      tags: ['equipos'],
      updatedAt: '2026-04-25',
    },
    {
      id: 'a2',
      slug: 'reglas-bo3',
      category: 'competition-rules',
      title: 'Series BO3',
      summary: 'Como funciona BO3',
      body: '',
      tags: ['bo3'],
      updatedAt: '2026-04-25',
    },
  ],
  HELP_CATEGORIES: {
    'app-usage': { label: 'Guias de uso', description: 'Como usar la app', order: 1 },
    'competition-rules': { label: 'Reglas', description: 'Formatos', order: 2 },
    'bracket-engine': { label: 'Motor de cuadros', description: '', order: 3 },
    'basketball-concepts': { label: 'Baloncesto', description: '', order: 4 },
  },
}));

function renderScreen(initialEntry = '/ayuda') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HelpIndexScreen />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function renderSearchNavigation(initialEntry = '/ayuda?q=BO3') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/ayuda"
            element={
              <>
                <HelpIndexScreen />
                <Link to="/ayuda?q=equipo">cambiar busqueda</Link>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('HelpIndexScreen', () => {
  it('renders categories with their articles when no query', () => {
    renderScreen();
    expect(screen.getByText('Guias de uso')).toBeInTheDocument();
    expect(screen.getByText('Reglas')).toBeInTheDocument();
    expect(screen.getByText('Crear equipo')).toBeInTheDocument();
    expect(screen.getByText('Series BO3')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderScreen();
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
  });

  it('filters when query in URL', () => {
    renderScreen('/ayuda?q=BO3');
    expect(screen.queryByText('Guias de uso')).not.toBeInTheDocument();
    expect(screen.getByText('Series BO3')).toBeInTheDocument();
  });

  it('keeps the input and results in sync when the query string changes', async () => {
    renderSearchNavigation();

    expect(screen.getByDisplayValue('BO3')).toBeInTheDocument();
    expect(screen.getByText('Series BO3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /cambiar busqueda/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('equipo')).toBeInTheDocument();
      expect(screen.getByText('Crear equipo')).toBeInTheDocument();
    });
  });
});
