import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InviteLandingScreen } from './InviteLandingScreen';

vi.mock('../hooks/useAcceptInvite', () => ({ useAcceptInvite: vi.fn() }));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ wsId: 'ws-1', inviteId: 'inv-1' }),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { useAcceptInvite } from '../hooks/useAcceptInvite';

function r() {
  render(<InviteLandingScreen />);
}

describe('InviteLandingScreen', () => {
  it('loading', () => {
    useAcceptInvite.mockReturnValue({ status: 'loading' });
    r();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('needsAuth → CTA registro/login', () => {
    useAcceptInvite.mockReturnValue({ status: 'needsAuth', workspaceName: 'Uros' });
    r();
    expect(screen.getByRole('link', { name: /iniciar sesión|registrar/i })).toBeInTheDocument();
  });

  it('success', () => {
    useAcceptInvite.mockReturnValue({
      status: 'success',
      workspaceName: 'Uros',
      mismatched: false,
      claimedWsId: 'ws-1',
    });
    r();
    expect(screen.getByText(/bienvenido.*uros/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entrar al workspace/i })).toBeInTheDocument();
  });

  it('success with email mismatch shows hint', () => {
    useAcceptInvite.mockReturnValue({
      status: 'success',
      workspaceName: 'Uros',
      mismatched: true,
      claimedWsId: 'ws-1',
    });
    r();
    expect(screen.getByText(/destinad/i)).toBeInTheDocument();
  });

  it('notFound', () => {
    useAcceptInvite.mockReturnValue({ status: 'notFound' });
    r();
    expect(screen.getByText(/ya no es válid/i)).toBeInTheDocument();
  });

  it('expired', () => {
    useAcceptInvite.mockReturnValue({ status: 'expired' });
    r();
    expect(screen.getByText(/caducad/i)).toBeInTheDocument();
  });
});
