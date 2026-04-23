import React from 'react';
import { Dumbbell, Clock, Tag } from 'lucide-react';
import type { ExercisePreviewData } from '../../../services/contentBlocks';

export interface ExercisePreviewBlockProps {
  exercises: ExercisePreviewData[];
}

export default function ExercisePreviewBlock({ exercises }: ExercisePreviewBlockProps) {
  if (!exercises || exercises.length === 0) return null;

  return (
    <div className="space-y-3 my-2">
      {exercises.map((ex, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Dumbbell size={14} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">{ex.nombre}</span>
          </div>
          <div className="p-3 space-y-2">
            {ex.descripcion && <p className="text-xs text-slate-600 leading-relaxed">{ex.descripcion}</p>}

            {(ex.duracion || ex.nivel) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {ex.duracion && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded-md">
                    <Clock size={10} /> {ex.duracion} min
                  </span>
                )}
                {ex.nivel && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-md">
                    <Tag size={10} /> Nivel: {ex.nivel}
                  </span>
                )}
              </div>
            )}

            {ex.tags && ex.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {ex.tags.map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
