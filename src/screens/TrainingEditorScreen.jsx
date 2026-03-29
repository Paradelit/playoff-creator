import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, BookOpen, Save, X, Printer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams } from '../services/teamsService';
import { subscribeToMembers } from '../services/teamsService';
import { subscribeToTrainings, saveTraining, subscribeToExercises, saveExercise } from '../services/trainingsService';
import { teamDisplayName } from './TeamsScreen';
import DrawableCourt from '../components/DrawableCourt';
import MentionTextarea from '../components/MentionTextarea';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const EMPTY_EJERCICIO = () => ({
  id: crypto.randomUUID(),
  tiempo: '',
  contenido: '',
  descripcion: '',
  tipoPista: 'media',
  trazos: [],
});

const EMPTY_TRAINING = (numero = 1) => ({
  meta: { numero, dia: '', fecha: '', horaInicio: '', horaFin: '', lugar: '' },
  objetivos: '',
  ejercicios: [],
  cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
});

export default function TrainingEditorScreen() {
  const { teamId, trainingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved'
  const [modalEjercicioId, setModalEjercicioId] = useState(null); // ejercicio expanded
  const [showLibrary, setShowLibrary] = useState(null); // ejercicio id that triggered library
  const [librarySearch, setLibrarySearch] = useState('');

  const saveTimerRef = useRef(null);
  const isFirstLoad = useRef(true);

  // Subscriptions
  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, data => {
      setTeam(data.find(t => t.id === teamId) || null);
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
    return subscribeToTrainings(teamId, user.uid, db, appId, data => {
      const found = data.find(t => t.id === trainingId);
      if (found && isFirstLoad.current) {
        setTraining(found);
        isFirstLoad.current = false;
      } else if (!found && isFirstLoad.current) {
        setTraining({ id: trainingId, teamId, ...EMPTY_TRAINING() });
        isFirstLoad.current = false;
      }
      setLoading(false);
    });
  }, [user, db, appId, teamId, trainingId]);

  // Auto-save with debounce
  const triggerSave = useCallback((t) => {
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
  }, [teamId, user, db, appId]);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  function updateTraining(updater) {
    setTraining(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      triggerSave(next);
      return next;
    });
  }

  function updateMeta(field, value) {
    updateTraining(t => ({ ...t, meta: { ...t.meta, [field]: value } }));
  }

  function updateCierre(field, value) {
    updateTraining(t => ({ ...t, cierre: { ...t.cierre, [field]: value } }));
  }

  function addEjercicio() {
    updateTraining(t => ({ ...t, ejercicios: [...(t.ejercicios || []), EMPTY_EJERCICIO()] }));
  }

  function removeEjercicio(id) {
    updateTraining(t => ({ ...t, ejercicios: t.ejercicios.filter(e => e.id !== id) }));
  }

  function updateEjercicio(id, field, value) {
    updateTraining(t => ({
      ...t,
      ejercicios: t.ejercicios.map(e => e.id === id ? { ...e, [field]: value } : e),
    }));
  }

  function loadFromLibrary(ejercicioId, libExercise) {
    updateTraining(t => ({
      ...t,
      ejercicios: t.ejercicios.map(e => e.id === ejercicioId ? {
        ...e,
        contenido: libExercise.contenido || e.contenido,
        descripcion: libExercise.descripcion || e.descripcion,
        tipoPista: libExercise.tipoPista || e.tipoPista,
        trazos: libExercise.trazos || e.trazos,
      } : e),
    }));
    setShowLibrary(null);
    setLibrarySearch('');
  }

  async function saveToLibrary(ejercicio) {
    const nombre = window.prompt('Nombre para guardar en biblioteca:', ejercicio.contenido || '');
    if (!nombre) return;
    await saveExercise({
      id: crypto.randomUUID(),
      nombre: nombre.trim(),
      contenido: ejercicio.contenido,
      descripcion: ejercicio.descripcion,
      tipoPista: ejercicio.tipoPista,
      trazos: ejercicio.trazos || [],
    }, { uid: user.uid, db, appId });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!training) return null;

  const ejercicios = training.ejercicios || [];
  const expandedEjercicio = ejercicios.find(e => e.id === modalEjercicioId);
  const libraryFiltered = exercises.filter(ex =>
    ex.nombre?.toLowerCase().includes(librarySearch.toLowerCase()) ||
    ex.contenido?.toLowerCase().includes(librarySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans print:bg-white print:min-h-0">

      {/* Barra de navegación — oculta al imprimir */}
      <div className="print:hidden bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={() => navigate(`/teams/${teamId}/trainings`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Entrenamientos
        </button>
        <div className="flex items-center gap-4">
          <span className={`text-xs font-medium transition-colors ${saveStatus === 'saving' ? 'text-amber-500' : 'text-emerald-600'}`}>
            {saveStatus === 'saving' ? 'Guardando...' : '✓ Guardado'}
          </span>
          <button
            onClick={() => navigate('/exercises')}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition"
          >
            <BookOpen size={15} /> Biblioteca
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition"
          >
            <Printer size={15} /> Imprimir A4
          </button>
        </div>
      </div>

      {/* Cuerpo A4 */}
      <div className="max-w-[800px] mx-auto bg-white p-6 my-6 rounded-2xl shadow-lg print:shadow-none print:rounded-none print:my-0 print:p-6">

        {/* ─── CABECERA FICHA ─── */}
        <div className="border-b-2 border-slate-800 pb-4 mb-4 print:border-slate-900">
          <div className="flex items-end justify-between gap-2 mb-3">
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Ficha de Entrenamiento</h1>
            <p className="text-sm font-semibold text-slate-600">{team ? teamDisplayName(team) : ''}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            <MetaField label="Nº" value={training.meta?.numero || ''} onChange={v => updateMeta('numero', v)} type="number" />
            <MetaField label="Día"
              value={training.meta?.dia || ''}
              onChange={v => updateMeta('dia', v)}
              select options={DIAS}
            />
            <MetaField label="Fecha" value={training.meta?.fecha || ''} onChange={v => updateMeta('fecha', v)} type="date" />
            <MetaField label="Hora inicio" value={training.meta?.horaInicio || ''} onChange={v => updateMeta('horaInicio', v)} type="time" />
            <MetaField label="Hora fin" value={training.meta?.horaFin || ''} onChange={v => updateMeta('horaFin', v)} type="time" />
            <MetaField label="Lugar" value={training.meta?.lugar || ''} onChange={v => updateMeta('lugar', v)} />
          </div>
        </div>

        {/* ─── OBJETIVOS ─── */}
        <Section title="Objetivos">
          <textarea
            value={training.objetivos || ''}
            onChange={e => updateTraining(t => ({ ...t, objetivos: e.target.value }))}
            placeholder="Objetivos de la sesión..."
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none print:border-slate-400"
          />
        </Section>

        {/* ─── EJERCICIOS ─── */}
        <Section title="Ejercicios">
          {ejercicios.length === 0 && (
            <p className="text-slate-400 text-sm italic mb-3">Sin ejercicios. Añade uno abajo.</p>
          )}
          <div className="flex flex-col gap-4">
            {ejercicios.map((ej, idx) => (
              <EjercicioRow
                key={ej.id}
                ej={ej}
                idx={idx}
                onUpdate={(field, val) => updateEjercicio(ej.id, field, val)}
                onRemove={() => removeEjercicio(ej.id)}
                onExpand={() => setModalEjercicioId(ej.id)}
                onOpenLibrary={() => { setShowLibrary(ej.id); setLibrarySearch(''); }}
                onSaveToLibrary={() => saveToLibrary(ej)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addEjercicio}
            className="mt-3 flex items-center gap-2 text-blue-600 font-bold text-sm hover:text-blue-800 transition print:hidden"
          >
            <Plus size={16} /> Añadir ejercicio
          </button>
        </Section>

        {/* ─── CIERRE ─── */}
        <Section title="Cierre de sesión">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CierreField label="Faltas">
              <MentionTextarea
                value={training.cierre?.faltas || ''}
                onChange={e => updateCierre('faltas', e.target.value)}
                members={members}
                placeholder="Jugadores que han faltado..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none print:border-slate-400"
              />
            </CierreField>
            <CierreField label="Retrasos">
              <MentionTextarea
                value={training.cierre?.retrasos || ''}
                onChange={e => updateCierre('retrasos', e.target.value)}
                members={members}
                placeholder="Jugadores que han llegado tarde..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none print:border-slate-400"
              />
            </CierreField>
            <CierreField label="Anotaciones">
              <MentionTextarea
                value={training.cierre?.anotaciones || ''}
                onChange={e => updateCierre('anotaciones', e.target.value)}
                members={members}
                placeholder="Anotaciones del entrenamiento..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none print:border-slate-400"
              />
            </CierreField>
            <CierreField label="Observaciones">
              <textarea
                value={training.cierre?.observaciones || ''}
                onChange={e => updateCierre('observaciones', e.target.value)}
                placeholder="Observaciones del entrenador..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none print:border-slate-400"
              />
            </CierreField>
          </div>
        </Section>

      </div>

      {/* ─── MODAL pizarra expandida ─── */}
      {expandedEjercicio && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden" onClick={() => setModalEjercicioId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-bold text-slate-800">Pizarra — {expandedEjercicio.contenido || `Ejercicio ${(ejercicios.findIndex(e => e.id === expandedEjercicio.id) + 1)}`}</h3>
              <button onClick={() => setModalEjercicioId(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex gap-2 print:hidden">
                {[['media', 'Media pista'], ['entera', 'Pista entera']].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => updateEjercicio(expandedEjercicio.id, 'tipoPista', val)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${expandedEjercicio.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <DrawableCourt
                tipo={expandedEjercicio.tipoPista}
                trazos={expandedEjercicio.trazos || []}
                setTrazos={t => updateEjercicio(expandedEjercicio.id, 'trazos', typeof t === 'function' ? t(expandedEjercicio.trazos || []) : t)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL biblioteca de ejercicios ─── */}
      {showLibrary && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm print:hidden" onClick={() => setShowLibrary(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><BookOpen size={16} className="text-blue-600" /> Biblioteca de ejercicios</h3>
              <button onClick={() => setShowLibrary(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-4 py-3 border-b border-slate-100">
              <input
                type="text"
                placeholder="Buscar..."
                value={librarySearch}
                onChange={e => setLibrarySearch(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {libraryFiltered.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-12">No hay ejercicios en la biblioteca.</p>
              ) : (
                libraryFiltered.map(ex => (
                  <button
                    key={ex.id}
                    type="button"
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

// ─── Subcomponentes ───

function MetaField({ label, value, onChange, type = 'text', select, options }) {
  const cls = "border-b border-slate-400 bg-transparent text-sm focus:outline-none focus:border-blue-500 w-full py-1 print:border-slate-600";
  return (
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      {select ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={cls + " bg-white"}>
          <option value="">—</option>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 border-b border-slate-200 pb-1">{title}</h2>
      {children}
    </div>
  );
}

function CierreField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function EjercicioRow({ ej, idx, onUpdate, onRemove, onExpand, onOpenLibrary, onSaveToLibrary }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-400">
      {/* Cabecera fila */}
      <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 print:bg-white border-b border-slate-200 print:border-slate-400">
        <span className="text-xs font-black text-slate-500 w-5">{idx + 1}</span>
        <input
          type="number"
          min="1"
          value={ej.tiempo || ''}
          onChange={e => onUpdate('tiempo', e.target.value)}
          placeholder="min"
          className="w-14 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 text-center print:border-slate-400"
          title="Duración en minutos"
        />
        <input
          type="text"
          value={ej.contenido || ''}
          onChange={e => onUpdate('contenido', e.target.value)}
          placeholder="Contenido / categoría"
          className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 print:border-slate-400"
        />
        <div className="flex items-center gap-1 shrink-0 print:hidden">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="text-indigo-500 hover:text-indigo-700 p-1.5 hover:bg-indigo-50 rounded-lg transition text-xs font-semibold flex items-center gap-1"
            title="Cargar desde biblioteca"
          >
            <BookOpen size={13} />
          </button>
          <button
            type="button"
            onClick={onSaveToLibrary}
            className="text-emerald-600 hover:text-emerald-800 p-1.5 hover:bg-emerald-50 rounded-lg transition"
            title="Guardar en biblioteca"
          >
            <Save size={13} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition"
            title="Eliminar ejercicio"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Cuerpo fila */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {/* Descripción */}
        <div className="p-3">
          <textarea
            value={ej.descripcion || ''}
            onChange={e => onUpdate('descripcion', e.target.value)}
            placeholder="Descripción del ejercicio..."
            rows={4}
            className="w-full text-sm focus:outline-none resize-none text-slate-700 placeholder-slate-300"
          />
        </div>

        {/* Pizarra */}
        <div className="p-3 flex flex-col gap-2">
          <div className="flex gap-2 print:hidden">
            {[['media', 'Media'], ['entera', 'Entera']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onUpdate('tipoPista', val)}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors ${ej.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={onExpand}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition print:hidden"
            >
              Ampliar
            </button>
          </div>
          <DrawableCourt
            tipo={ej.tipoPista}
            trazos={ej.trazos || []}
            setTrazos={t => onUpdate('trazos', typeof t === 'function' ? t(ej.trazos || []) : t)}
          />
        </div>
      </div>
    </div>
  );
}
