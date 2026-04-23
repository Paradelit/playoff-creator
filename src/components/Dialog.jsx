import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Selector para elementos naturalmente focusables.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    // Descartar elementos ocultos (display:none / visibility:hidden / 0px)
    if (el.offsetParent === null && el !== document.body) return false;
    return true;
  });
}

/**
 * Diálogo modal accesible reutilizable.
 *
 * Cumple WCAG 2.1 AA:
 *  - role="dialog" + aria-modal="true"
 *  - aria-labelledby (por id del título) o aria-label como fallback
 *  - aria-describedby opcional (id del texto descriptivo)
 *  - Escape cierra
 *  - Click en backdrop cierra (opcional)
 *  - Focus trap: Tab/Shift+Tab ciclan dentro del panel
 *  - Foco inicial en el primer focusable o el ref indicado
 *  - Devuelve el foco al elemento disparador al cerrar
 *  - Bloquea scroll del body mientras está abierto
 *  - Renderizado vía portal para evitar problemas con ancestros
 */
export default function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  ariaLabel,
  initialFocus,
  closeOnBackdrop = true,
  closeOnEscape = true,
  panelClassName = 'bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-slide-up',
  backdropClassName = 'fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm',
  children,
}) {
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // Foco inicial al abrir + restauración al cerrar.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const t = setTimeout(() => {
      if (initialFocus?.current && typeof initialFocus.current.focus === 'function') {
        initialFocus.current.focus();
        return;
      }
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusable(panel);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    }, 0);

    return () => {
      clearTimeout(t);
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev) && typeof prev.focus === 'function') {
        prev.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [open, initialFocus]);

  // Escape + focus trap con Tab.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, onClose, closeOnEscape]);

  // Bloqueo de scroll mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose?.();
  };

  const ariaProps = labelledBy ? { 'aria-labelledby': labelledBy } : ariaLabel ? { 'aria-label': ariaLabel } : {};

  return createPortal(
    <div className={backdropClassName} onClick={handleBackdropClick}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...ariaProps}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`${panelClassName} outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
