import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConvocatoriaModal from './ConvocatoriaModal';

vi.mock('../../contexts/FirebaseContext', () => ({ useFirebase: () => ({ db: {}, appId: 'a1' }) }));
vi.mock('../../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWsId: 'ws1' }) }));
vi.mock('../../services/calendarService', () => ({ saveCalendarSession: vi.fn() }));
vi.mock('../../services/playoffConvocatoriasService', () => ({ savePlayoffConvocatoria: vi.fn() }));

const team = { id: 't1', citaOffsetMinutos: 45 };
const session = {
  id: 's1',
  tipo: 'partido',
  fecha: '2026-04-30',
  horaInicio: '18:30',
  rival: 'Saltium',
  lugar: 'Pabellon',
  esLocal: true,
  competitionId: null,
  teamId: 't1',
};

describe('ConvocatoriaModal', () => {
  it('renders rendered message with copy and share buttons', () => {
    render(<ConvocatoriaModal session={session} team={team} competition={null} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Copiar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WhatsApp/i })).toBeInTheDocument();
  });

  it('updates preview when notaExtra changes', () => {
    render(<ConvocatoriaModal session={session} team={team} competition={null} onClose={() => {}} />);
    const notaInput = screen.getByPlaceholderText(/Nota extra/i);
    fireEvent.change(notaInput, { target: { value: 'Llevar dos equipaciones' } });
    // The message textarea should now contain the nota
    const textareas = document.querySelectorAll('textarea');
    const msgTextarea = textareas[0];
    expect(msgTextarea.value).toContain('Llevar dos equipaciones');
  });
});
