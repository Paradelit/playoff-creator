/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentFailedBanner } from './PaymentFailedBanner';
import { expectNoA11yViolations } from '../../test/a11y';

vi.mock('../../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ appId: 'test-app' }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../contexts/WorkspaceContext', () => ({
  useWorkspace: vi.fn(),
}));
vi.mock('../useWorkspacePlan', () => ({
  useWorkspacePlan: vi.fn(),
}));
vi.mock('../../services/functionsClient', () => ({
  getRegionalFunctions: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';

describe('PaymentFailedBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza nada cuando billing.status no es past_due', () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-1' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-1' },
    });
    useWorkspacePlan.mockReturnValue({ isPro: true, isPastDue: false });

    const { container } = render(<PaymentFailedBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('owner ve el alert + botón "Actualizar tarjeta"', async () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-1' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-1' },
    });
    useWorkspacePlan.mockReturnValue({ isPro: true, isPastDue: true });

    const { container } = render(<PaymentFailedBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Actualizar tarjeta/i })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('non-owner ve el alert con copy distinto y sin botón', async () => {
    useAuth.mockReturnValue({ user: { uid: 'uid-2' } });
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-1',
      activeWorkspace: { ownerId: 'uid-1' },
    });
    useWorkspacePlan.mockReturnValue({ isPro: true, isPastDue: true });

    const { container } = render(<PaymentFailedBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Avisa a quien gestiona el plan/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
