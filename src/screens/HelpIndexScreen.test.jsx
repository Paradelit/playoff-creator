import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
      summary: 'Cómo funciona BO3',
      body: '',
      tags: ['bo3'],
      updatedAt: '2026-04-25',
    },
  ],
  HELP_CATEGORIES: {
    'app-usage': { label: 'Guías de uso', description: 'Cómo usar la app', order: 1 },
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

describe('HelpIndexScreen', () => {
  it('renders categories with their articles when no query', () => {
    renderScreen();
    expect(screen.getByText('Guías de uso')).toBeInTheDocument();
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
    // Search results show only matches; categories panel hidden.
    expect(screen.queryByText('Guías de uso')).not.toBeInTheDocument();
    expect(screen.getByText('Series BO3')).toBeInTheDocument();
  });
});
