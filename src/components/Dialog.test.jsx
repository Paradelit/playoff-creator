/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Dialog from './Dialog';
import { expectNoA11yViolations } from '../test/a11y';

function Harness({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Diálogo de prueba">
      <h2 id="t">Título</h2>
      <button>Primero</button>
      <button>Segundo</button>
      <button onClick={onClose}>Cerrar</button>
    </Dialog>
  );
}

describe('Dialog', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('no renderiza nada cuando open=false', () => {
    const { container } = render(<Harness open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('expone role="dialog" y aria-modal="true"', () => {
    render(<Harness open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Diálogo de prueba');
  });

  it('cierra al pulsar Escape', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cierra al hacer click en el backdrop por defecto', () => {
    const onClose = vi.fn();
    const { container } = render(<Harness open onClose={onClose} />);
    const backdrop = container.ownerDocument.body.querySelector('.fixed.inset-0');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('NO cierra al hacer click dentro del panel', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    fireEvent.click(screen.getByText('Primero'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('bloquea scroll del body mientras está abierto', () => {
    const { rerender } = render(<Harness open onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Harness open={false} onClose={() => {}} />);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('no reporta violaciones axe', async () => {
    render(<Harness open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    await expectNoA11yViolations(dialog);
  });
});
