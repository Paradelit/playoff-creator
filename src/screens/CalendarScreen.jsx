import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { useCalendarSessions, getMonday } from '../hooks/useCalendarSessions';
import { useSessionEditor } from '../hooks/useSessionEditor';
import { useCalendarImport } from '../hooks/useCalendarImport';
import { useRegisterScreenContext } from '../hooks/useRegisterScreenContext';
import RecurrenceChoiceDialog from '../components/RecurrenceChoiceDialog';
import MonthGrid, { buildCalendarDays } from '../components/calendar/MonthGrid';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import SessionDetailModal from '../components/calendar/SessionDetailModal';
import SessionFormModal from '../components/calendar/SessionFormModal';
import { ImportSetupModal, ImportPreviewModal, DuplicateConflictModal } from '../components/calendar/ImportModals';
import { teamDisplayName } from '../utils/teamUtils';
import { toYMD } from '../utils/dateUtils';
import { MONTH_NAMES, MONTH_NAMES_SHORT, DAY_NAMES_FULL } from '../utils/constants';

function buildWeekDays(currentDate, sessions) {
  const monday = getMonday(currentDate);
  const sessionsByDate = {};
  sessions.forEach((s) => {
    if (!sessionsByDate[s.fecha]) sessionsByDate[s.fecha] = [];
    sessionsByDate[s.fecha].push(s);
  });
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { date, sessions: sessionsByDate[toYMD(date)] || [] };
  });
}

const EMPTY_SESSION = (teams) => ({
  teamId: teams[0]?.id || '',
  sessionNumber: 1,
  fecha: toYMD(new Date()),
  horaInicio: '',
  horaFin: '',
  lugar: '',
  tipo: 'entrenamiento',
  rival: '',
  esLocal: true,
  trainingId: null,
  importedFrom: 'manual',
});

