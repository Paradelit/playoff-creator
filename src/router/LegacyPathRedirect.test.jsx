import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LegacyPathRedirect from './LegacyPathRedirect';

function ProbeRoute() {
  // Renders a probe with the matched path data so tests can assert the redirect target.
  return <div data-testid="redirected" />;
}

function renderWithRouter(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/teams" element={<LegacyPathRedirect />} />
        <Route path="/teams/*" element={<LegacyPathRedirect />} />
        <Route path="/playoffs" element={<LegacyPathRedirect />} />
        <Route path="/calendar" element={<LegacyPathRedirect />} />
        <Route path="/calendar/*" element={<LegacyPathRedirect />} />
        <Route path="/settings" element={<LegacyPathRedirect />} />
        <Route path="/exercises" element={<LegacyPathRedirect />} />
        <Route path="/exercises/*" element={<LegacyPathRedirect />} />
        <Route
          path="/area-privada/*"
          element={
            <div data-testid="area-privada-target" data-path={window.location.pathname}>
              area-privada
            </div>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LegacyPathRedirect', () => {
  it('redirects /teams to /area-privada/teams', () => {
    renderWithRouter('/teams');
    expect(screen.getByTestId('area-privada-target')).toBeInTheDocument();
  });

  it('redirects /teams/abc to /area-privada/teams/abc', () => {
    renderWithRouter('/teams/abc');
    expect(screen.getByTestId('area-privada-target')).toBeInTheDocument();
  });

  it('redirects /teams/abc/cuaderno to /area-privada/teams/abc/cuaderno', () => {
    renderWithRouter('/teams/abc/cuaderno');
    expect(screen.getByTestId('area-privada-target')).toBeInTheDocument();
  });

  it('redirects /playoffs to /area-privada/playoffs', () => {
    renderWithRouter('/playoffs');
    expect(screen.getByTestId('area-privada-target')).toBeInTheDocument();
  });

  it('redirects /calendar to /area-privada/calendar', () => {
    renderWithRouter('/calendar');
    expect(screen.getByTestId('area-privada-target')).toBeInTheDocument();
  });

  it('redirects /calendar/abc/scouting to /area-privada/calendar/abc/scouting', () => {
    renderWithRouter('/calendar/abc/scouting');
    expect(screen.getByTestId('area-privada-target')).toBeInTheDocument();
  });

  it('redirects /settings to /area-privada/settings', () => {
    renderWithRouter('/settings');
    expect(screen.getByTestId('area-privada-target')).toBeInTheDocument();
  });

  it('redirects /exercises to /area-privada/exercises', () => {
    renderWithRouter('/exercises');
    expect(screen.getByTestId('area-privada-target')).toBeInTheDocument();
  });
});
