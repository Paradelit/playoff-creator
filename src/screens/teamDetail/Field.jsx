import React from 'react';

/**
 * Wrapper genérico de campo de formulario: label + control + error inline.
 * Usado en los modales de TeamDetailScreen.
 */
export default function Field({ label, htmlFor, error, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
