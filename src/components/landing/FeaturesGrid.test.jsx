import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicThemeProvider } from '../../contexts/PublicThemeContext';
import FeaturesGrid, { FEATURES } from './FeaturesGrid';

function renderGrid() {
  return render(
    <PublicThemeProvider>
      <FeaturesGrid />
    </PublicThemeProvider>,
  );
}

describe('FeaturesGrid', () => {
  it('renders the six landing features', () => {
    renderGrid();

    FEATURES.forEach((feature) => {
      expect(screen.getByText(feature.title)).toBeInTheDocument();
    });
  });

  it('renders one micro-scene per feature card', () => {
    renderGrid();

    ['scene-pick', 'scene-playoffs', 'scene-calendar', 'scene-notebook', 'scene-library', 'scene-scouting'].forEach(
      (testId) => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      },
    );
  });
});
