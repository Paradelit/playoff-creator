import React, { useMemo } from 'react';
import { useRegisterScreenSemantic } from '../hooks/useRegisterScreenSemantic';
import { buildTrainingEditorSemantic } from '../utils/screenSemantic/training';
import { ArrowLeft, Plus, Minus, BookOpen, Save, Trash2, Maximize2, Printer } from 'lucide-react';
import { teamDisplayName } from '../utils/teamUtils';
import MentionTextarea from '../components/MentionTextarea';
import CourtCanvas from '../components/CourtCanvas';
import ClubLogo from '../components/ClubLogo';
import PromptDialog from '../components/PromptDialog';
import PlaybookEditorModal from '../components/training/PlaybookEditorModal';
import LibraryPanel from '../components/training/LibraryPanel';
import { useTrainingEditor } from '../hooks/useTrainingEditor';
import { useRegisterScreenContext } from '../hooks/useRegisterScreenContext';
import { getTemporada } from '../utils/dateUtils';

const DIAS = [
  { val: 'L', label: 'L' },
  { val: 'M', label: 'M' },
  { val: 'X', label: 'X' },
  { val: 'J', label: 'J' },
  { val: 'V', label: 'V' },
  { val: 'S', label: 'S' },
  { val: 'D', label: 'D' },
];

