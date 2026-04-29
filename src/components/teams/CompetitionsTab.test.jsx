import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompetitionsTab from './CompetitionsTab';

vi.mock('../../hooks/useCompetitions', () => ({
  useCompetitions: () => ({ competitions: [], loading: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));

vi.mock('../../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: {}, appId: 'app1' }),
}));

describe('CompetitionsTab', () => {
  it('shows empty state when no competitions', () => {
    render(<CompetitionsTab teamId="t1" />);
    expect(screen.getByText(/Sin competiciones/i)).toBeInTheDocument();
  });

  it('shows add button', () => {
    render(<CompetitionsTab teamId="t1" />);
    expect(screen.getByRole('button', { name: /Añadir competición/i })).toBeInTheDocument();
  });
});
