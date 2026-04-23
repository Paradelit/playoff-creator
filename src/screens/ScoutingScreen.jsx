import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getDoc } from 'firebase/firestore';
import { ArrowLeft, Printer, RotateCcw, Plus, Trash2, Search, Shield } from 'lucide-react';
import ClubLogo from '../components/ClubLogo';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToScouting, saveScouting } from '../services/scoutingService';
import { userDocRef } from '../services/firestoreHelpers';
import { useProfile } from '../hooks/useProfile';
import { useTeams } from '../hooks/useTeams';
import { teamDisplayName } from '../utils/teamUtils';
import { getTemporada, formatDateDisplay } from '../utils/dateUtils';
import ConfirmDialog from '../components/ConfirmDialog';

function emptyScoutingData(session) {
  return {
    teamId: session?.teamId || '',
    sessionId: session?.id || '',
    rival: session?.rival || '',
    fecha: session?.fecha || '',
    sistemaJuego: '',
    jugadoresClave: [],
    patronesOfensivos: '',
    patronesDefensivos: '',
    debilidades: '',
    notasLibres: '',
  };
}

export default function ScoutingScreen() {
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

  const debounceRef = useRef(null);
  const initializedRef = useRef(false);

  // Load session (from Firestore or from route state for virtual playoff sessions)
  useEffect(() => {
    if (!user || !db || !sessionId) return;
    const ref = userDocRef(db, appId, user.uid, 'calendarSessions', sessionId);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setSession({ ...snap.data(), id: snap.id });
      } else if (location.state?.playoffSession) {
        setSession({ ...location.state.playoffSession, id: sessionId });
      }
    });
  }, [user, db, appId, sessionId, location.state]);

  // Load or create scouting
  useEffect(() => {
    if (!user || !db || !sessionId || !session) return;
    return subscribeToScouting(sessionId, { uid: user.uid, db, appId }, (scouting) => {
      if (initializedRef.current) return;
      setData(scouting || emptyScoutingData(session));
      initializedRef.current = true;
      setLoading(false);
    });
  }, [user, db, appId, sessionId, session]);

  function triggerSave(newData) {
    setSaveStatus('unsaved');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveScouting(newData, sessionId, { uid: user.uid, db, appId });
      setSaveStatus('saved');
    }, 1500);
  }

  function update(field, value) {
    const updated = { ...data, [field]: value };
    setData(updated);
    triggerSave(updated);
  }

  function addJugadorClave() {
    const updated = {
      ...data,
      jugadoresClave: [...data.jugadoresClave, { nombre: '', dorsal: '', notas: '', posicion: '' }],
    };
    setData(updated);
    triggerSave(updated);
  }

  function updateJugadorClave(index, field, value) {
    const jugadores = data.jugadoresClave.map((j, i) => (i === index ? { ...j, [field]: value } : j));
    const updated = { ...data, jugadoresClave: jugadores };
    setData(updated);
    triggerSave(updated);
  }

  function removeJugadorClave(index) {
    const updated = { ...data, jugadoresClave: data.jugadoresClave.filter((_, i) => i !== index) };
    setData(updated);
    triggerSave(updated);
  }

  function handleReset() {
    setShowResetConfirm(true);
  }

  function confirmReset() {
    setShowResetConfirm(false);
    const fresh = emptyScoutingData(session);
    setData(fresh);
    triggerSave(fresh);
  }

  const clubName = profile.nombreClub || 'Uros de Rivas';
  const temporada = getTemporada();

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
            onClick={handleReset}
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
              <p className="text-sm text-gray-500 mt-1 font-sans">Scouting de Rival</p>
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2 font-sans">
              <p>Temporada {temporada}</p>
              {team && <p className="italic text-xs text-gray-500 mt-0.5">{teamDisplayName(team)}</p>}
            </div>
          </div>

          {/* Info del partido */}
          <div className="border border-gray-300 rounded-lg p-4 mb-6 bg-gray-50 flex flex-wrap gap-x-8 gap-y-2 text-sm font-sans">
            <div>
              <span className="text-gray-500 text-xs font-semibold uppercase">Rival</span>
              <p className="font-bold text-gray-800">{data.rival || '—'}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs font-semibold uppercase">Fecha</span>
              <p className="font-bold text-gray-800">{formatDateDisplay(data.fecha)}</p>
            </div>
            {session?.lugar && (
              <div>
                <span className="text-gray-500 text-xs font-semibold uppercase">Lugar</span>
                <p className="font-bold text-gray-800">{session.lugar}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500 text-xs font-semibold uppercase">Campo</span>
              <p className="font-bold text-gray-800">{session?.esLocal ? 'Local' : 'Visitante'}</p>
            </div>
          </div>

          {/* Sistema de juego */}
          <Section title="Sistema de juego">
            <textarea
              value={data.sistemaJuego}
              onChange={(e) => update('sistemaJuego', e.target.value)}
              placeholder="Formación, estilo de juego, ritmo, defensa habitual..."
              aria-label="Sistema de juego"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-sans"
            />
          </Section>

          {/* Jugadores clave */}
          <Section
            title="Jugadores clave"
            action={
              <button
                onClick={addJugadorClave}
                className="print:hidden flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold transition"
              >
                <Plus size={14} /> Añadir
              </button>
            }
          >
            {data.jugadoresClave.length === 0 && (
              <p className="text-sm text-gray-400 italic">Sin jugadores clave añadidos</p>
            )}
            <div className="flex flex-col gap-3">
              {data.jugadoresClave.map((j, i) => (
                <div key={i} className="flex gap-2 items-start border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex-1 grid grid-cols-3 gap-2 font-sans">
                    <input
                      type="text"
                      value={j.nombre}
                      onChange={(e) => updateJugadorClave(i, 'nombre', e.target.value)}
                      placeholder="Nombre"
                      aria-label={`Nombre del jugador clave ${i + 1}`}
                      className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      value={j.dorsal}
                      onChange={(e) => updateJugadorClave(i, 'dorsal', e.target.value)}
                      placeholder="Dorsal"
                      aria-label={`Dorsal del jugador clave ${i + 1}`}
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      value={j.posicion}
                      onChange={(e) => updateJugadorClave(i, 'posicion', e.target.value)}
                      placeholder="Posición"
                      aria-label={`Posición del jugador clave ${i + 1}`}
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <textarea
                      value={j.notas}
                      onChange={(e) => updateJugadorClave(i, 'notas', e.target.value)}
                      placeholder="Notas sobre este jugador..."
                      aria-label={`Notas del jugador clave ${i + 1}`}
                      rows={2}
                      className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                    />
                  </div>
                  <button
                    onClick={() => removeJugadorClave(i)}
                    className="print:hidden text-red-400 hover:text-red-600 p-1 mt-1 transition"
                    aria-label="Eliminar jugador"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          {/* Patrones ofensivos */}
          <Section title="Patrones ofensivos">
            <textarea
              value={data.patronesOfensivos}
              onChange={(e) => update('patronesOfensivos', e.target.value)}
              placeholder="Jugadas habituales, pick & roll, movimientos sin balón, contraataques..."
              aria-label="Patrones ofensivos"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-sans"
            />
          </Section>

          {/* Patrones defensivos */}
          <Section title="Patrones defensivos">
            <textarea
              value={data.patronesDefensivos}
              onChange={(e) => update('patronesDefensivos', e.target.value)}
              placeholder="Tipo de defensa, presión, traps, rotaciones..."
              aria-label="Patrones defensivos"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-sans"
            />
          </Section>

          {/* Debilidades */}
          <Section title="Debilidades a explotar">
            <textarea
              value={data.debilidades}
              onChange={(e) => update('debilidades', e.target.value)}
              placeholder="Puntos débiles del rival, transiciones, rebote, presión..."
              aria-label="Debilidades a explotar"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-sans"
            />
          </Section>

          {/* Notas libres */}
          <Section title="Notas adicionales">
            <textarea
              value={data.notasLibres}
              onChange={(e) => update('notasLibres', e.target.value)}
              placeholder="Cualquier otra observación relevante..."
              aria-label="Notas adicionales"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-sans"
            />
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        title="Limpiar scouting"
        message="¿Estás seguro de que quieres limpiar todos los datos del scouting? Esta acción no se puede deshacer."
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
