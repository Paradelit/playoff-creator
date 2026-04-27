// src/components/help/HelpArticleCard.test.jsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HelpArticleCard from './HelpArticleCard';

const ARTICLE = {
  id: 'app-create-team',
  slug: 'como-crear-equipo',
  category: 'app-usage',
  title: 'Cómo crear un equipo',
  summary: 'Aprende a crear tu primer equipo paso a paso desde la pantalla de Equipos.',
  body: '...',
  updatedAt: '2026-04-25',
};

describe('HelpArticleCard', () => {
  it('renders title, summary and link', () => {
    render(
      <MemoryRouter>
        <HelpArticleCard article={ARTICLE} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ayuda/como-crear-equipo');
    expect(screen.getByText('Cómo crear un equipo')).toBeInTheDocument();
    expect(screen.getByText(/aprende a crear/i)).toBeInTheDocument();
  });
});
