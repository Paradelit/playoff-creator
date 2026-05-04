import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MembersScreen } from './MembersScreen';

vi.mock('../../contexts/WorkspaceContext', () => ({ useWorkspace: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/FirebaseContext', () => ({ useFirebase: () => ({ app: {} }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('../../hooks/useMembers', () => ({ useMembers: vi.fn() }));
vi.mock('../../hooks/useInvites', () => ({ useInvites: vi.fn() }));
vi.mock('../../hooks/useTeams', () => ({
  // teamDisplayName espera el shape canónico (categoria + letra), no `name`.
  useTeams: vi.fn(() => ({ teams: [{ id: 't1', categoria: 'Cadete', letra: 'A' }], loading: false })),
}));

const mockSvc = {
  inviteMember: vi.fn(),
  revokeInvite: vi.fn(),
  revokeMember: vi.fn(),
  setMemberTeams: vi.fn(),
  setMemberRole: vi.fn(),
};
vi.mock('../../services/membersService', () => ({ createMembersService: () => mockSvc }));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));

import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMembers } from '../../hooks/useMembers';
import { useInvites } from '../../hooks/useInvites';

const CLUB_WS = { wsId: 'ws-club', type: 'club', name: 'Uros', ownerId: 'uid-owner' };

function setupAs(role) {
  const callerUid = role === 'owner' ? 'uid-owner' : role === 'dt' ? 'uid-dt' : 'uid-coach';
  useWorkspace.mockReturnValue({ activeWsId: 'ws-club', activeWorkspace: CLUB_WS });
  useAuth.mockReturnValue({ user: { uid: callerUid } });
  useMembers.mockReturnValue({
    members: [
      { uid: 'uid-owner', role: 'dt', displayName: 'Sergio', email: 's@x', assignedTeamIds: ['t1'] },
      { uid: 'uid-dt', role: 'dt', displayName: 'María', email: 'm@x', assignedTeamIds: ['t1'] },
      { uid: 'uid-coach', role: 'coach', displayName: 'Pepe', email: 'p@x', assignedTeamIds: ['t1'] },
    ],
    loading: false,
  });
  useInvites.mockReturnValue({
    invites: [
      {
        id: 'inv-1',
        inviteEmail: 'nuevo@x',
        inviteName: 'Nuevo',
        role: 'coach',
        assignedTeamIds: ['t1'],
        expiresAt: { toDate: () => new Date(Date.now() + 86_400_000 * 3) },
      },
    ],
    loading: false,
  });
}

describe('MembersScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders owner+DT+coach with badges', () => {
    setupAs('owner');
    render(<MembersScreen />);
    expect(screen.getByText('Sergio')).toBeInTheDocument();
    expect(screen.getByText('María')).toBeInTheDocument();
    expect(screen.getByText('Pepe')).toBeInTheDocument();
    expect(screen.getByText(/propietario/i)).toBeInTheDocument();
  });

  it('owner sees actions on every row including own (self-edit teams)', () => {
    setupAs('owner');
    render(<MembersScreen />);
    // Owner + DT + coach = 3 menus. Owner puede editar su propia fila para
    // auto-asignarse equipos (callable setMemberTeams permite owner self-edit).
    expect(screen.getAllByRole('button', { name: /acciones/i })).toHaveLength(3);
  });

  it('coach sees read-only (no action menus)', () => {
    setupAs('coach');
    render(<MembersScreen />);
    expect(screen.queryAllByRole('button', { name: /acciones/i })).toHaveLength(0);
  });

  it('opens invite modal and submits', async () => {
    setupAs('owner');
    mockSvc.inviteMember.mockResolvedValue({ inviteId: 'inv-X', link: 'https://app.com/invite/ws-club/inv-X' });
    render(<MembersScreen />);
    fireEvent.click(screen.getByRole('button', { name: /invitar/i }));
    fireEvent.click(screen.getByRole('radio', { name: /coach/i }));
    fireEvent.click(screen.getByLabelText(/cadete a/i));
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() =>
      expect(mockSvc.inviteMember).toHaveBeenCalledWith(
        expect.objectContaining({
          wsId: 'ws-club',
          role: 'coach',
          assignedTeamIds: ['t1'],
        }),
      ),
    );
    expect(await screen.findByRole('button', { name: /copiar al portapapeles/i })).toBeInTheDocument();
  });

  it('cancels a pending invite', async () => {
    setupAs('owner');
    mockSvc.revokeInvite.mockResolvedValue({ ok: true });
    render(<MembersScreen />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar.*invit/i }));
    await waitFor(() => expect(mockSvc.revokeInvite).toHaveBeenCalledWith({ wsId: 'ws-club', inviteId: 'inv-1' }));
  });

  it('revokes a member after confirm', async () => {
    setupAs('owner');
    mockSvc.revokeMember.mockResolvedValue({ ok: true });
    render(<MembersScreen />);
    const menus = screen.getAllByRole('button', { name: /acciones/i });
    fireEvent.click(menus[menus.length - 1]);
    fireEvent.click(screen.getByText(/revocar acceso/i));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => expect(mockSvc.revokeMember).toHaveBeenCalledWith({ wsId: 'ws-club', memberUid: 'uid-coach' }));
  });

  it('edits assigned teams on a member', async () => {
    setupAs('owner');
    mockSvc.setMemberTeams.mockResolvedValue({ ok: true });
    render(<MembersScreen />);
    const menus = screen.getAllByRole('button', { name: /acciones/i });
    fireEvent.click(menus[menus.length - 1]);
    fireEvent.click(screen.getByText(/editar equipos/i));
    fireEvent.click(screen.getByLabelText(/cadete a/i));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() =>
      expect(mockSvc.setMemberTeams).toHaveBeenCalledWith({
        wsId: 'ws-club',
        memberUid: 'uid-coach',
        assignedTeamIds: [],
      }),
    );
  });

  it('changes member role with confirmation', async () => {
    setupAs('owner');
    mockSvc.setMemberRole.mockResolvedValue({ ok: true });
    render(<MembersScreen />);
    const menus = screen.getAllByRole('button', { name: /acciones/i });
    fireEvent.click(menus[menus.length - 1]);
    fireEvent.click(screen.getByText(/cambiar rol/i));
    fireEvent.click(screen.getByRole('radio', { name: /^dt$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() =>
      expect(mockSvc.setMemberRole).toHaveBeenCalledWith({ wsId: 'ws-club', memberUid: 'uid-coach', role: 'dt' }),
    );
  });
});
