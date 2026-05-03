import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConvocatoriasTab from './ConvocatoriasTab';

vi.mock('../../contexts/FirebaseContext', () => ({ useFirebase: () => ({ db: {}, appId: 'a1' }) }));
vi.mock('../../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWsId: 'ws1' }) }));
vi.mock('../../services/teamsService', () => ({ saveTeam: vi.fn() }));
vi.mock('../../contexts/PickProvider', () => ({ usePick: () => ({ sendMessage: vi.fn() }) }));

describe('ConvocatoriasTab', () => {
  it('renders all four sections', () => {
    const team = {
      id: 't1',
      plantillaConvocatoria: '',
      citaOffsetMinutos: 45,
      convocatoriaReminderHours: 72,
      pabellones: [],
    };
    render(<ConvocatoriasTab team={team} />);
    expect(screen.getByRole('heading', { name: /Plantilla del mensaje/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Hora de cita/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Recordatorio/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pabellones/i })).toBeInTheDocument();
  });
});
