import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, BookOpen, Save, X, Printer, Undo, Maximize2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams, subscribeToMembers } from '../services/teamsService';
import { subscribeToTrainings, saveTraining, subscribeToExercises, saveExercise } from '../services/trainingsService';
import { subscribeToProfile } from '../services/settingsService';
import { teamDisplayName } from './TeamsScreen';
import MentionTextarea from '../components/MentionTextarea';
import CourtCanvas, { COURT_TOOLS } from '../components/CourtCanvas';
import ClubLogo from '../components/ClubLogo';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTemporada() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

const DIAS = [
  { val: 'L', label: 'L' },
  { val: 'M', label: 'M' },
  { val: 'X', label: 'X' },
  { val: 'J', label: 'J' },
  { val: 'V', label: 'V' },
  { val: 'S', label: 'S' },
  { val: 'D', label: 'D' },
];

function makeEjercicio() {
  return { id: crypto.randomUUID(), tiempo: '', contenido: '', descripcion: '', tipoPista: 'media', elementos: [] };
}

function EMPTY_TRAINING(numero = 1) {
  return {
    meta: { numero, dia: '', fecha: '', horaInicio: '', horaFin: '', lugar: '' },
    objetivos: '',
    ejercicios: [
      { ...makeEjercicio(), tipoPista: 'entera' },
      { ...makeEjercicio(), tipoPista: 'entera' },
      { ...makeEjercicio(), tipoPista: 'entera' },
      makeEjercicio(),
      makeEjercicio(),
      makeEjercicio(),
      makeEjercicio(),
    ],
    cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
  };
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TrainingEditorScreen() {
  const { teamId, trainingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [training, setTraining] = useState(null);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [modalEjercicioId, setModalEjercicioId] = useState(null);
  const [activeTool, setActiveTool] = useState('O');
  const [showLibrary, setShowLibrary] = useState(null);
  const [librarySearch, setLibrarySearch] = useState('');

  const saveTimerRef = useRef(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, (data) => {
      setTeam(data.find((t) => t.id === teamId) || null);
    });
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToMembers(teamId, user.uid, db, appId, setMembers);
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToExercises(user.uid, db, appId, setExercises);
  }, [user, db, appId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToProfile(user.uid, db, appId, setProfile);
  }, [user, db, appId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTrainings(teamId, user.uid, db, appId, (data) => {
      const found = data.find((t) => t.id === trainingId);
      if (isFirstLoad.current) {
        setTraining(
          found
            ? { ...found, ejercicios: (found.ejercicios || []).map((e) => ({ ...e, elementos: e.elementos || [] })) }
            : { id: trainingId, teamId, ...EMPTY_TRAINING() },
        );
        isFirstLoad.current = false;
      }
      setLoading(false);
    });
  }, [user, db, appId, teamId, trainingId]);

  const triggerSave = useCallback(
    (t) => {
      setSaveStatus('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await saveTraining(t, teamId, { uid: user.uid, db, appId });
          setSaveStatus('saved');
        } catch {
          setSaveStatus('saved');
        }
      }, 1500);
    },
    [teamId, user, db, appId],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function updateTraining(updater) {
    setTraining((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      triggerSave(next);
      return next;
    });
  }

  function updateMeta(field, value) {
    updateTraining((t) => ({ ...t, meta: { ...t.meta, [field]: value } }));
  }

  function updateCierre(field, value) {
    updateTraining((t) => ({ ...t, cierre: { ...t.cierre, [field]: value } }));
  }

  function addEjercicio() {
    updateTraining((t) => ({ ...t, ejercicios: [...(t.ejercicios || []), makeEjercicio()] }));
  }

  function removeLastEjercicio() {
    updateTraining((t) => {
      if ((t.ejercicios || []).length <= 1) return t;
      return { ...t, ejercicios: t.ejercicios.slice(0, -1) };
    });
  }

  function removeEjercicio(id) {
    updateTraining((t) => {
      if ((t.ejercicios || []).length <= 1) return t;
      return { ...t, ejercicios: t.ejercicios.filter((e) => e.id !== id) };
    });
  }

  function updateEjercicio(id, field, value) {
    updateTraining((t) => ({
      ...t,
      ejercicios: t.ejercicios.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  }

  function loadFromLibrary(ejercicioId, libExercise) {
    updateTraining((t) => ({
      ...t,
      ejercicios: t.ejercicios.map((e) =>
        e.id === ejercicioId
          ? {
              ...e,
              contenido: libExercise.contenido || e.contenido,
              descripcion: libExercise.descripcion || e.descripcion,
              tipoPista: libExercise.tipoPista || e.tipoPista,
              elementos: libExercise.elementos || [],
              libExerciseId: libExercise.id,
              libExerciseName: libExercise.nombre,
            }
          : e,
      ),
    }));
    setShowLibrary(null);
    setLibrarySearch('');
  }

  async function saveToLibrary(ejercicio) {
    const nombre = window.prompt('Nombre para guardar en biblioteca:', ejercicio.contenido || '');
    if (!nombre) return;
    await saveExercise(
      {
        id: crypto.randomUUID(),
        nombre: nombre.trim(),
        contenido: ejercicio.contenido,
        descripcion: ejercicio.descripcion,
        tipoPista: ejercicio.tipoPista,
        elementos: ejercicio.elementos || [],
      },
      { uid: user.uid, db, appId },
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!training) return null;

  const ejercicios = training.ejercicios || [];
  const ejModal = ejercicios.find((e) => e.id === modalEjercicioId);
  const clubName = profile?.nombreClub?.trim() || 'Uros de Rivas';
  const temporada = getTemporada();
  const libraryFiltered = exercises.filter(
    (ex) =>
      ex.nombre?.toLowerCase().includes(librarySearch.toLowerCase()) ||
      ex.contenido?.toLowerCase().includes(librarySearch.toLowerCase()),
  );

  const TOOLS = COURT_TOOLS;

  return (
    <div className="min-h-screen bg-gray-200 py-6 px-4 font-sans text-black print:bg-white print:p-0 print:py-0">
      {/* ─── TOOLBAR WEB ─── */}
      <div className="max-w-[820px] mx-auto mb-4 flex items-center justify-between print:hidden gap-3">
        <button
          onClick={() => navigate(`/teams/${teamId}/trainings`)}
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Entrenamientos
        </button>

        <div className="flex gap-2">
          <button
            onClick={addEjercicio}
            className="flex items-center px-3 py-1.5 bg-white border border-gray-300 text-sm hover:bg-gray-50 transition shadow-sm rounded-lg gap-1"
          >
            <Plus size={14} /> Fila Extra
          </button>
          <button
            onClick={removeLastEjercicio}
            className="flex items-center px-3 py-1.5 bg-white border border-red-300 text-red-700 text-sm hover:bg-red-50 transition shadow-sm rounded-lg gap-1"
          >
            <Minus size={14} /> Quitar Fila
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium transition-colors ${saveStatus === 'saving' ? 'text-amber-500' : 'text-emerald-600'}`}
          >
            {saveStatus === 'saving' ? 'Guardando...' : '✓ Guardado'}
          </span>
          <button
            onClick={() => navigate('/exercises')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition"
          >
            <BookOpen size={15} /> Biblioteca
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition shadow"
          >
            <Printer size={15} /> Imprimir A4
          </button>
        </div>
      </div>

      {/* ─── DOCUMENTO A4 ─── */}
      <div className="max-w-[820px] mx-auto bg-white border border-gray-400 p-6 shadow-xl print:shadow-none print:border-none print:p-4 print:max-w-none">
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
                className="w-10 border-b border-black text-center focus:outline-none bg-transparent"
              />
            </p>
          </div>
        </div>

        {/* Metadatos */}
        <div className="border border-black flex flex-col mb-4 text-sm">
          <div className="flex border-b border-black">
            {/* Equipo */}
            <div className="flex-1 border-r border-black p-1.5 flex items-center">
              <span className="font-bold whitespace-nowrap">Equipo.-</span>
              <input
                type="text"
                value={training.meta?.equipo || ''}
                onChange={(e) => updateMeta('equipo', e.target.value)}
                className="w-full ml-2 focus:outline-none bg-transparent"
              />
            </div>
            {/* Fecha */}
            <div className="w-52 border-r border-black p-1.5 flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Fecha.-</span>
              <select
                value={training.meta?.dia || ''}
                onChange={(e) => updateMeta('dia', e.target.value)}
                className="ml-1 text-xs bg-transparent focus:outline-none cursor-pointer font-bold appearance-none"
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
                className="flex-1 focus:outline-none bg-transparent text-xs [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
            {/* Hora */}
            <div className="w-48 border-r border-black p-1.5 flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Hora.-</span>
              <input
                type="time"
                value={training.meta?.horaInicio || ''}
                onChange={(e) => updateMeta('horaInicio', e.target.value)}
                className="flex-1 focus:outline-none bg-transparent text-xs [&::-webkit-calendar-picker-indicator]:hidden"
              />
              <span className="font-bold">-</span>
              <input
                type="time"
                value={training.meta?.horaFin || ''}
                onChange={(e) => updateMeta('horaFin', e.target.value)}
                className="flex-1 focus:outline-none bg-transparent text-xs [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
            {/* Lugar */}
            <div className="flex-1 p-1.5 flex items-center">
              <span className="font-bold whitespace-nowrap">Lugar.-</span>
              <input
                type="text"
                value={training.meta?.lugar || ''}
                onChange={(e) => updateMeta('lugar', e.target.value)}
                className="w-full ml-2 focus:outline-none bg-transparent"
              />
            </div>
          </div>
          {/* Objetivos */}
          <div className="p-1.5 flex flex-col min-h-[52px]">
            <span className="font-bold">Objetivos de la semana.-</span>
            <textarea
              value={training.objetivos || ''}
              onChange={(e) => updateTraining((t) => ({ ...t, objetivos: e.target.value }))}
              className="w-full flex-1 focus:outline-none bg-transparent resize-none leading-tight mt-1 text-sm"
            />
          </div>
        </div>

        {/* Tabla ejercicios */}
        <div className="border border-black flex flex-col mb-4 text-sm">
          {/* Cabecera columnas */}
          <div className="flex border-b border-black font-bold text-center bg-gray-50 print:bg-transparent">
            <div className="w-14 border-r border-black p-1 text-xs">Tiempo</div>
            <div className="w-32 border-r border-black p-1 text-xs">Contenido</div>
            <div className="flex-1 border-r border-black p-1 text-xs text-left pl-2">Ejercicio</div>
            <div className="w-40 p-1 text-xs">Pizarra</div>
          </div>

          {ejercicios.map((ej) => (
            <div key={ej.id} className="group relative flex border-b border-black last:border-b-0 min-h-[100px]">
              {/* Tiempo */}
              <div className="w-14 border-r border-black p-1">
                <input
                  type="text"
                  value={ej.tiempo || ''}
                  onChange={(e) => updateEjercicio(ej.id, 'tiempo', e.target.value)}
                  className="w-full h-full text-center focus:outline-none bg-transparent text-xs"
                />
              </div>
              {/* Contenido */}
              <div className="w-32 border-r border-black p-1 relative">
                {ej.libExerciseId && (
                  <span
                    className="absolute top-1 right-1 print:hidden"
                    title={`Enlazado: ${ej.libExerciseName || 'Biblioteca'}`}
                  >
                    <BookOpen size={9} className="text-amber-500" />
                  </span>
                )}
                <textarea
                  value={ej.contenido || ''}
                  onChange={(e) => updateEjercicio(ej.id, 'contenido', e.target.value)}
                  className="w-full h-full resize-none focus:outline-none bg-transparent leading-tight text-xs"
                />
              </div>
              {/* Descripción */}
              <div className="flex-1 border-r border-black p-1">
                <textarea
                  value={ej.descripcion || ''}
                  onChange={(e) => updateEjercicio(ej.id, 'descripcion', e.target.value)}
                  className="w-full h-full resize-none focus:outline-none bg-transparent leading-tight text-xs text-justify pb-2 pr-1"
                />
              </div>
              {/* Pizarra miniatura */}
              <div className="w-40 flex flex-col items-center justify-center relative bg-white overflow-hidden">
                <div
                  className="w-full h-full max-h-[110px] p-1 cursor-pointer hover:bg-gray-50 transition print:cursor-default"
                  onClick={() => setModalEjercicioId(ej.id)}
                >
                  <CourtCanvas tipo={ej.tipoPista} elementos={ej.elementos || []} readOnly={true} />
                </div>
                {/* Controles flotantes — ocultos al imprimir */}
                <div className="absolute bottom-1 right-1 flex gap-1 print:hidden opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white p-1 rounded border border-gray-200 shadow-sm">
                  <button
                    onClick={() => setModalEjercicioId(ej.id)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Abrir editor"
                  >
                    <Maximize2 size={11} />
                  </button>
                  <button
                    onClick={() => {
                      setShowLibrary(ej.id);
                      setLibrarySearch('');
                    }}
                    className="text-indigo-500 hover:text-indigo-700"
                    title="Cargar de biblioteca"
                  >
                    <BookOpen size={11} />
                  </button>
                  <button
                    onClick={() => saveToLibrary(ej)}
                    className="text-emerald-600 hover:text-emerald-800"
                    title="Guardar en biblioteca"
                  >
                    <Save size={11} />
                  </button>
                  <select
                    value={ej.tipoPista}
                    onChange={(e) => updateEjercicio(ej.id, 'tipoPista', e.target.value)}
                    className="text-[10px] border border-gray-300 bg-white cursor-pointer focus:outline-none"
                  >
                    <option value="media">1/2</option>
                    <option value="entera">Full</option>
                  </select>
                  <button
                    onClick={() => removeEjercicio(ej.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Eliminar fila"
                  >
                    <Trash2 size={11} />
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
                rows={2}
                className="w-full flex-1 focus:outline-none bg-transparent resize-none text-xs leading-tight mt-1"
              />
            </div>
            <div className="flex-1 p-1.5 flex flex-col">
              <span className="font-bold">Retrasos.-</span>
              <MentionTextarea
                value={training.cierre?.retrasos || ''}
                onChange={(e) => updateCierre('retrasos', e.target.value)}
                members={members}
                placeholder=""
                rows={2}
                className="w-full flex-1 focus:outline-none bg-transparent resize-none text-xs leading-tight mt-1"
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
                rows={2}
                className="w-full flex-1 focus:outline-none bg-transparent resize-none text-xs leading-tight mt-1"
              />
            </div>
            <div className="flex-1 p-1.5 flex flex-col">
              <span className="font-bold">Observaciones.-</span>
              <textarea
                value={training.cierre?.observaciones || ''}
                onChange={(e) => updateCierre('observaciones', e.target.value)}
                className="w-full flex-1 focus:outline-none bg-transparent resize-none text-xs leading-tight mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL PLAYBOOK EDITOR ─── */}
      {ejModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/90 flex flex-col items-center justify-center p-4 touch-none print:hidden">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Header modal */}
            <div className="flex flex-wrap justify-between items-center gap-2 p-3 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <h3 className="font-bold text-gray-800">Playbook Editor</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateEjercicio(ejModal.id, 'elementos', (ejModal.elementos || []).slice(0, -1))}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 rounded flex items-center text-sm"
                    title="Deshacer último"
                  >
                    <Undo size={14} className="mr-1" /> <span className="hidden sm:inline">Deshacer</span>
                  </button>
                  <button
                    onClick={() => updateEjercicio(ejModal.id, 'elementos', [])}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded flex items-center text-sm"
                    title="Limpiar pizarra"
                  >
                    <Trash2 size={14} className="mr-1" /> <span className="hidden sm:inline">Limpiar</span>
                  </button>
                  <div className="flex gap-1 border-l border-gray-300 pl-2 ml-1">
                    {[
                      ['media', 'Media'],
                      ['entera', 'Entera'],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => updateEjercicio(ejModal.id, 'tipoPista', val)}
                        className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-semibold transition-colors ${ejModal.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setModalEjercicioId(null)}
                className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row flex-1 overflow-hidden bg-gray-100">
              {/* Toolbar móvil */}
              <div className="flex sm:hidden flex-wrap gap-1 p-2 bg-white border-b border-gray-200 overflow-x-auto">
                {TOOLS.filter((t) => !t.divider).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${activeTool === t.id ? 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
                  >
                    <div className="w-5 flex justify-center shrink-0">{t.icon}</div>
                    <span className="leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
              {/* Sidebar herramientas (desktop) */}
              <div className="hidden sm:flex w-48 bg-white border-r border-gray-200 flex-col p-2 gap-1 overflow-y-auto">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mt-2 mb-1">Herramientas</p>
                {TOOLS.map((t, idx) =>
                  t.divider ? (
                    <div key={idx} className="h-px bg-gray-200 my-1 mx-2" />
                  ) : (
                    <button
                      key={t.id}
                      onClick={() => setActiveTool(t.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${activeTool === t.id ? 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
                    >
                      <div className="w-6 flex justify-center shrink-0">{t.icon}</div>
                      <span className="text-xs leading-tight">{t.label}</span>
                    </button>
                  ),
                )}
                <div className="mt-auto p-3 bg-blue-50 rounded text-xs text-blue-800 leading-relaxed border border-blue-100 mx-1">
                  <b>Tip:</b> Objetos: clic para colocar. Líneas: clic y arrastra.
                </div>
              </div>

              {/* Lienzo */}
              <div className="flex-1 flex items-center justify-center p-2 sm:p-6 select-none">
                <div className="bg-white shadow border border-gray-300 w-full h-full flex items-center justify-center">
                  <CourtCanvas
                    tipo={ejModal.tipoPista}
                    elementos={ejModal.elementos || []}
                    setElementos={(nuevos) => updateEjercicio(ejModal.id, 'elementos', nuevos)}
                    readOnly={false}
                    activeTool={activeTool}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL BIBLIOTECA ─── */}
      {showLibrary && (
        <div
          className="fixed inset-0 bg-slate-900/70 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm print:hidden"
          onClick={() => setShowLibrary(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={16} className="text-blue-600" /> Biblioteca de ejercicios
              </h3>
              <button onClick={() => setShowLibrary(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-slate-100">
              <input
                type="text"
                placeholder="Buscar..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {libraryFiltered.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-12">No hay ejercicios en la biblioteca.</p>
              ) : (
                libraryFiltered.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => loadFromLibrary(showLibrary, ex)}
                    className="w-full text-left px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors"
                  >
                    <p className="font-semibold text-slate-800 text-sm">{ex.nombre}</p>
                    {ex.contenido && <p className="text-xs text-indigo-500 font-semibold mt-0.5">{ex.contenido}</p>}
                    {ex.descripcion && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ex.descripcion}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
