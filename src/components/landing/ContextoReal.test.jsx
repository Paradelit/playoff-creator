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

    expect(screen.getByText(/tu fin de semana en 5 segundos/i)).toBeInTheDocument();
    expect(screen.getByText(/47 sesiones\. 10 equipos\. 3 pistas\./i)).toBeInTheDocument();
    expect(screen.getAllByTestId('contexto-session-chip')).toHaveLength(47);
  });
});
