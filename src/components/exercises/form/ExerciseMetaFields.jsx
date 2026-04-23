import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Sliders } from 'lucide-react';
import { EXERCISE_PHASES, DIFFICULTY_LEVELS } from '../../../utils/exerciseCategories';

function toNumberOrUndefined(val) {
  if (val === '' || val == null) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

export default function ExerciseMetaFields({ exercise, onChange, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  const set = (patch) => onChange({ ...exercise, ...patch });

  const anySet =
    !!exercise.objetivo ||
    !!exercise.duracionMin ||
    !!exercise.dificultad ||
    !!exercise.jugadoresMin ||
    !!exercise.jugadoresMax ||
    !!exercise.material ||
    !!exercise.fase;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Sliders size={15} className="text-slate-400" aria-hidden="true" />
          Más detalles
          {anySet && !open && (
            <span className="ml-1 inline-block w-2 h-2 rounded-full bg-emerald-500" aria-label="Con datos" />
          )}
        </span>
        {open ? (
          <ChevronDown size={16} className="text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-4 bg-slate-50/50">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Objetivo</label>
            <input
              type="text"
              value={exercise.objetivo || ''}
              onChange={(e) => set({ objetivo: e.target.value })}
              placeholder="Qué trabaja este ejercicio"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Duración (min)</label>
              <input
                type="number"
                min="1"
                value={exercise.duracionMin ?? ''}
                onChange={(e) => set({ duracionMin: toNumberOrUndefined(e.target.value) })}
                placeholder="15"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Dificultad</label>
              <div className="flex gap-1">
                {DIFFICULTY_LEVELS.map((lvl) => {
                  const active = Number(exercise.dificultad) === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => set({ dificultad: active ? undefined : lvl })}
                      aria-pressed={active}
                      aria-label={`Dificultad ${lvl}`}
                      className={`w-8 h-9 rounded-lg text-xs font-bold transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jugadores</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={exercise.jugadoresMin ?? ''}
                onChange={(e) => set({ jugadoresMin: toNumberOrUndefined(e.target.value) })}
                placeholder="Min"
                className="w-20 border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-slate-400 text-sm">—</span>
              <input
                type="number"
                min="1"
                value={exercise.jugadoresMax ?? ''}
                onChange={(e) => set({ jugadoresMax: toNumberOrUndefined(e.target.value) })}
                placeholder="Max"
                className="w-20 border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Material</label>
            <input
              type="text"
              value={exercise.material || ''}
              onChange={(e) => set({ material: e.target.value })}
              placeholder="4 conos, 2 balones..."
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fase</label>
            <div className="flex gap-2">
              {EXERCISE_PHASES.map((p) => {
                const active = exercise.fase === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set({ fase: active ? undefined : p.id })}
                    aria-pressed={active}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
