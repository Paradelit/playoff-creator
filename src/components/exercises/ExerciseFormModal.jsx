import React, { useState, useId } from 'react';
import { X, BookOpen, Plus, Maximize2, Trash2, Undo } from 'lucide-react';
import CourtCanvas, { COURT_TOOLS } from '../CourtCanvas';
import TagInput from '../TagInput';
import CategoryChipPicker from './form/CategoryChipPicker';
import ExerciseMetaFields from './form/ExerciseMetaFields';
import Dialog from '../Dialog';

export default function ExerciseFormModal({
  editingExercise,
  setEditingExercise,
  exerciseErrors,
  setExerciseErrors,
  saving,
  allTags,
  onSubmit,
  onClose,
}) {
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [activeTool, setActiveTool] = useState('O');
  const [currentStep, setCurrentStep] = useState(0);

  const titleId = useId();
  const nombreId = useId();
  const variantId = useId();
  const descripcionId = useId();

  function updateElementos(nuevos) {
    setEditingExercise((ex) => {
      const pasos = [...(ex.pasos?.length > 0 ? ex.pasos : [{ titulo: '', elementos: ex.elementos || [] }])];
      const stepIdx = Math.min(currentStep, pasos.length - 1);
      if (stepIdx < 0) return ex;
      const newElements = typeof nuevos === 'function' ? nuevos(pasos[stepIdx].elementos || []) : nuevos;
      pasos[stepIdx] = { ...pasos[stepIdx], elementos: newElements };
      return { ...ex, pasos, elementos: pasos[0]?.elementos || [] };
    });
  }

  function addStep() {
    setEditingExercise((ex) => {
      const pasos = [...(ex.pasos?.length > 0 ? ex.pasos : [{ titulo: '', elementos: ex.elementos || [] }])];
      pasos.push({ titulo: '', elementos: [] });
      setCurrentStep(pasos.length - 1);
      return { ...ex, pasos };
    });
  }

  function removeStep(idx) {
    setEditingExercise((ex) => {
      if ((ex.pasos?.length || 0) <= 1) return ex;
      const pasos = ex.pasos.filter((_, i) => i !== idx);
      setCurrentStep(Math.min(currentStep, pasos.length - 1));
      return { ...ex, pasos, elementos: pasos[0]?.elementos || [] };
    });
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const errors = {};
    if (!editingExercise.nombre.trim()) errors.nombre = 'El nombre es obligatorio';
    setExerciseErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSubmit(editingExercise);
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        labelledBy={titleId}
        backdropClassName="fixed inset-0 bg-slate-900/60 z-[115] flex items-stretch sm:items-center justify-center sm:px-4 sm:pt-2 sm:pb-4 backdrop-blur-sm sm:overflow-y-auto"
        panelClassName="bg-white w-full h-[100dvh] sm:h-auto sm:rounded-2xl rounded-none sm:max-w-lg sm:max-h-[92vh] overflow-y-auto shadow-2xl animate-in sm:zoom-in-95 duration-200 sm:my-auto sm:shrink-0 flex flex-col outline-none"
      >
        <div className="flex items-center justify-between px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4 border-b border-slate-100 sticky top-0 bg-white sm:rounded-t-2xl z-10">
          <h3 id={titleId} className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600" aria-hidden="true" />
            {editingExercise.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="px-6 py-5 flex flex-col gap-4 flex-1">
          <div>
            <label htmlFor={nombreId} className="block text-xs font-semibold text-slate-600 mb-1.5">
              Nombre *
            </label>
            <input
              id={nombreId}
              type="text"
              required
              value={editingExercise.nombre}
              onChange={(e) => {
                setEditingExercise((ex) => ({ ...ex, nombre: e.target.value }));
                if (exerciseErrors.nombre) setExerciseErrors((prev) => ({ ...prev, nombre: undefined }));
              }}
              placeholder="Nombre del ejercicio"
              aria-invalid={!!exerciseErrors.nombre}
              aria-describedby={exerciseErrors.nombre ? `${nombreId}-error` : undefined}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${exerciseErrors.nombre ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-400'}`}
            />
            {exerciseErrors.nombre && (
              <p id={`${nombreId}-error`} className="text-xs text-red-500 mt-1" role="alert">
                {exerciseErrors.nombre}
              </p>
            )}
          </div>
          {editingExercise.parentId && (
            <div>
              <label htmlFor={variantId} className="block text-xs font-semibold text-slate-600 mb-1.5">
                Nombre de variante
              </label>
              <input
                id={variantId}
                type="text"
                value={editingExercise.variantName || ''}
                onChange={(e) => setEditingExercise((ex) => ({ ...ex, variantName: e.target.value }))}
                placeholder="Ej: Versión 3v3, Con bloqueo..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-slate-400 mt-1">Opcional. Describe qué diferencia esta variante.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categorías</label>
            <CategoryChipPicker
              tags={editingExercise.tags || []}
              onChange={(tags) => setEditingExercise((ex) => ({ ...ex, tags }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Otras etiquetas</label>
            <TagInput
              tags={editingExercise.tags || []}
              onChange={(tags) => setEditingExercise((ex) => ({ ...ex, tags }))}
              suggestions={allTags}
              placeholder="Añade etiquetas propias..."
            />
          </div>
          <div>
            <label htmlFor={descripcionId} className="block text-xs font-semibold text-slate-600 mb-1.5">
              Descripción
            </label>
            <textarea
              id={descripcionId}
              value={editingExercise.descripcion || ''}
              onChange={(e) => setEditingExercise((ex) => ({ ...ex, descripcion: e.target.value }))}
              placeholder="Descripción del ejercicio..."
              rows={3}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>
          <ExerciseMetaFields exercise={editingExercise} onChange={(next) => setEditingExercise(next)} />
          <fieldset>
            <legend className="block text-xs font-semibold text-slate-600 mb-2">Tipo de pista</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Tipo de pista">
              {[
                ['media', 'Media pista'],
                ['entera', 'Pista entera'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={editingExercise.tipoPista === val}
                  onClick={() => setEditingExercise((ex) => ({ ...ex, tipoPista: val }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${editingExercise.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-600">
                Pizarras ({(editingExercise.pasos || []).length}{' '}
                {(editingExercise.pasos || []).length === 1 ? 'paso' : 'pasos'})
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 rounded"
                >
                  <Plus size={13} aria-hidden="true" /> Paso
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlaybook(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
                >
                  <Maximize2 size={13} aria-hidden="true" /> Editor
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {(editingExercise.pasos || []).map((paso, i) => (
                <div
                  key={i}
                  className={`rounded-xl border ${currentStep === i ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} bg-gray-50 overflow-hidden`}
                >
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-[10px] font-bold text-slate-400">PASO {i + 1}</span>
                      <input
                        type="text"
                        value={paso.titulo || ''}
                        onChange={(e) => {
                          const pasos = [...editingExercise.pasos];
                          pasos[i] = { ...pasos[i], titulo: e.target.value };
                          setEditingExercise((ex) => ({ ...ex, pasos }));
                        }}
                        placeholder="Titulo del paso..."
                        aria-label={`Título del paso ${i + 1}`}
                        className="text-xs text-slate-600 bg-transparent outline-none flex-1"
                      />
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(i);
                          setShowPlaybook(true);
                        }}
                        className="text-blue-500 hover:text-blue-700 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                        aria-label={`Editar pizarra del paso ${i + 1}`}
                      >
                        <Maximize2 size={12} aria-hidden="true" />
                      </button>
                      {(editingExercise.pasos || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(i)}
                          className="text-red-400 hover:text-red-600 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                          aria-label={`Eliminar paso ${i + 1}`}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className="h-24 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition p-2"
                    onClick={() => {
                      setCurrentStep(i);
                      setShowPlaybook(true);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir editor del paso ${i + 1}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCurrentStep(i);
                        setShowPlaybook(true);
                      }
                    }}
                  >
                    <div
                      className="w-full"
                      style={{ maxWidth: editingExercise.tipoPista === 'entera' ? '280px' : '160px' }}
                    >
                      <CourtCanvas tipo={editingExercise.tipoPista} elementos={paso.elementos || []} readOnly={true} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] -mx-6 px-6 mt-auto border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Playbook Editor — full-screen sub-dialog */}
      {showPlaybook && (
        <PlaybookSubDialog
          editingExercise={editingExercise}
          setEditingExercise={setEditingExercise}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          updateElementos={updateElementos}
          onClose={() => setShowPlaybook(false)}
        />
      )}
    </>
  );
}

function PlaybookSubDialog({
  editingExercise,
  setEditingExercise,
  currentStep,
  setCurrentStep,
  activeTool,
  setActiveTool,
  updateElementos,
  onClose,
}) {
  const subTitleId = useId();
  const pasos = editingExercise.pasos || [];
  const stepIdx = Math.min(currentStep, pasos.length - 1);
  const currentElements = pasos[stepIdx]?.elementos || [];

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={`Editor de pizarra — Paso ${stepIdx + 1} de ${pasos.length}`}
      backdropClassName="fixed inset-0 z-[120] bg-gray-900/90 flex flex-col items-center justify-center p-4 touch-none"
      panelClassName="bg-white w-full max-w-5xl h-[85vh] rounded-lg shadow-2xl flex flex-col overflow-hidden outline-none"
    >
      <div className="flex flex-wrap justify-between items-center gap-2 p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <h3 id={subTitleId} className="font-bold text-gray-800">
            Paso {stepIdx + 1} de {pasos.length}
          </h3>
          <div className="flex gap-1">
            {pasos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentStep(Math.max(0, stepIdx - 1))}
                  disabled={stepIdx === 0}
                  className="px-2 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(Math.min(pasos.length - 1, stepIdx + 1))}
                  disabled={stepIdx >= pasos.length - 1}
                  className="px-2 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Siguiente →
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => updateElementos((els) => els.slice(0, -1))}
              className="p-1.5 text-gray-600 hover:bg-gray-200 rounded flex items-center text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Deshacer último elemento"
            >
              <Undo size={14} className="mr-1" aria-hidden="true" /> <span className="hidden sm:inline">Deshacer</span>
            </button>
            <button
              type="button"
              onClick={() => updateElementos([])}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded flex items-center text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label="Limpiar pizarra"
            >
              <Trash2 size={14} className="mr-1" aria-hidden="true" /> <span className="hidden sm:inline">Limpiar</span>
            </button>
            <fieldset className="flex gap-1 border-l border-gray-300 pl-2 ml-1">
              <legend className="sr-only">Tipo de pista</legend>
              {[
                ['media', 'Media'],
                ['entera', 'Entera'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={editingExercise.tipoPista === val}
                  onClick={() => setEditingExercise((ex) => ({ ...ex, tipoPista: val }))}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${editingExercise.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Cerrar editor de pizarra"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden bg-gray-100">
        {/* Mobile toolbar */}
        <div
          className="flex sm:hidden flex-wrap gap-1 p-2 bg-white border-b border-gray-200 overflow-x-auto"
          role="toolbar"
          aria-label="Herramientas de dibujo"
        >
          {COURT_TOOLS.filter((t) => !t.divider).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTool(t.id)}
              aria-pressed={activeTool === t.id}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${activeTool === t.id ? 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
            >
              <div className="w-5 flex justify-center shrink-0" aria-hidden="true">
                {t.icon}
              </div>
              <span className="leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        {/* Desktop sidebar */}
        <nav
          className="hidden sm:flex w-48 bg-white border-r border-gray-200 flex-col p-2 gap-1 overflow-y-auto"
          aria-label="Herramientas de dibujo"
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mt-2 mb-1" aria-hidden="true">
            Herramientas
          </p>
          {COURT_TOOLS.map((t, idx) =>
            t.divider ? (
              <div key={idx} className="h-px bg-gray-200 my-1 mx-2" role="separator" />
            ) : (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTool(t.id)}
                aria-pressed={activeTool === t.id}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${activeTool === t.id ? 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
              >
                <div className="w-6 flex justify-center shrink-0" aria-hidden="true">
                  {t.icon}
                </div>
                <span className="text-xs leading-tight">{t.label}</span>
              </button>
            ),
          )}
          <div className="mt-auto p-3 bg-blue-50 rounded text-xs text-blue-800 leading-relaxed border border-blue-100 mx-1">
            <b>Tip:</b> Objetos: clic para colocar. Lineas: clic y arrastra.
          </div>
        </nav>
        <div className="flex-1 flex items-center justify-center p-2 sm:p-6 select-none">
          <div className="bg-white shadow border border-gray-300 w-full h-full flex items-center justify-center">
            <CourtCanvas
              tipo={editingExercise.tipoPista}
              elementos={currentElements}
              setElementos={updateElementos}
              readOnly={false}
              activeTool={activeTool}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
