import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportMenu from './ExportMenu';

describe('ExportMenu', () => {
  it('renders the trigger button labelled "Exportar"', () => {
    render(<ExportMenu items={[{ key: 'pdf', label: 'PDF', onClick: vi.fn() }]} />);
    expect(screen.getByRole('button', { name: /exportar/i })).toBeInTheDocument();
  });

  it('opens the menu on click and shows items', () => {
    const onClick = vi.fn();
    render(<ExportMenu items={[{ key: 'pdf', label: 'PDF', onClick }]} />);
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
    expect(screen.getByRole('menuitem', { name: /pdf/i })).toBeInTheDocument();
  });

  it('calls onClick and closes the menu when an item is clicked', () => {
    const onClick = vi.fn();
    render(<ExportMenu items={[{ key: 'pdf', label: 'PDF', onClick }]} />);
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /pdf/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<ExportMenu items={[{ key: 'pdf', label: 'PDF', onClick: vi.fn() }]} />);
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('shows save status badge when status prop is provided', () => {
    render(<ExportMenu status="saving" items={[{ key: 'pdf', label: 'PDF', onClick: vi.fn() }]} />);
    expect(screen.getByText(/guardando/i)).toBeInTheDocument();
  });
});
