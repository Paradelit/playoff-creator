/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/WorkspaceContext', () => ({ useWorkspace: vi.fn() }));
vi.mock('../eventBus', () => ({
  eventBus: {
    on: vi.fn(),
    emit: vi.fn(),
  },
}));

import { QuotaExceededModal } from './QuotaExceededModal';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { eventBus } from '../eventBus';

function renderModal() {
  return render(
    <MemoryRouter>
      <QuotaExceededModal />
    </MemoryRouter>,
  );
}

function triggerQuotaExceeded(details = { count: 51, limit: 50, monthId: '2026-05' }) {
  // Capturar el handler que se registró en useEffect → eventBus.on
  const handler = eventBus.on.mock.calls[0][1];
  act(() => {
    handler(details);
  });
}

describe('QuotaExceededModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('personal owner ve CTA "Hazte Pro"', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-1' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-1', type: 'personal' },
    });
    renderModal();
    triggerQuotaExceeded();
    expect(screen.getByRole('button', { name: /Hazte Pro/i })).toBeInTheDocument();
  });

  it('club owner (DT) ve CTA "Activa Pro Club"', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-dt' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-dt', type: 'club' },
    });
    renderModal();
    triggerQuotaExceeded();
    expect(screen.getByRole('button', { name: /Activa Pro Club/i })).toBeInTheDocument();
  });

  it('club coach (non-owner) NO ve CTA, solo "Avisa al DT" en body', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-coach' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-dt', type: 'club' },
    });
    renderModal();
    triggerQuotaExceeded();
    expect(screen.queryByRole('button', { name: /Activa Pro Club/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hazte Pro/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Avisa al DT/i)).toBeInTheDocument();
    // El botón "Vuelvo el día 1" debe seguir disponible
    expect(screen.getByRole('button', { name: /Vuelvo el día 1/i })).toBeInTheDocument();
  });
});
