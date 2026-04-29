import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { saveTeam } from '../../services/teamsService';
import { DEFAULT_TEMPLATE, VARIABLE_LABELS, renderConvocatoria } from '../../utils/convocatoriaTemplate';

const PREVIEW_SESSION = {
  tipo: 'partido',
  fecha: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  horaInicio: '09:30',
  rival: 'Movistar Estudiantes',
  lugar: 'Pabellón Ramiro de Maeztu',
  lugarMapsUrl: 'https://maps.app.goo.gl/example',
  esLocal: false,
  competitionId: 'preview-c',
  faseId: 'preview-f',
  jornadaNumero: 15,
  notaExtra: '',
};
const PREVIEW_COMPETITION = {
  id: 'preview-c',
  nombre: 'Liga Cadete A',
  fases: [{ id: 'preview-f', nombre: 'Fase 1', jornadas: 22 }],
};

export default function ConvocatoriasTab({ team }) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const [form, setForm] = useState({
    plantillaConvocatoria: team.plantillaConvocatoria || DEFAULT_TEMPLATE,
    citaOffsetMinutos: team.citaOffsetMinutos ?? 45,
    convocatoriaReminderHours: team.convocatoriaReminderHours ?? 72,
    pabellones: Array.isArray(team.pabellones) ? team.pabellones : [],
  });
  const [saving, setSaving] = useState(false);
  const textareaRef = React.useRef(null);

  function insertVariable(name) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = form.plantillaConvocatoria.slice(0, start);
    const after = form.plantillaConvocatoria.slice(end);
    setForm((f) => ({ ...f, plantillaConvocatoria: `${before}{${name}}${after}` }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + name.length + 2, start + name.length + 2);
    }, 0);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTeam({ ...team, ...form }, { uid: user.uid, db, appId });
    } finally {
      setSaving(false);
    }
  }

  function addPabellon() {
    setForm((f) => ({ ...f, pabellones: [...f.pabellones, { nombre: '', mapsUrl: '' }] }));
  }
  function updatePabellon(idx, patch) {
    setForm((f) => ({ ...f, pabellones: f.pabellones.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  }
  function removePabellon(idx) {
    setForm((f) => ({ ...f, pabellones: f.pabellones.filter((_, i) => i !== idx) }));
  }

  const previewMensaje = (() => {
    try {
      return renderConvocatoria({
        session: PREVIEW_SESSION,
        team: { ...team, ...form },
        competition: PREVIEW_COMPETITION,
        now: new Date(),
      }).mensaje;
    } catch (e) {
      return `Error en la plantilla: ${e.message}`;
    }
  })();

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Plantilla del mensaje</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <textarea
              ref={textareaRef}
              value={form.plantillaConvocatoria}
              onChange={(e) => setForm((f) => ({ ...f, plantillaConvocatoria: e.target.value }))}
              rows={14}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, plantillaConvocatoria: DEFAULT_TEMPLATE }))}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Restaurar plantilla original
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-slate-500 uppercase">Variables</p>
            {Object.entries(VARIABLE_LABELS).map(([name, label]) => (
              <button
                key={name}
                type="button"
                onClick={() => insertVariable(name)}
                title={label}
                className="text-left text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1 font-mono text-slate-700"
              >
                {`{${name}}`}
              </button>
            ))}
          </div>
        </div>
        <details className="mt-3 bg-slate-50 rounded-xl p-3">
          <summary className="text-xs font-bold text-slate-700 cursor-pointer">Vista previa</summary>
          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans mt-2">{previewMensaje}</pre>
        </details>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Hora de cita</h3>
        <label className="flex items-center gap-2 text-sm">
          <span>Citamos</span>
          <input
            type="number"
            min="0"
            max="180"
            value={form.citaOffsetMinutos}
            onChange={(e) => setForm((f) => ({ ...f, citaOffsetMinutos: Number(e.target.value) }))}
            className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          />
          <span>minutos antes del partido</span>
        </label>
        <p className="text-xs text-slate-500 mt-1">Puedes ajustarlo en cada partido si lo necesitas.</p>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Recordatorio</h3>
        <label className="flex items-center gap-2 text-sm">
          <span>Avísame</span>
          <input
            type="number"
            min="1"
            max="240"
            value={form.convocatoriaReminderHours}
            onChange={(e) => setForm((f) => ({ ...f, convocatoriaReminderHours: Number(e.target.value) }))}
            className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          />
          <span>horas antes si no he mandado la convocatoria</span>
        </label>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Pabellones recurrentes</h3>
          <button
            type="button"
            onClick={addPabellon}
            className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1"
          >
            <Plus size={14} aria-hidden="true" /> Añadir pabellón
          </button>
        </div>
        {form.pabellones.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Sin pabellones guardados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {form.pabellones.map((p, idx) => (
              <li key={idx} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={p.nombre}
                  onChange={(e) => updatePabellon(idx, { nombre: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                />
                <input
                  type="url"
                  placeholder="URL Maps"
                  value={p.mapsUrl}
                  onChange={(e) => updatePabellon(idx, { mapsUrl: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => removePabellon(idx)}
                  aria-label="Eliminar pabellón"
                  className="text-red-400 hover:text-red-600 p-1 rounded"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 bg-white pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
