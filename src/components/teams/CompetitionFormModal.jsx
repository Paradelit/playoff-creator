import React, { useId, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import Dialog from '../Dialog';

export default function CompetitionFormModal({ competition, onSave, onClose }) {
  const titleId = useId();
  const [form, setForm] = useState({
    ...competition,
    fases:
      Array.isArray(competition.fases) && competition.fases.length > 0
        ? competition.fases
        : [{ id: crypto.randomUUID(), nombre: 'Fase 1', jornadas: 22 }],
  });
  const [saving, setSaving] = useState(false);

  function updateFase(idx, patch) {
    setForm((f) => ({
      ...f,
      fases: f.fases.map((fase, i) => (i === idx ? { ...fase, ...patch } : fase)),
    }));
  }

  function addFase() {
    setForm((f) => ({
      ...f,
      fases: [...f.fases, { id: crypto.randomUUID(), nombre: `Fase ${f.fases.length + 1}`, jornadas: 22 }],
    }));
  }

  function removeFase(idx) {
    setForm((f) => ({ ...f, fases: f.fases.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-5.5rem)] sm:max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 my-auto shrink-0"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
        <h3 id={titleId} className="text-lg font-bold text-slate-800">
          {competition.id ? 'Editar competición' : 'Nueva competición'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 rounded"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Nombre</span>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="ej. Liga Cadete A Madrid"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-slate-700">Fases</legend>
          {form.fases.map((fase, idx) => (
            <div key={fase.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
              <input
                type="text"
                value={fase.nombre}
                onChange={(e) => updateFase(idx, { nombre: e.target.value })}
                placeholder="Fase 1"
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
              />
              <input
                type="number"
                min="1"
                max="60"
                value={fase.jornadas}
                onChange={(e) => updateFase(idx, { jornadas: Number(e.target.value) || 1 })}
                className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                aria-label="Número de jornadas"
              />
              <span className="text-xs text-slate-500">j</span>
              <button
                type="button"
                onClick={() => removeFase(idx)}
                aria-label="Eliminar fase"
                disabled={form.fases.length === 1}
                className="text-red-400 hover:text-red-600 p-1 rounded disabled:opacity-30"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addFase}
            className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1 self-start"
          >
            <Plus size={14} aria-hidden="true" /> Añadir fase
          </button>
        </fieldset>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
