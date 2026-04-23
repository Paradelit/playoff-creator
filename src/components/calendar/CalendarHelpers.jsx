import React, { useState, useId } from 'react';

export function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-slate-700 text-right break-words min-w-0">{value}</span>
    </div>
  );
}

export function FormField({ label, htmlFor, error, children, asFieldset = false }) {
  const errorId = useId();
  const describedBy = error ? errorId : undefined;

  if (asFieldset) {
    return (
      <fieldset>
        <legend className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</legend>
        {describedBy ? React.cloneElement(children, { 'aria-describedby': describedBy }) : children}
        {error && (
          <p id={errorId} className="text-xs text-red-500 mt-1" role="alert">
            {error}
          </p>
        )}
      </fieldset>
    );
  }

  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} className="text-xs text-red-500 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function QuickResultado({ session, onSave }) {
  const [local, setLocal] = useState(session.resultado?.local ?? '');
  const [visitante, setVisitante] = useState(session.resultado?.visitante ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const localId = useId();
  const visitanteId = useId();

  const hasChanged = local !== (session.resultado?.local ?? '') || visitante !== (session.resultado?.visitante ?? '');

  async function handleSave() {
    setSaving(true);
    await onSave({ local, visitante });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const teamLabel = session.esLocal ? session.teamName : session.rival || 'Rival';
  const rivalLabel = session.esLocal ? session.rival || 'Rival' : session.teamName;

  return (
    <div className="mt-2 pt-3 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Resultado</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-center">
          <label htmlFor={localId} className="block text-[10px] text-slate-400 font-bold uppercase truncate mb-1">
            {teamLabel}
          </label>
          <input
            id={localId}
            type="number"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              setSaved(false);
            }}
            placeholder="—"
            className="w-full h-10 text-center text-lg font-black border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <span className="text-slate-300 font-bold text-lg mt-5" aria-hidden="true">
          –
        </span>
        <div className="flex-1 text-center">
          <label htmlFor={visitanteId} className="block text-[10px] text-slate-400 font-bold uppercase truncate mb-1">
            {rivalLabel}
          </label>
          <input
            id={visitanteId}
            type="number"
            value={visitante}
            onChange={(e) => {
              setVisitante(e.target.value);
              setSaved(false);
            }}
            placeholder="—"
            className="w-full h-10 text-center text-lg font-black border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 bg-slate-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        {hasChanged && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg mt-5 transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            {saving ? '...' : 'Guardar'}
          </button>
        )}
        {saved && !hasChanged && (
          <span className="text-xs text-emerald-600 font-bold mt-5 shrink-0" role="status" aria-label="Guardado">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}
