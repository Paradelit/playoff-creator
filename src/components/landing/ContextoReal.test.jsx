import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicThemeProvider } from '../../contexts/PublicThemeContext';
import ContextoReal from './ContextoReal';

function renderContextoReal() {
  return render(
    <PublicThemeProvider>
      <ContextoReal />
    </PublicThemeProvider>,
  );
}

describe('ContextoReal', () => {
  it('shows the ordered SSR fallback with all synthetic sessions', () => {
    renderContextoReal();

    expect(screen.getByText(/tu fin de semana, ordenado en 5 segundos/i)).toBeInTheDocument();
    expect(screen.getByText(/dos partidos, un entreno de tiro y un playoff/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('contexto-session-chip')).toHaveLength(4);
  });
});
