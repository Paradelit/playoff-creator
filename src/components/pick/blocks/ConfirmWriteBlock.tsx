import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, X, Loader2, ShieldCheck } from 'lucide-react';
import type { WriteProposal, ExercisePreviewData } from '../../../services/contentBlocks';
import ExercisePreviewBlock from './ExercisePreviewBlock';

export interface ConfirmWriteBlockProps {
  proposal: WriteProposal;
  onConfirm: (proposal: WriteProposal) => Promise<void> | void;
  onCancel?: (proposal: WriteProposal) => void;
}

export default function ConfirmWriteBlock({ proposal, onConfirm, onCancel }: ConfirmWriteBlockProps) {
  const [status, setStatus] = useState<'pending' | 'executing' | 'done' | 'cancelled' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setStatus('executing');
    setError(null);
    try {
      await onConfirm(proposal);
      setStatus('done');
    } catch (err) {
      setError((err as Error).message || 'Error');
      setStatus('error');
    }
  };

  const handleCancel = () => {
    setStatus('cancelled');
    onCancel?.(proposal);
  };

  const color = STATE_STYLES[status];

  // Extraer ejercicios para la previsualización si aplica
  let exercisesToPreview: ExercisePreviewData[] = [];
  if (proposal.kind === 'create_exercise' && proposal.payload.exercise) {
    exercisesToPreview = [proposal.payload.exercise as ExercisePreviewData];
  } else if (proposal.kind === 'create_exercises' && Array.isArray(proposal.payload.exercises)) {
    exercisesToPreview = proposal.payload.exercises as ExercisePreviewData[];
  }

  return (
    <div className={`rounded-xl border ${color.border} ${color.bg} overflow-hidden`}>
      <div className={`px-3 py-2 border-b ${color.border} flex items-center gap-2`}>
        <ShieldCheck size={14} className={color.icon} />
        <p className={`text-sm font-semibold ${color.title}`}>{STATE_LABELS[status]}</p>
      </div>
      <div className="px-3 py-2 space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          {KIND_LABELS[proposal.kind] || proposal.kind}
        </p>
        <div className="text-sm text-slate-800">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p>{children}</p>,
              strong: ({ children }) => <strong className="font-bold text-blue-700">{children}</strong>,
            }}
          >
            {proposal.summary}
          </ReactMarkdown>
        </div>

        {exercisesToPreview.length > 0 && (
          <div className="mt-2 mb-2">
            <ExercisePreviewBlock exercises={exercisesToPreview} />
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {status === 'pending' && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
            >
              <Check size={12} /> Confirmar
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
            >
              <X size={12} /> Cancelar
            </button>
          </div>
        )}
        {status === 'executing' && (
          <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
            <Loader2 size={12} className="animate-spin" /> Aplicando cambios…
          </div>
        )}
      </div>
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  create_training: 'Crear entrenamiento',
  create_calendar_session: 'Crear evento de calendario',
  update_bracket_scores: 'Actualizar resultados del cuadro',
  save_note: 'Guardar nota',
  create_bracket: 'Crear cuadro de torneo',
  save_attendance: 'Guardar asistencia',
  save_player_report: 'Actualizar informe de jugadores',
  save_shooting_test: 'Guardar test de tiro',
  save_scouting: 'Guardar scouting',
  save_analysis: 'Guardar análisis de partido',
  create_exercise: 'Añadir ejercicio a la biblioteca',
  create_exercises: 'Añadir múltiples ejercicios',
};

const STATE_LABELS: Record<string, string> = {
  pending: 'Confirmación requerida',
  executing: 'Aplicando…',
  done: '¡Hecho!',
  cancelled: 'Cancelado',
  error: 'Error',
};

const STATE_STYLES: Record<string, { border: string; bg: string; icon: string; title: string }> = {
  pending: {
    border: 'border-blue-200',
    bg: 'bg-blue-50/60',
    icon: 'text-blue-600',
    title: 'text-blue-900',
  },
  executing: {
    border: 'border-blue-200',
    bg: 'bg-blue-50/60',
    icon: 'text-blue-600',
    title: 'text-blue-900',
  },
  done: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/60',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
  },
  cancelled: {
    border: 'border-slate-200',
    bg: 'bg-slate-50',
    icon: 'text-slate-400',
    title: 'text-slate-600',
  },
  error: {
    border: 'border-red-200',
    bg: 'bg-red-50/60',
    icon: 'text-red-600',
    title: 'text-red-900',
  },
};
