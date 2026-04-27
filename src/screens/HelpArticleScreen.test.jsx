import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import HelpArticleScreen from './HelpArticleScreen';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

vi.mock('../content/helpArticles', () => ({
  HELP_ARTICLES: [
    {
      id: 'a1',
      slug: 'crear-equipo',
      category: 'app-usage',
      title: 'Crear equipo',
      summary: 'Crea tu equipo.',
      body: '## Pasos\n\n1. Abrir Equipos\n2. Pulsar Nuevo equipo',
      updatedAt: '2026-04-25',
    },
    {
      id: 'a2',
      slug: 'otra-cosa',
      category: 'app-usage',
      title: 'Otra cosa',
      summary: 'Otra cosa.',
      body: 'Body.',
      updatedAt: '2026-04-25',
    },
  ],
  HELP_CATEGORIES: {
    'app-usage': { label: 'Guías de uso', description: 'Cómo usar la app', order: 1 },
  },
}));

function renderAt(slug) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/ayuda/${slug}`]}>
        <Routes>
          <Route path="/ayuda/:slug" element={<HelpArticleScreen />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('HelpArticleScreen', () => {
  it('renders title and breadcrumb', () => {
    renderAt('crear-equipo');
    expect(screen.getByRole('heading', { level: 1, name: 'Crear equipo' })).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(breadcrumb).getByText(/centro de ayuda/i)).toBeInTheDocument();
    expect(within(breadcrumb).getByText(/guías de uso/i)).toBeInTheDocument();
  });

  it('renders markdown body', () => {
    renderAt('crear-equipo');
    expect(screen.getByRole('heading', { level: 2, name: /pasos/i })).toBeInTheDocument();
    expect(screen.getByText(/abrir equipos/i)).toBeInTheDocument();
  });

  it('shows related articles from same category', () => {
    renderAt('crear-equipo');
    expect(screen.getByText('Otra cosa')).toBeInTheDocument();
  });

  it('shows CTA to /login when not authenticated', () => {
    renderAt('crear-equipo');
    expect(screen.getByRole('link', { name: /pregúntale a pick/i })).toHaveAttribute('href', '/login');
  });

  it('renders 404-ish state for unknown slug', () => {
    renderAt('does-not-exist');
    expect(screen.getByText(/no encontramos/i)).toBeInTheDocument();
  });
});
