import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DayView from './DayView';

function makeSession(overrides = {}) {
  return {
    id: 'sess-1',
    teamId: 'team-a',
    teamName: 'Equipo A',
    tipo: 'entrenamiento',
    fecha: '2026-04-18',
    horaInicio: '09:00',
    horaFin: '10:30',
    lugar: 'Pabellón',
    ...overrides,
  };
}

describe('DayView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a loading spinner while loading', () => {
    const { container } = render(
      <DayView sessions={[]} loading currentDate={new Date(2026, 3, 18)} onSelectSession={() => {}} />,
    );
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders hour labels across the fallback range when no sessions exist', () => {
    render(<DayView sessions={[]} loading={false} currentDate={new Date(2026, 3, 18)} onSelectSession={() => {}} />);
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('22:00')).toBeInTheDocument();
    expect(screen.getByText('No hay sesiones este día')).toBeInTheDocument();
  });

  it('renders session block with its time range', () => {
    render(
      <DayView
        sessions={[makeSession()]}
        loading={false}
        currentDate={new Date(2026, 3, 18)}
        onSelectSession={() => {}}
        getTrainingNum={() => 5}
      />,
    );
    expect(screen.getByText('09:00–10:30')).toBeInTheDocument();
    expect(screen.getByText('Entrenamiento #5')).toBeInTheDocument();
  });

  it('shows a "now" marker when viewing today', () => {
    vi.setSystemTime(new Date(2026, 3, 18, 10, 0));
    render(
      <DayView
        sessions={[makeSession()]}
        loading={false}
        currentDate={new Date(2026, 3, 18)}
        onSelectSession={() => {}}
        getTrainingNum={() => 1}
      />,
    );
    expect(screen.getByTestId('now-line')).toBeInTheDocument();
  });

  it('does not show the "now" marker when viewing a different day', () => {
    vi.setSystemTime(new Date(2026, 3, 18, 10, 0));
    render(
      <DayView
        sessions={[makeSession({ fecha: '2026-04-19' })]}
        loading={false}
        currentDate={new Date(2026, 3, 19)}
        onSelectSession={() => {}}
        getTrainingNum={() => 1}
      />,
    );
    expect(screen.queryByTestId('now-line')).toBeNull();
  });

  it('shows a gap badge between sessions separated by ≥ 30 min', () => {
    render(
      <DayView
        sessions={[
          makeSession({ id: 'a', horaInicio: '09:00', horaFin: '10:00' }),
          makeSession({ id: 'b', horaInicio: '11:30', horaFin: '12:30' }),
        ]}
        loading={false}
        currentDate={new Date(2026, 3, 18)}
        onSelectSession={() => {}}
        getTrainingNum={() => 1}
      />,
    );
    expect(screen.getByText(/hueco 1h30m/i)).toBeInTheDocument();
  });

  it('shows a "Solape" badge when two sessions overlap in time', () => {
    render(
      <DayView
        sessions={[
          makeSession({ id: 'a', horaInicio: '09:00', horaFin: '10:30' }),
          makeSession({ id: 'b', horaInicio: '10:00', horaFin: '11:00' }),
        ]}
        loading={false}
        currentDate={new Date(2026, 3, 18)}
        onSelectSession={() => {}}
        getTrainingNum={() => 1}
      />,
    );
    expect(screen.getByText('Solape')).toBeInTheDocument();
  });

  it('puts sessions without horaInicio in the "Sin hora" list', () => {
    render(
      <DayView
        sessions={[makeSession({ horaInicio: '', horaFin: '' })]}
        loading={false}
        currentDate={new Date(2026, 3, 18)}
        onSelectSession={() => {}}
        getTrainingNum={() => 1}
      />,
    );
    expect(screen.getByText('Sin hora')).toBeInTheDocument();
  });
});
