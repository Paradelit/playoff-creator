import React from 'react';
import { Pencil, Trash2, Eye, GitBranch, ChevronDown, ChevronRight } from 'lucide-react';
import CourtCanvas from '../CourtCanvas';
import FavoriteToggle from './library/FavoriteToggle';
import UsageBadge from './library/UsageBadge';

export function getExerciseSteps(ex) {
  if (ex.pasos?.length > 0) return ex.pasos;
  if (ex.elementos?.length > 0) return [{ titulo: '', elementos: ex.elementos }];
  return [];
}

export function prepareForEdit(ex) {
  const pasos = getExerciseSteps(ex);
  return {
    ...ex,
    elementos: ex.elementos || [],
    tags: ex.tags || [],
    pasos: pasos.length > 0 ? pasos : [{ titulo: '', elementos: [] }],
  };
}

export default function ExerciseCard({
  ex,
  isVariant,
  onPreview,
  onEdit,
  onDelete,
  onCreateVariant,
  variantCount,
  expanded,
  onToggleExpand,
  onToggleFavorite,
  showUsageBadge,
  usageCount,
  lastUsedAt,
  compact,
}) {
  const steps = getExerciseSteps(ex);
  const firstStepElements = steps[0]?.elementos || [];
  const hasVisual = firstStepElements.length > 0 || ex.tipoPista;
  const canvasMaxWidth = compact
    ? ex.tipoPista === 'entera'
      ? '240px'
      : '160px'
    : ex.tipoPista === 'entera'
      ? '320px'
      : '200px';
  return (
    <div
      className={`bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden ${isVariant ? 'border-indigo-100' : ''}`}
    >
      {hasVisual && (
        <div
          className="px-4 pt-4 pb-2 flex items-center justify-center bg-gray-50 border-b border-slate-100 cursor-pointer hover:bg-gray-100 transition-colors relative"
          onClick={() => onPreview(ex)}
        >
          <div className="w-full" style={{ maxWidth: canvasMaxWidth }}>
            <CourtCanvas tipo={ex.tipoPista || 'media'} elementos={firstStepElements} readOnly={true} />
          </div>
          {steps.length > 1 && (
            <span className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {steps.length} pasos
            </span>
          )}
          {onToggleFavorite && (
            <div className="absolute top-1.5 right-1.5">
              <FavoriteToggle active={!!ex.favorite} onToggle={() => onToggleFavorite(ex.id)} size={15} />
            </div>
          )}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {isVariant && ex.variantName && (
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-0.5">
                {ex.variantName}
              </p>
            )}
            <p className="font-bold text-slate-800 truncate">{ex.nombre}</p>
          </div>
          {!hasVisual && onToggleFavorite && (
            <FavoriteToggle active={!!ex.favorite} onToggle={() => onToggleFavorite(ex.id)} size={14} />
          )}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="text-slate-400 hover:text-slate-600 p-1 flex items-center gap-1 text-xs font-semibold shrink-0"
              title={expanded ? 'Contraer variantes' : 'Expandir variantes'}
            >
              <GitBranch size={13} className="text-indigo-500" />
              <span className="text-indigo-500">{variantCount}</span>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
        {showUsageBadge && (usageCount || lastUsedAt) && (
          <div className="mt-1.5">
            <UsageBadge count={usageCount} lastUsedMs={lastUsedAt} />
          </div>
        )}
        {(ex.tags?.length > 0 || ex.contenido) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(ex.tags || []).map((tag, i) => (
              <span
                key={i}
                className="inline-block bg-indigo-100 text-indigo-600 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
            {!ex.tags?.length && ex.contenido && (
              <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">{ex.contenido}</span>
            )}
          </div>
        )}
        {ex.descripcion && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{ex.descripcion}</p>}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => onPreview(ex)}
            className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors"
            title="Vista previa"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => onCreateVariant(ex)}
            className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Crear variante"
          >
            <GitBranch size={15} />
          </button>
          <button
            onClick={() => onEdit(ex)}
            className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(ex.id)}
            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
