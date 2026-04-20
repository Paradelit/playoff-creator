import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Printer, RotateCcw, Plus, Trash2 } from 'lucide-react';
import ClubLogo from '../components/ClubLogo';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToAnalysis, saveAnalysis } from '../services/analysisService';
import { updatePlayoffMatchScoreFromSession } from '../services/bracketCalendarSyncService';
import { userDocRef } from '../services/firestoreHelpers';
import { useProfile } from '../hooks/useProfile';
import { useTeams } from '../hooks/useTeams';
import { teamDisplayName } from '../utils/teamUtils';
import { getTemporada, formatDateDisplay } from '../utils/dateUtils';
import ConfirmDialog from '../components/ConfirmDialog';

function getPlayoffResultado(session) {
  if (session?.tipo !== 'playoff' || !Array.isArray(session?.scores)) return { local: '', visitante: '' };
  const sc = session.scores[session.gameIndex || 0];
  if (!sc) return { local: '', visitante: '' };
  const local = session.isMyTeamTeam1 ? sc.s1 : sc.s2;
  const visitante = session.isMyTeamTeam1 ? sc.s2 : sc.s1;
  return { local: local ?? '', visitante: visitante ?? '' };
}

function emptyAnalysisData(session) {
  return {
    teamId: session?.teamId || '',
    sessionId: session?.id || '',
    rival: session?.rival || '',
    fecha: session?.fecha || '',
    resultado: getPlayoffResultado(session),
    funcionoBien: '',
    mejorar: '',
    jugadoresDestacados: [],
    estadisticas: {
      tirosCampo: '',
      tirosLibres: '',
      rebotes: '',
      perdidas: '',
      asistencias: '',
    },
    notasLibres: '',
    planSiguiente: '',
  };
}

