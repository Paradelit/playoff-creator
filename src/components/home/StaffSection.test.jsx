import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StaffSection from './StaffSection';

const MEMBERS = [
  { uid: 'uid-coach', displayName: 'Pepe', email: 'p@x', role: 'coach', assignedTeamIds: ['t1'] },
  { uid: 'uid-owner', displayName: 'Sergio', email: 's@x', role: 'dt', assignedTeamIds: ['t1', 't2'] },
  { uid: 'uid-dt', displayName: 'María', email: 'm@x', role: 'dt', assignedTeamIds: ['t1'] },
];

describe('StaffSection', () => {
  it('renders nothing when no members', () => {
    const { container } = render(<StaffSection members={[]} currentUid="uid-x" ownerUid="uid-y" navigate={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('orders owner first, then DT, then coach', () => {
    render(<StaffSection members={MEMBERS} currentUid="uid-owner" ownerUid="uid-owner" navigate={vi.fn()} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Sergio');
    expect(items[0]).toHaveTextContent('Propietario');
    expect(items[1]).toHaveTextContent('María');
    expect(items[1]).toHaveTextContent('DT');
    expect(items[2]).toHaveTextContent('Pepe');
    expect(items[2]).toHaveTextContent('Coach');
  });

  it('marks the caller row with "tú"', () => {
    render(<StaffSection members={MEMBERS} currentUid="uid-dt" ownerUid="uid-owner" navigate={vi.fn()} />);
    const mariaRow = screen.getAllByRole('listitem').find((li) => li.textContent.includes('María'));
    expect(mariaRow).toHaveTextContent('· tú');
  });

  it('renders team count in singular/plural', () => {
    render(<StaffSection members={MEMBERS} currentUid="uid-x" ownerUid="uid-owner" navigate={vi.fn()} />);
    const sergioRow = screen.getAllByRole('listitem').find((li) => li.textContent.includes('Sergio'));
    const mariaRow = screen.getAllByRole('listitem').find((li) => li.textContent.includes('María'));
    expect(sergioRow).toHaveTextContent('2 equipos');
    expect(mariaRow).toHaveTextContent('1 equipo');
    expect(mariaRow).not.toHaveTextContent('1 equipos');
  });

  it('"Gestionar →" navigates to /area-privada/settings/miembros', () => {
    const navigate = vi.fn();
    render(<StaffSection members={MEMBERS} currentUid="uid-x" ownerUid="uid-owner" navigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: /gestionar/i }));
    expect(navigate).toHaveBeenCalledWith('/area-privada/settings/miembros');
  });
});
