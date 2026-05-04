import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceSelector } from './WorkspaceSelector';

vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: vi.fn() }));
vi.mock('../hooks/useClubAllowlist', () => ({ useClubAllowlist: vi.fn() }));
// Stub the modal so dropdown tests don't need to render its tree
vi.mock('./CrearClubModal', () => ({ CrearClubModal: () => null }));

import { useWorkspace } from '../contexts/WorkspaceContext';
import { useClubAllowlist } from '../hooks/useClubAllowlist';

describe('WorkspaceSelector', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all memberships in dropdown', () => {
    useWorkspace.mockReturnValue({
      memberships: [
        { wsId: 'ws-personal', workspaceName: 'Mi cuenta', workspaceType: 'personal' },
        { wsId: 'ws-club', workspaceName: 'Uros de Rivas', workspaceType: 'club' },
      ],
      activeWsId: 'ws-personal',
      setActiveWorkspace: vi.fn(),
    });
    useClubAllowlist.mockReturnValue({ allowed: false, loading: false });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: /mi cuenta/i }));
    expect(screen.getByText('Uros de Rivas')).toBeInTheDocument();
  });

  it('clicking another workspace calls setActiveWorkspace', () => {
    const setActive = vi.fn();
    useWorkspace.mockReturnValue({
      memberships: [
        { wsId: 'ws-personal', workspaceName: 'Mi cuenta', workspaceType: 'personal' },
        { wsId: 'ws-club', workspaceName: 'Uros', workspaceType: 'club' },
      ],
      activeWsId: 'ws-personal',
      setActiveWorkspace: setActive,
    });
    useClubAllowlist.mockReturnValue({ allowed: false, loading: false });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: /mi cuenta/i }));
    fireEvent.click(screen.getByText('Uros'));
    expect(setActive).toHaveBeenCalledWith('ws-club');
  });

  it('shows "+ Crear workspace de club" when allowlisted', () => {
    useWorkspace.mockReturnValue({
      memberships: [{ wsId: 'ws-personal', workspaceName: 'Mi cuenta', workspaceType: 'personal' }],
      activeWsId: 'ws-personal',
      setActiveWorkspace: vi.fn(),
    });
    useClubAllowlist.mockReturnValue({ allowed: true, loading: false });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: /mi cuenta/i }));
    expect(screen.getByText(/crear workspace de club/i)).toBeInTheDocument();
  });

  it('hides "+ Crear" when NOT allowlisted', () => {
    useWorkspace.mockReturnValue({
      memberships: [{ wsId: 'ws-personal', workspaceName: 'Mi cuenta', workspaceType: 'personal' }],
      activeWsId: 'ws-personal',
      setActiveWorkspace: vi.fn(),
    });
    useClubAllowlist.mockReturnValue({ allowed: false, loading: false });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: /mi cuenta/i }));
    expect(screen.queryByText(/crear workspace de club/i)).not.toBeInTheDocument();
  });
});
