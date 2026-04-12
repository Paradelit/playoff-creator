import React, { useRef } from 'react';
import { X, Pencil, GitBranch, Image, Share2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useToast } from '../../contexts/ToastContext';
import CourtCanvas from '../CourtCanvas';
import { getExerciseSteps } from './ExerciseCard';

export default function ExercisePreviewModal({ exercise, sharing, onClose, onEdit, onCreateVariant, onShare }) {
  const toast = useToast();
  const contentRef = useRef(null);

  async function handleExportPng() {
    if (!contentRef.current) return;
    try {
      const dataUrl = await toPng(contentRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${exercise?.nombre || 'ejercicio'}.png`;
      a.click();
    } catch {
      toast('Error al exportar imagen', 'error');
    }
  }

  const steps = getExerciseSteps(exercise);

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold text-slate-800 truncate">{exercise.nombre}</h3>
            {(exercise.tags?.length > 0 || exercise.contenido) && (
              <div className="flex flex-wrap gap-1 mt-1">
                {(exercise.tags || []).map((tag, i) => (
                  <span
                    key={i}
                    className="inline-block bg-indigo-100 text-indigo-600 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {!exercise.tags?.length && exercise.contenido && (
                  <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">
                    {exercise.contenido}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 ml-4">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div ref={contentRef} className="bg-white p-2">
            <h4 className="text-lg font-bold text-slate-800 mb-3">{exercise.nombre}</h4>
            {exercise.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {exercise.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-block bg-indigo-100 text-indigo-600 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {steps.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-slate-200 flex items-center justify-center p-6 mb-5">
                <div className="w-full" style={{ maxWidth: exercise.tipoPista === 'entera' ? '600px' : '400px' }}>
                  <CourtCanvas tipo={exercise.tipoPista || 'media'} elementos={[]} readOnly={true} />
                </div>
              </div>
            ) : (
              <div className="space-y-4 mb-5">
                {steps.map((paso, i) => (
                  <div key={i}>
                    {steps.length > 1 && (
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        Paso {i + 1}
                        {paso.titulo ? ` — ${paso.titulo}` : ''}
                      </p>
                    )}
                    <div className="bg-gray-50 rounded-xl border border-slate-200 flex items-center justify-center p-4">
                      <div className="w-full" style={{ maxWidth: exercise.tipoPista === 'entera' ? '600px' : '400px' }}>
                        <CourtCanvas
                          tipo={exercise.tipoPista || 'media'}
                          elementos={paso.elementos || []}
                          readOnly={true}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {exercise.descripcion && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Descripcion</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{exercise.descripcion}</p>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-4">
              {exercise.tipoPista === 'entera' ? 'Pista entera' : 'Media pista'}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={handleExportPng}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              title="Descargar como imagen"
            >
              <Image size={14} /> PNG
            </button>
            <button
              onClick={() => onShare(exercise)}
              disabled={sharing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
              title="Compartir por enlace"
            >
              <Share2 size={14} /> {sharing ? 'Compartiendo...' : 'Compartir'}
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition"
            >
              Cerrar
            </button>
            <button
              onClick={() => {
                onCreateVariant(exercise);
                onClose();
              }}
              className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 border border-indigo-200"
            >
              <GitBranch size={16} /> Variante
            </button>
            <button
              onClick={() => {
                onEdit(exercise);
                onClose();
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <Pencil size={16} /> Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
