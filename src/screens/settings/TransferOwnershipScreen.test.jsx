import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransferOwnershipScreen } from './TransferOwnershipScreen';

vi.mock('../../contexts/WorkspaceContext', () => ({ useWorkspace: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/FirebaseContext', () => ({ useFirebase: () => ({ app: {} }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../../hooks/useMembers', () => ({ useMembers: vi.fn() }));
const mockTransfer = vi.fn();
vi.mock('../../services/membersService', () => ({
  createMembersService: () => ({ transferOwnership: (...a) => mockTransfer(...a) }),
}));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMembers } from '../../hooks/useMembers';

function setupAsOwner() {
  useWorkspace.mockReturnValue({
    activeWsId: 'ws-club',
    activeWorkspace: { wsId: 'ws-club', type: 'club', name: 'Uros', ownerId: 'uid-owner' },
  });
  useAuth.mockReturnValue({ user: { uid: 'uid-owner' } });
  useMembers.mockReturnValue({
    members: [
      { uid: 'uid-owner', displayName: 'Sergio' },
      { uid: 'uid-other', displayName: 'María' },
    ],
    loading: false,
  });
}

describe('TransferOwnershipScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submit disabled until typing club name exactly', () => {
    setupAsOwner();
    render(<TransferOwnershipScreen />);
    fireEvent.click(screen.getByLabelText(/maría/i));
    const input = screen.getByPlaceholderText('Uros');
    fireEvent.change(input, { target: { value: 'Uros wrong' } });
    expect(screen.getByRole('button', { name: /transferir/i })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Uros' } });
    expect(screen.getByRole('button', { name: /transferir/i })).toBeEnabled();
  });

  it('submit calls transferOwnership', async () => {
    setupAsOwner();
    mockTransfer.mockResolvedValue({ ok: true });
    render(<TransferOwnershipScreen />);
    fireEvent.click(screen.getByLabelText(/maría/i));
    fireEvent.change(screen.getByPlaceholderText('Uros'), { target: { value: 'Uros' } });
    fireEvent.click(screen.getByRole('button', { name: /transferir/i }));
    await waitFor(() => expect(mockTransfer).toHaveBeenCalledWith({ wsId: 'ws-club', newOwnerUid: 'uid-other' }));
  });

  it('non-owner sees redirect notice (renders nothing actionable)', () => {
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-club',
      activeWorkspace: { wsId: 'ws-club', type: 'club', name: 'Uros', ownerId: 'uid-other' },
    });
    useAuth.mockReturnValue({ user: { uid: 'uid-not-owner' } });
    useMembers.mockReturnValue({ members: [], loading: false });
    render(<TransferOwnershipScreen />);
    expect(screen.queryByRole('button', { name: /transferir/i })).not.toBeInTheDocument();
  });
});