export default function AnalysisScreen() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [session, setSession] = useState(null);
  const { teams } = useTeams();
  const { profile } = useProfile();
  const team = session?.teamId ? teams.find((t) => t.id === session.teamId) || null : null;

  const [data, setData] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const debounceRef = useRef(null);
  const initializedRef = useRef(false);

  // Load session (from Firestore or from route state for virtual playoff sessions).
  // For playoff sessions, subscribe to the bracket so scores/dates stay in sync live.
  useEffect(() => {
    if (!user || !db || !sessionId) return;
    const ref = userDocRef(db, appId, user.uid, 'calendarSessions', sessionId);
    let unsubBracket = null;
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setSession({ ...snap.data(), id: snap.id });
        return;
      }
      const virtual = location.state?.playoffSession;
      if (!virtual) return;
      setSession({ ...virtual, id: sessionId });
      if (virtual.bracketId && virtual.bracketMatchId) {
        const bRef = userDocRef(db, appId, user.uid, 'brackets', virtual.bracketId);
        unsubBracket = onSnapshot(bRef, (bSnap) => {
          if (!bSnap.exists()) return;
          const bracketDoc = bSnap.data();
          const match = bracketDoc.bracketData?.state?.[virtual.bracketMatchId];
          if (!match) return;
          setSession((prev) => (prev ? { ...prev, scores: match.scores || prev.scores } : prev));
        });
      }
    });
    return () => {
      if (unsubBracket) unsubBracket();
    };
  }, [user, db, appId, sessionId, location.state]);

  // Load or create analysis
  useEffect(() => {
    if (!user || !db || !sessionId || !session) return;
    return subscribeToAnalysis(sessionId, { uid: user.uid, db, appId }, (analysis) => {
      const empty = emptyAnalysisData(session);
      if (initializedRef.current) {
        if (session.tipo === 'playoff') {
          const bracketRes = getPlayoffResultado(session);
          setData((prev) =>
            prev && (prev.resultado?.local !== bracketRes.local || prev.resultado?.visitante !== bracketRes.visitante)
              ? { ...prev, resultado: bracketRes }
              : prev,
          );
        }
        return;
      }
      const loaded = analysis
        ? session.tipo === 'playoff'
          ? { ...analysis, resultado: empty.resultado }
          : analysis
        : empty;
      setData(loaded);
      if (loaded.estadisticas && Object.values(loaded.estadisticas).some((v) => v)) {
        setShowStats(true);
      }
      initializedRef.current = true;
      setLoading(false);
    });
  }, [user, db, appId, sessionId, session]);

  function triggerSave(newData) {
    setSaveStatus('unsaved');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveAnalysis(newData, sessionId, { uid: user.uid, db, appId });
      if (session?.tipo === 'playoff' && session?.bracketId && session?.bracketMatchId) {
        try {
          await updatePlayoffMatchScoreFromSession(
            {
              bracketId: session.bracketId,
              bracketMatchId: session.bracketMatchId,
              gameIndex: session.gameIndex || 0,
              isMyTeamTeam1: session.isMyTeamTeam1,
            },
            { local: newData.resultado?.local ?? '', visitante: newData.resultado?.visitante ?? '' },
            { uid: user.uid, db, appId },
          );
        } catch (err) {
          console.error('Error syncing playoff score to bracket:', err);
        }
      }
      setSaveStatus('saved');
    }, 1500);
  }

  function update(field, value) {
    const updated = { ...data, [field]: value };
    setData(updated);
    triggerSave(updated);
  }

  function updateResultado(side, value) {
    const updated = { ...data, resultado: { ...data.resultado, [side]: value } };
    setData(updated);
    triggerSave(updated);
  }

  function updateStat(field, value) {
    const updated = { ...data, estadisticas: { ...data.estadisticas, [field]: value } };
    setData(updated);
    triggerSave(updated);
  }

  function addJugadorDestacado() {
    const updated = {
      ...data,
      jugadoresDestacados: [...data.jugadoresDestacados, { nombre: '', notas: '' }],
    };
    setData(updated);
    triggerSave(updated);
  }

  function updateJugadorDestacado(index, field, value) {
    const jugadores = data.jugadoresDestacados.map((j, i) => (i === index ? { ...j, [field]: value } : j));
    const updated = { ...data, jugadoresDestacados: jugadores };
    setData(updated);
    triggerSave(updated);
  }

  function removeJugadorDestacado(index) {
    const updated = { ...data, jugadoresDestacados: data.jugadoresDestacados.filter((_, i) => i !== index) };
    setData(updated);
    triggerSave(updated);
  }

  function confirmReset() {
    setShowResetConfirm(false);
    const fresh = emptyAnalysisData(session);
    setData(fresh);
    triggerSave(fresh);
  }

  const clubName = profile.nombreClub || 'Uros de Rivas';
  const temporada = getTemporada();
  const esLocal = session?.esLocal;

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const localScore = data.resultado?.local ?? '';
  const visitanteScore = data.resultado?.visitante ?? '';

  return (
    <div className="min-h-screen bg-gray-200 font-sans text-black print:bg-white print:p-0">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm px-4 py-2.5 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {saveStatus === 'saving' && 'Guardando...'}
            {saveStatus === 'saved' && '✓ Guardado'}
          </span>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center px-3 py-1 bg-white border border-gray-400 text-gray-700 text-sm hover:bg-gray-50 transition shadow-sm rounded"
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Limpiar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>

      {/* Documento */}
      <div className="py-8 px-4 print:p-0 pb-24">
        <div className="max-w-[800px] mx-auto bg-white border border-gray-400 pt-10 pb-10 px-12 shadow-xl print:shadow-none print:border-none print:m-0 print:p-8">
          {/* Cabecera */}
          <div className="flex justify-between items-start mb-6">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-xl tracking-wider uppercase">{clubName}</h1>
              <p className="text-sm text-gray-500 mt-1 font-sans">Análisis Post-Partido</p>
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2 font-sans">
              <p>Temporada {temporada}</p>
              {team && <p className="italic text-xs text-gray-500 mt-0.5">{teamDisplayName(team)}</p>}
            </div>
          </div>

          {/* Resultado */}
          <div className="border border-gray-300 rounded-xl p-5 mb-6 bg-gradient-to-r from-blue-50 to-rose-50">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                  {esLocal ? (team ? teamDisplayName(team) : 'Local') : data.rival || 'Visitante'}
                </p>
                <input
                  type="number"
                  value={esLocal ? localScore : visitanteScore}
                  onChange={(e) => updateResultado(esLocal ? 'local' : 'visitante', e.target.value)}
                  placeholder="—"
                  className="w-20 h-16 text-center text-3xl font-black border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <span className="text-2xl font-bold text-gray-400 mt-5">—</span>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                  {esLocal ? data.rival || 'Visitante' : team ? teamDisplayName(team) : 'Local'}
                </p>
                <input
                  type="number"
                  value={esLocal ? visitanteScore : localScore}
                  onChange={(e) => updateResultado(esLocal ? 'visitante' : 'local', e.target.value)}
                  placeholder="—"
                  className="w-20 h-16 text-center text-3xl font-black border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              {data.fecha ? formatDateDisplay(data.fecha) : ''}
              {session?.lugar ? ` · ${session.lugar}` : ''}
            </p>
          </div>

          {/* Qué funcionó / Qué mejorar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Section title="Qué funcionó bien">
              <textarea
                value={data.funcionoBien}
                onChange={(e) => update('funcionoBien', e.target.value)}
                placeholder="Aspectos positivos del partido..."
                rows={5}
                className="w-full border border-green-200 bg-green-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              />
            </Section>
            <Section title="Qué mejorar">
              <textarea
                value={data.mejorar}
                onChange={(e) => update('mejorar', e.target.value)}
                placeholder="Aspectos a trabajar en próximos entrenamientos..."
                rows={5}
                className="w-full border border-rose-200 bg-rose-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              />
            </Section>
          </div>

          {/* Jugadores destacados */}
          <Section
            title="Jugadores destacados"
            action={
              <button
                onClick={addJugadorDestacado}
                className="print:hidden flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold transition"
              >
                <Plus size={14} /> Añadir
              </button>
            }
          >
            {data.jugadoresDestacados.length === 0 && (
              <p className="text-sm text-gray-400 italic">Sin jugadores destacados</p>
            )}
            <div className="flex flex-col gap-2">
              {data.jugadoresDestacados.map((j, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={j.nombre}
                    onChange={(e) => updateJugadorDestacado(i, 'nombre', e.target.value)}
                    placeholder="Nombre"
                    className="w-40 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <input
                    type="text"
                    value={j.notas}
                    onChange={(e) => updateJugadorDestacado(i, 'notas', e.target.value)}
                    placeholder="Notas (doble-doble, defensa, liderazgo...)"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => removeJugadorDestacado(i)}
                    className="print:hidden text-red-400 hover:text-red-600 p-1 transition"
                    aria-label="Eliminar jugador"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          {/* Estadísticas */}
          <div className="mb-6">
            <button
              onClick={() => setShowStats(!showStats)}
              className="print:hidden text-sm font-bold text-blue-600 hover:text-blue-800 mb-2 transition"
            >
              {showStats ? '▾ Ocultar estadísticas' : '▸ Añadir estadísticas'}
            </button>
            {/* Always show in print if any stat filled */}
            <div className={showStats ? '' : 'hidden print:block'}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
                {[
                  ['tirosCampo', 'Tiros campo'],
                  ['tirosLibres', 'Tiros libres'],
                  ['rebotes', 'Rebotes'],
                  ['perdidas', 'Pérdidas'],
                  ['asistencias', 'Asistencias'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                    <input
                      type="text"
                      value={data.estadisticas?.[key] || ''}
                      onChange={(e) => updateStat(key, e.target.value)}
                      placeholder="—"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notas libres */}
          <Section title="Notas adicionales">
            <textarea
              value={data.notasLibres}
              onChange={(e) => update('notasLibres', e.target.value)}
              placeholder="Cualquier otra observación del partido..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </Section>

          {/* Plan siguiente */}
          <Section title="Plan para próximo entrenamiento">
            <textarea
              value={data.planSiguiente}
              onChange={(e) => update('planSiguiente', e.target.value)}
              placeholder="Aspectos a trabajar basados en el análisis del partido..."
              rows={3}
              className="w-full border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        title="Limpiar análisis"
        message="¿Estás seguro de que quieres limpiar todos los datos del análisis? Esta acción no se puede deshacer."
        confirmLabel="Limpiar"
        destructive
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