export default function TrainingEditorScreen() {
  const editor = useTrainingEditor();
  const {
    teamId,
    navigate,
    team,
    profile,
    members,
    training,
    loading,
    saveStatus,
    ejercicios,
    ejModal,
    setModalEjercicioId,
    libraryPrompt,
    setLibraryPrompt,
    activeTool,
    setActiveTool,
    libraryPanel,
    setLibraryPanel,
    librarySearch,
    setLibrarySearch,
    libraryFilterTags,
    setLibraryFilterTags,
    libraryAllTags,
    libraryFiltered,
    updateTraining,
    updateMeta,
    updateCierre,
    addEjercicio,
    removeLastEjercicio,
    removeEjercicio,
    updateEjercicio,
    loadFromLibrary,
    saveToLibrary,
    handleLibrarySave,
  } = editor;

  useRegisterScreenContext({ teamName: training?.meta?.equipo, fecha: training?.meta?.fecha });

  // Sub-A.5 — semantic para Pick.
  const trainingSemantic = useMemo(
    () => buildTrainingEditorSemantic({ teamId, team, training }),
    [teamId, team, training],
  );
  useRegisterScreenSemantic(trainingSemantic);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!training) return null;

  const clubName = profile?.nombreClub?.trim() || 'Uros de Rivas';
  const temporada = getTemporada();

  return (
    <div className="min-h-screen bg-gray-200 py-6 px-4 font-sans text-black print:bg-white print:p-0 print:py-0">
      {/* ─── TOOLBAR WEB ─── */}
      <div className="max-w-[820px] mx-auto mb-4 flex items-center justify-between print:hidden gap-3">
        <button
          onClick={() => navigate(`/teams/${teamId}/cuaderno/entrenamientos`)}
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm font-medium transition"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Entrenamientos
        </button>

        <div className="flex gap-2">
          <button
            onClick={addEjercicio}
            className="flex items-center px-3 py-1.5 bg-white border border-gray-300 text-sm hover:bg-gray-50 transition shadow-sm rounded-lg gap-1"
          >
            <Plus size={14} aria-hidden="true" /> Fila Extra
          </button>
          <button
            onClick={removeLastEjercicio}
            className="flex items-center px-3 py-1.5 bg-white border border-red-300 text-red-700 text-sm hover:bg-red-50 transition shadow-sm rounded-lg gap-1"
          >
            <Minus size={14} aria-hidden="true" /> Quitar Fila
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium transition-colors ${saveStatus === 'saving' ? 'text-blue-600' : 'text-emerald-600'}`}
          >
            {saveStatus === 'saving' ? 'Guardando...' : '✓ Guardado'}
          </span>
          <button
            onClick={() => {
              const firstEmpty = ejercicios.find((e) => !e.contenido && !e.descripcion && !(e.elementos?.length > 0));
              setLibraryPanel({ open: true, targetId: firstEmpty?.id || ejercicios[0]?.id || null });
              setLibrarySearch('');
              setLibraryFilterTags([]);
            }}
            className="flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition border border-blue-200"
          >
            <BookOpen size={15} aria-hidden="true" /> Cargar de Biblioteca
          </button>
          <button
            onClick={() => navigate('/area-privada/exercises')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition"
          >
            <BookOpen size={15} aria-hidden="true" /> Biblioteca
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition shadow"
          >
            <Printer size={15} aria-hidden="true" /> Imprimir A4
          </button>
        </div>
      </div>

      {/* ─── DOCUMENTO A4 ─── */}
      <div className="max-w-[820px] mx-auto overflow-x-auto">
        <div className="bg-white border border-gray-400 p-6 shadow-xl print:shadow-none print:border-none print:p-4 print:max-w-none min-w-[700px]">
          {/* Cabecera */}
          <div className="flex justify-between items-start mb-4">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile?.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-2xl tracking-widest uppercase">{clubName}</h1>
              <p className="text-xs text-gray-500 mt-1">Temporada {temporada}</p>
            </div>
            <div className="w-1/4 text-right text-sm">
              <p className="font-bold">{team ? teamDisplayName(team) : ''}</p>
              <p className="mt-2 text-sm">
                Entrenamiento N°:&nbsp;
                <input
                  type="text"
                  value={training.meta?.numero || ''}
                  onChange={(e) => updateMeta('numero', e.target.value)}
                  aria-label="Número de entrenamiento"
                  className="w-10 border-b border-black text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent"
                />
              </p>
            </div>
          </div>

          {/* Metadatos */}
          <div className="border border-black flex flex-col mb-4 text-sm">
            <div className="flex border-b border-black">
              <div className="flex-1 border-r border-black p-1.5 flex items-center">
                <span className="font-bold whitespace-nowrap">Equipo.-</span>
                <input
                  type="text"
                  value={training.meta?.equipo || ''}
                  onChange={(e) => updateMeta('equipo', e.target.value)}
                  aria-label="Equipo"
                  className="w-full ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent"
                />
              </div>
              <div className="w-52 border-r border-black p-1.5 flex items-center gap-1">
                <span className="font-bold whitespace-nowrap">Fecha.-</span>
                <select
                  value={training.meta?.dia || ''}
                  onChange={(e) => updateMeta('dia', e.target.value)}
                  aria-label="Día de la semana"
                  className="ml-1 text-xs bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 cursor-pointer font-bold appearance-none"
                >
                  <option value="">Día</option>
                  {DIAS.map((d) => (
                    <option key={d.val} value={d.val}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={training.meta?.fecha || ''}
                  onChange={(e) => updateMeta('fecha', e.target.value)}
                  aria-label="Fecha"
                  className="flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent text-xs [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
              <div className="w-48 border-r border-black p-1.5 flex items-center gap-1">
                <span className="font-bold whitespace-nowrap">Hora.-</span>
                <input
                  type="time"
                  value={training.meta?.horaInicio || ''}
                  onChange={(e) => updateMeta('horaInicio', e.target.value)}
                  aria-label="Hora de inicio"
                  className="flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent text-xs [&::-webkit-calendar-picker-indicator]:hidden"
                />
                <span className="font-bold">-</span>
                <input
                  type="time"
                  value={training.meta?.horaFin || ''}
                  onChange={(e) => updateMeta('horaFin', e.target.value)}
                  aria-label="Hora de fin"
                  className="flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent text-xs [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
              <div className="flex-1 p-1.5 flex items-center">
                <span className="font-bold whitespace-nowrap">Lugar.-</span>
                <input
                  type="text"
                  value={training.meta?.lugar || ''}
                  onChange={(e) => updateMeta('lugar', e.target.value)}
                  aria-label="Lugar"
                  className="w-full ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent"
                />
              </div>
            </div>
            <div className="p-1.5 flex flex-col min-h-[52px]">
              <span className="font-bold">Objetivos de la semana.-</span>
              <textarea
                value={training.objetivos || ''}
                onChange={(e) => updateTraining((t) => ({ ...t, objetivos: e.target.value }))}
                aria-label="Objetivos de la semana"
                className="w-full flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent resize-none leading-tight mt-1 text-sm"
              />
            </div>
          </div>

          {/* Tabla ejercicios */}
          <div className="border border-black flex flex-col mb-4 text-sm">
            <div className="flex border-b border-black font-bold text-center bg-gray-50 print:bg-transparent">
              <div className="w-14 border-r border-black p-1 text-xs">Tiempo</div>
              <div className="w-32 border-r border-black p-1 text-xs">Contenido</div>
              <div className="flex-1 border-r border-black p-1 text-xs text-left pl-2">Ejercicio</div>
              <div className="w-40 p-1 text-xs">Pizarra</div>
            </div>

            {ejercicios.map((ej) => (
              <div
                key={ej.id}
                className={`group relative flex border-b border-black last:border-b-0 min-h-[100px] transition-colors ${libraryPanel.open && libraryPanel.targetId === ej.id ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : ''}`}
              >
                <div className="w-14 border-r border-black p-1">
                  <input
                    type="text"
                    value={ej.tiempo || ''}
                    onChange={(e) => updateEjercicio(ej.id, 'tiempo', e.target.value)}
                    aria-label={`Tiempo ejercicio ${ej.id}`}
                    className="w-full h-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent text-xs"
                  />
                </div>
                <div className="w-32 border-r border-black p-1 relative">
                  {ej.libExerciseId && (
                    <span
                      className="absolute top-1 right-1 print:hidden"
                      title={`Enlazado: ${ej.libExerciseName || 'Biblioteca'}`}
                    >
                      <BookOpen size={9} className="text-blue-500" aria-hidden="true" />
                    </span>
                  )}
                  <textarea
                    value={ej.contenido || ''}
                    onChange={(e) => updateEjercicio(ej.id, 'contenido', e.target.value)}
                    aria-label={`Contenido ejercicio ${ej.id}`}
                    className="w-full h-full resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent leading-tight text-xs"
                  />
                </div>
                <div className="flex-1 border-r border-black p-1">
                  <textarea
                    value={ej.descripcion || ''}
                    onChange={(e) => updateEjercicio(ej.id, 'descripcion', e.target.value)}
                    aria-label={`Descripción ejercicio ${ej.id}`}
                    className="w-full h-full resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent leading-tight text-xs text-justify pb-2 pr-1"
                  />
                </div>
                <div className="w-40 flex flex-col items-center justify-center relative bg-white overflow-hidden">
                  <div
                    className="w-full h-full max-h-[110px] p-1 cursor-pointer hover:bg-gray-50 transition print:cursor-default"
                    onClick={() => setModalEjercicioId(ej.id)}
                  >
                    <CourtCanvas tipo={ej.tipoPista} elementos={ej.elementos || []} readOnly={true} />
                  </div>
                  <div className="absolute bottom-1 right-1 flex gap-1 print:hidden opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white p-1 rounded border border-gray-200 shadow-sm">
                    <button
                      onClick={() => setModalEjercicioId(ej.id)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Abrir editor"
                    >
                      <Maximize2 size={11} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => {
                        setLibraryPanel({ open: true, targetId: ej.id });
                        setLibrarySearch('');
                        setLibraryFilterTags([]);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                      title="Cargar de biblioteca"
                    >
                      <BookOpen size={11} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => saveToLibrary(ej)}
                      className="text-emerald-600 hover:text-emerald-800"
                      title="Guardar en biblioteca"
                    >
                      <Save size={11} aria-hidden="true" />
                    </button>
                    <select
                      value={ej.tipoPista}
                      onChange={(e) => updateEjercicio(ej.id, 'tipoPista', e.target.value)}
                      aria-label={`Tipo pista ejercicio ${ej.id}`}
                      className="text-[10px] border border-gray-300 bg-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0"
                    >
                      <option value="media">1/2</option>
                      <option value="entera">Full</option>
                    </select>
                    <button
                      onClick={() => removeEjercicio(ej.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Eliminar fila"
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer cierre */}
          <div className="border border-black flex text-sm" style={{ minHeight: 120 }}>
            <div className="w-1/2 flex flex-col border-r border-black">
              <div className="flex-1 border-b border-black p-1.5 flex flex-col">
                <span className="font-bold">Faltas.-</span>
                <MentionTextarea
                  value={training.cierre?.faltas || ''}
                  onChange={(e) => updateCierre('faltas', e.target.value)}
                  members={members}
                  placeholder=""
                  aria-label="Faltas"
                  rows={2}
                  className="w-full flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent resize-none text-xs leading-tight mt-1"
                />
              </div>
              <div className="flex-1 p-1.5 flex flex-col">
                <span className="font-bold">Retrasos.-</span>
                <MentionTextarea
                  value={training.cierre?.retrasos || ''}
                  onChange={(e) => updateCierre('retrasos', e.target.value)}
                  members={members}
                  placeholder=""
                  aria-label="Retrasos"
                  rows={2}
                  className="w-full flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent resize-none text-xs leading-tight mt-1"
                />
              </div>
            </div>
            <div className="w-1/2 flex flex-col">
              <div className="flex-1 border-b border-black p-1.5 flex flex-col">
                <span className="font-bold">Anotaciones.-</span>
                <MentionTextarea
                  value={training.cierre?.anotaciones || ''}
                  onChange={(e) => updateCierre('anotaciones', e.target.value)}
                  members={members}
                  placeholder=""
                  aria-label="Anotaciones"
                  rows={2}
                  className="w-full flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent resize-none text-xs leading-tight mt-1"
                />
              </div>
              <div className="flex-1 p-1.5 flex flex-col">
                <span className="font-bold">Observaciones.-</span>
                <textarea
                  value={training.cierre?.observaciones || ''}
                  onChange={(e) => updateCierre('observaciones', e.target.value)}
                  aria-label="Observaciones"
                  className="w-full flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 print:focus-visible:ring-0 bg-transparent resize-none text-xs leading-tight mt-1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL PLAYBOOK EDITOR ─── */}
      {ejModal && (
        <PlaybookEditorModal
          ejercicio={ejModal}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          updateEjercicio={updateEjercicio}
          onClose={() => setModalEjercicioId(null)}
        />
      )}

      {/* ─── PANEL LATERAL BIBLIOTECA ─── */}
      {libraryPanel.open && (
        <LibraryPanel
          libraryPanel={libraryPanel}
          setLibraryPanel={setLibraryPanel}
          librarySearch={librarySearch}
          setLibrarySearch={setLibrarySearch}
          libraryFilterTags={libraryFilterTags}
          setLibraryFilterTags={setLibraryFilterTags}
          libraryAllTags={libraryAllTags}
          libraryFiltered={libraryFiltered}
          loadFromLibrary={loadFromLibrary}
        />
      )}

      <PromptDialog
        open={!!libraryPrompt}
        title="Guardar en biblioteca"
        message="Introduce un nombre para el ejercicio:"
        defaultValue={libraryPrompt?.contenido || ''}
        placeholder="Nombre del ejercicio"
        onConfirm={handleLibrarySave}
        onCancel={() => setLibraryPrompt(null)}
      />
    </div>
  );
}
