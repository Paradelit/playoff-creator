import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClubKpiStrip from './ClubKpiStrip';

const FIXED_NOW = new Date('2026-05-04T10:00:00').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ClubKpiStrip', () => {
  it('returns null when no teams and no staff', () => {
    const { container } = render(<ClubKpiStrip teams={[]} allSessions={[]} activePlayoffs={[]} members={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 4 KPI cards', () => {
    render(
      <ClubKpiStrip
        teams={[{ id: 't1' }, { id: 't2' }]}
        allSessions={[]}
        activePlayoffs={[]}
        members={[{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }]}
      />,
    );
    expect(screen.getByText(/equipos/i)).toBeInTheDocument();
    expect(screen.getByText(/entrenos esta semana/i)).toBeInTheDocument();
    expect(screen.getByText(/partidos en 14 días/i)).toBeInTheDocument();
    expect(screen.getByText(/^staff$/i)).toBeInTheDocument();
  });

  it('counts trainings within the current week (mon-sun)', () => {
    // 2026-05-04 is a Monday. Week range: mon 2026-05-04 → sun 2026-05-10.
    const allSessions = [
      { id: 's1', tipo: 'entrenamiento', fecha: '2026-05-04' }, // dentro
      { id: 's2', tipo: 'entrenamiento', fecha: '2026-05-08' }, // dentro
      { id: 's3', tipo: 'entrenamiento', fecha: '2026-05-11' }, // fuera (siguiente semana)
      { id: 's4', tipo: 'partido', fecha: '2026-05-05' }, // partido, no entrenamiento
    ];
    render(<ClubKpiStrip teams={[{ id: 't1' }]} allSessions={allSessions} activePlayoffs={[]} members={[]} />);
    // Entrenos esta semana = 2.
    const trainingsCard = screen.getByText(/entrenos esta semana/i).closest('div').parentElement;
    expect(trainingsCard).toHaveTextContent('2');
  });

  it('counts upcoming matches within next 14 days', () => {
    const allSessions = [
      { id: 's1', tipo: 'partido', fecha: '2026-05-04' }, // hoy
      { id: 's2', tipo: 'partido', fecha: '2026-05-15' }, // dentro 14
      { id: 's3', tipo: 'partido', fecha: '2026-05-19' }, // fuera 14
      { id: 's4', tipo: 'entrenamiento', fecha: '2026-05-06' }, // no es partido
    ];
    render(<ClubKpiStrip teams={[{ id: 't1' }]} allSessions={allSessions} activePlayoffs={[]} members={[]} />);
    const matchesCard = screen.getByText(/partidos en 14 días/i).closest('div').parentElement;
    expect(matchesCard).toHaveTextContent('2');
  });
});
