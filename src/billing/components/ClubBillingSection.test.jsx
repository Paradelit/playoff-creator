/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClubBillingSection } from './ClubBillingSection';

vi.mock('../../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ appId: 'test-app' }),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/WorkspaceContext', () => ({ useWorkspace: vi.fn() }));
vi.mock('../useWorkspacePlan', () => ({ useWorkspacePlan: vi.fn() }));
vi.mock('../../services/functionsClient', () => ({ getRegionalFunctions: vi.fn() }));

import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ClubBillingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza nada si el caller no es el ownerId', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-coach' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-dt', type: 'club' },
    });
    useWorkspacePlan.mockReturnValue({ plan: 'free', billing: null, loading: false });

    const { container } = renderWithRouter(<ClubBillingSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('owner en club free ve CTA "Activar Pro Club" linkeado a /upgrade/club', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-dt' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-dt', type: 'club' },
    });
    useWorkspacePlan.mockReturnValue({ plan: 'free', billing: null, loading: false });

    renderWithRouter(<ClubBillingSection />);
    const cta = screen.getByRole('link', { name: /Activar Pro Club/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/upgrade/club');
  });

  it('owner en club Pro ve seatCount + botón "Gestionar suscripción"', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-dt' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-dt', type: 'club' },
    });
    useWorkspacePlan.mockReturnValue({
      plan: 'pro',
      billing: { status: 'active', cancelAtPeriodEnd: false, tier: 'b2b' },
      seatCount: 12,
      loading: false,
      cancelAtPeriodEnd: false,
    });

    renderWithRouter(<ClubBillingSection />);
    expect(screen.getByText(/Pro Club/)).toBeInTheDocument();
    expect(screen.getByText(/12 asientos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gestionar suscripción/i })).toBeInTheDocument();
  });

  it('owner ve aviso past_due cuando billing.status="past_due"', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-dt' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-dt', type: 'club' },
    });
    useWorkspacePlan.mockReturnValue({
      plan: 'pro',
      billing: { status: 'past_due', cancelAtPeriodEnd: false, tier: 'b2b' },
      seatCount: 5,
      loading: false,
      cancelAtPeriodEnd: false,
    });

    renderWithRouter(<ClubBillingSection />);
    expect(screen.getByText(/El pago ha fallado/i)).toBeInTheDocument();
  });

  it('usa singular para seatCount=1', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-dt' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-dt', type: 'club' },
    });
    useWorkspacePlan.mockReturnValue({
      plan: 'pro',
      billing: { status: 'active', tier: 'b2b' },
      seatCount: 1,
      loading: false,
      cancelAtPeriodEnd: false,
    });

    renderWithRouter(<ClubBillingSection />);
    expect(screen.getByText(/1 asiento /)).toBeInTheDocument();
  });
});
