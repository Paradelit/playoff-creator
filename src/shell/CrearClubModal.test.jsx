import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrearClubModal } from './CrearClubModal';

const mockCreateClub = vi.fn();
vi.mock('../services/membersService', () => ({
  createMembersService: () => ({ createClub: (...a) => mockCreateClub(...a) }),
}));
vi.mock('../contexts/FirebaseContext', () => ({ useFirebase: () => ({ app: {} }) }));
vi.mock('../contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ setActiveWorkspace: vi.fn() }),
}));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

describe('CrearClubModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClub.mockResolvedValue({ wsId: 'ws-new' });
  });

  it('disables submit when name empty', () => {
    render(<CrearClubModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /^crear$/i })).toBeDisabled();
  });

  it('submits with trimmed name and closes', async () => {
    const onClose = vi.fn();
    render(<CrearClubModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: '  Uros de Rivas  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^crear$/i }));
    await waitFor(() => expect(mockCreateClub).toHaveBeenCalledWith({ name: 'Uros de Rivas' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows error message on permission-denied', async () => {
    mockCreateClub.mockRejectedValueOnce({
      code: 'functions/permission-denied',
      message: 'no allowlist',
    });
    render(<CrearClubModal onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /^crear$/i }));
    await waitFor(() => expect(screen.getByText(/no.*disponible/i)).toBeInTheDocument());
  });
});