export default function CalendarScreen() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [filterTeamId, setFilterTeamId] = useState(() => searchParams.get('teamId') || null);

  const initialDate = (() => {
    const dateParam = searchParams.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, m, d] = dateParam.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  })();
  const [viewMode, setViewMode] = useState(searchParams.get('date') ? 'day' : 'month');
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(initialDate);

  const { sessions: allSessions, loading, teams, getTrainingNum } = useCalendarSessions(currentDate, viewMode);

  useRegisterScreenContext({ viewMode, teamsCount: teams.length });

  const editor = useSessionEditor(teams, getTrainingNum);
  const importer = useCalendarImport(teams, getTrainingNum);

  const filterTeam = filterTeamId ? teams.find((t) => t.id === filterTeamId) || null : null;
  const visibleSessions = filterTeamId ? allSessions.filter((s) => s.teamId === filterTeamId) : allSessions;
  const calendarDays = viewMode === 'month' ? buildCalendarDays(currentDate, visibleSessions) : [];
  const weekDays = viewMode === 'week' ? buildWeekDays(currentDate, visibleSessions) : [];
  const daySessionList = viewMode === 'day' ? visibleSessions.filter((s) => s.fecha === toYMD(currentDate)) : [];
  const todayYMD = toYMD(today);

  function goBack() {
    setCurrentDate((d) => {
      const n = new Date(d);
      if (viewMode === 'month') n.setMonth(d.getMonth() - 1);
      else if (viewMode === 'week') n.setDate(d.getDate() - 7);
      else n.setDate(d.getDate() - 1);
      return n;
    });
  }
  function goForward() {
    setCurrentDate((d) => {
      const n = new Date(d);
      if (viewMode === 'month') n.setMonth(d.getMonth() + 1);
      else if (viewMode === 'week') n.setDate(d.getDate() + 7);
      else n.setDate(d.getDate() + 1);
      return n;
    });
  }

  function getNavLabel() {
    if (viewMode === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === 'week') {
      const monday = getMonday(currentDate);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      if (monday.getMonth() === sunday.getMonth()) {
        return `${monday.getDate()} – ${sunday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]} ${monday.getFullYear()}`;
      }
      if (monday.getFullYear() === sunday.getFullYear()) {
        return `${monday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_NAMES_SHORT[sunday.getMonth()]} ${monday.getFullYear()}`;
      }
      return `${monday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]} ${monday.getFullYear()} – ${sunday.getDate()} ${MONTH_NAMES_SHORT[sunday.getMonth()]} ${sunday.getFullYear()}`;
    }
    const dow = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
    return `${DAY_NAMES_FULL[dow]}, ${currentDate.getDate()} ${MONTH_NAMES_SHORT[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-4xl lg:max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <CalendarDays className="text-amber-500" size={36} /> Calendario
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Entrenamientos y partidos de tus equipos.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={importer.openImportSetup}
              className="bg-gradient-to-r from-orange-500 to-blue-700 hover:from-orange-600 hover:to-blue-800 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition text-sm"
            >
              <Sparkles size={16} /> Importar con IA
            </button>
            <input
              ref={importer.fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={importer.handleFileChange}
            />
            <button
              onClick={() => {
                editor.setSessionErrors({});
                editor.setEditingSession({
                  ...EMPTY_SESSION(teams),
                  ...(filterTeamId ? { teamId: filterTeamId } : {}),
                });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105 text-sm"
            >
              <Plus size={18} /> Nueva sesión
            </button>
          </div>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center justify-between gap-3 mb-4 bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 flex-wrap gap-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              aria-label="Período anterior"
              className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-base font-bold text-slate-800 min-w-[170px] text-center">{getNavLabel()}</h2>
            <button
              onClick={goForward}
              aria-label="Período siguiente"
              className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterTeamId ?? ''}
              onChange={(e) => setFilterTeamId(e.target.value || null)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">Todos los equipos</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {teamDisplayName(t)}
                </option>
              ))}
            </select>
            <div className="flex rounded-xl overflow-hidden border border-slate-200">
              {[
                ['month', 'Mes'],
                ['week', 'Semana'],
                ['day', 'Día'],
              ].map(([mode, label], i) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-2 text-xs font-bold transition-colors ${viewMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'} ${i > 0 ? 'border-l border-slate-200' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar views */}
        {viewMode === 'month' && (
          <MonthGrid
            calendarDays={calendarDays}
            todayYMD={todayYMD}
            loading={loading}
            onSelectSession={editor.setSelectedSession}
            getTrainingNum={getTrainingNum}
          />
        )}
        {viewMode === 'week' && (
          <WeekView
            weekDays={weekDays}
            todayYMD={todayYMD}
            loading={loading}
            onSelectSession={editor.setSelectedSession}
            getTrainingNum={getTrainingNum}
          />
        )}
        {viewMode === 'day' && (
          <DayView
            sessions={daySessionList}
            loading={loading}
            currentDate={currentDate}
            onSelectSession={editor.setSelectedSession}
            getTrainingNum={getTrainingNum}
          />
        )}
      </div>

      {/* Session detail modal */}
      {editor.selectedSession && !editor.editingSession && (
        <SessionDetailModal
          session={editor.selectedSession}
          teams={teams}
          getTrainingNum={getTrainingNum}
          creatingTraining={editor.creatingTraining}
          onClose={() => editor.setSelectedSession(null)}
          onEdit={() => {
            editor.setSessionErrors({});
            editor.setEditingSession({ ...editor.selectedSession });
          }}
          onDelete={editor.handleDeleteRequest}
          onCreateTraining={editor.handleCreateTraining}
        />
      )}

      {/* Session form modal */}
      {editor.editingSession && (
        <SessionFormModal
          editingSession={editor.editingSession}
          setEditingSession={editor.setEditingSession}
          teams={teams}
          filterTeam={filterTeam}
          filterTeamId={filterTeamId}
          sessionErrors={editor.sessionErrors}
          setSessionErrors={editor.setSessionErrors}
          savingSession={editor.savingSession}
          getTrainingNum={getTrainingNum}
          onSubmit={editor.handleSaveSession}
          onClose={() => editor.setEditingSession(null)}
        />
      )}

      {/* Delete confirmation */}
      {editor.deletingId && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
          onClick={() => editor.setDeletingId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-2 text-slate-800">
              {typeof editor.deletingId === 'object' && editor.deletingId?.tipo === 'playoff'
                ? '¿Quitar del calendario?'
                : '¿Eliminar sesión?'}
            </h3>
            <p className="text-slate-600 mb-6 text-sm">
              {typeof editor.deletingId === 'object' && editor.deletingId?.tipo === 'playoff'
                ? 'Se borrarán la fecha, hora y lugar del partido en el cuadro. El cruce del torneo no se elimina.'
                : 'El entrenamiento vinculado no se borrará.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => editor.setDeletingId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => editor.handleDelete(editor.deletingId)}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurrence choice dialog */}
      <RecurrenceChoiceDialog
        open={editor.recurrenceAction !== null}
        mode={editor.recurrenceAction?.mode || 'edit'}
        onChoice={editor.handleRecurrenceChoice}
      />

      {/* Import setup modal */}
      {importer.importSetup && !importer.importing && (
        <ImportSetupModal
          importSetup={importer.importSetup}
          setImportSetup={importer.setImportSetup}
          fileInputRef={importer.fileInputRef}
        />
      )}

      {/* Import preview / processing modal */}
      {(importer.importing || importer.importPreview || importer.importError) && !importer.duplicateConflict && (
        <ImportPreviewModal
          importing={importer.importing}
          importPreview={importer.importPreview}
          importError={importer.importError}
          bulkSaving={importer.bulkSaving}
          teams={teams}
          setImportPreview={importer.setImportPreview}
          setImportError={importer.setImportError}
          onRequestImport={importer.handleRequestImport}
          expandRecurring={importer.expandRecurring}
        />
      )}

      {/* Duplicate conflict modal */}
      {importer.duplicateConflict && (
        <DuplicateConflictModal
          duplicateConflict={importer.duplicateConflict}
          importPreview={importer.importPreview}
          bulkSaving={importer.bulkSaving}
          onImport={importer.doImport}
          onCancel={() => importer.setDuplicateConflict(null)}
        />
      )}
    </div>
  );
}
