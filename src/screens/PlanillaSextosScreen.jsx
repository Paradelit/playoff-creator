import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getDoc } from 'firebase/firestore';
import { ArrowLeft, Printer, RotateCcw, Plus, Minus } from 'lucide-react';
import ClubLogo from '../components/ClubLogo';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams, subscribeToMembers } from '../services/teamsService';
import { subscribeToProfile } from '../services/settingsService';
import { subscribeToPlanilla, savePlanilla } from '../services/planillaService';
import { userDocRef } from '../services/firestoreHelpers';
import { teamDisplayName } from './TeamsScreen';
import { validateSextos } from '../utils/minibasketUtils';

const SEXTO_LABELS = ['1º', '2º', '3º', '4º', '5º', '6º'];

export default function PlanillaSextosScreen() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [session, setSession] = useState(null);
  const [team, setTeam] = useState(null);
  const [profile, setProfile] = useState({});
  const [jugadores, setJugadores] = useState([]);
  const [meta, setMeta] = useState({ fase: '', jornada: '' });
  const [saveStatus, setSaveStatus] = useState('saved');
  const [loading, setLoading] = useState(true);

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

  // Load profile
  useEffect(() => {
    if (!user || !db) return;
    return subscribeToProfile(user.uid, db, appId, setProfile);
  }, [user, db, appId]);

  // Load team
  useEffect(() => {
    if (!user || !db || !session?.teamId) return;
    return subscribeToTeams(user.uid, db, appId, (teams) => {
      setTeam(teams.find((t) => t.id === session.teamId) || null);
    });
  }, [user, db, appId, session?.teamId]);

  // Load or create planilla
  useEffect(() => {
    if (!user || !db || !sessionId || !session) return;

    const unsub = subscribeToPlanilla(sessionId, { uid: user.uid, db, appId }, (planilla) => {
      if (initializedRef.current) return;

      if (planilla) {
        setJugadores(planilla.jugadores || []);
        setMeta({ fase: planilla.fase || '', jornada: planilla.jornada || '' });
        initializedRef.current = true;
        setLoading(false);
      } else {
        // No planilla yet — load members and create
        const unsubMembers = subscribeToMembers(session.teamId, user.uid, db, appId, (members) => {
          const players = members
            .filter((m) => m.tipo === 'jugador')
            .map((m) => ({
              memberId: m.id,
              nombre: m.nombre || '',
              dorsal: m.dorsal != null ? String(m.dorsal) : '',
              sextos: [false, false, false, false, false, false],
            }));

          const newPlanilla = {
            teamId: session.teamId,
            fecha: session.fecha || '',
            rival: session.rival || '',
            lugar: session.lugar || '',
            hora: session.horaInicio || '',
            esLocal: session.esLocal ?? true,
            fase: '',
            jornada: '',
            jugadores: players,
          };

          savePlanilla(newPlanilla, sessionId, { uid: user.uid, db, appId });
          setJugadores(players);
          initializedRef.current = true;
          setLoading(false);
          unsubMembers();
        });
      }
    });

    return unsub;
  }, [user, db, appId, sessionId, session]);

  function triggerSave(newJugadores, newMeta) {
    setSaveStatus('unsaved');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await savePlanilla(
        {
          teamId: session?.teamId,
          fecha: session?.fecha || '',
          rival: session?.rival || '',
          lugar: session?.lugar || '',
          hora: session?.horaInicio || '',
          esLocal: session?.esLocal ?? true,
          fase: newMeta.fase,
          jornada: newMeta.jornada,
          jugadores: newJugadores,
        },
        sessionId,
        { uid: user.uid, db, appId },
      );
      setSaveStatus('saved');
    }, 1500);
  }

  function toggleSexto(playerIndex, sextoIndex) {
    const updated = jugadores.map((j, i) => {
      if (i !== playerIndex) return j;
      const sextos = [...j.sextos];
      sextos[sextoIndex] = !sextos[sextoIndex];
      return { ...j, sextos };
    });
    setJugadores(updated);
    triggerSave(updated, meta);
  }

  function updateMeta(field, value) {
    const updated = { ...meta, [field]: value };
    setMeta(updated);
    triggerSave(jugadores, updated);
  }

  function addJugador() {
    const updated = [
      ...jugadores,
      { memberId: '', nombre: '', dorsal: '', sextos: [false, false, false, false, false, false] },
    ];
    setJugadores(updated);
    triggerSave(updated, meta);
  }

  function removeJugador() {
    if (jugadores.length <= 1) return;
    const updated = jugadores.slice(0, -1);
    setJugadores(updated);
    triggerSave(updated, meta);
  }

  function resetAll() {
    if (!window.confirm('¿Borrar todos los sextos de esta planilla?')) return;
    const updated = jugadores.map((j) => ({
      ...j,
      sextos: [false, false, false, false, false, false],
    }));
    setJugadores(updated);
    setMeta({ fase: '', jornada: '' });
    triggerSave(updated, { fase: '', jornada: '' });
  }

  const validated = validateSextos(jugadores);
  const clubName = profile.nombreClub || 'Mi Club';
  const hasAnyMarked = jugadores.some((j) => j.sextos.some(Boolean));
  const allValid = validated.every((j) => !j.sextos.some(Boolean) || j.valid);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 font-sans text-black print:bg-white print:p-0">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm px-4 py-2.5 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/calendar')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Calendario
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={addJugador}
            className="flex items-center px-3 py-1 bg-white border border-gray-400 text-sm hover:bg-gray-50 transition shadow-sm rounded"
          >
            <Plus className="w-4 h-4 mr-1" /> Jugador
          </button>
          <button
            onClick={removeJugador}
            disabled={jugadores.length <= 1}
            className="flex items-center px-3 py-1 bg-white border border-red-300 text-red-700 text-sm hover:bg-red-50 transition shadow-sm rounded disabled:opacity-40"
          >
            <Minus className="w-4 h-4 mr-1" /> Jugador
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {saveStatus === 'saving' && 'Guardando...'}
            {saveStatus === 'saved' && '✓ Guardado'}
          </span>
          <button
            onClick={resetAll}
            className="flex items-center px-3 py-1 bg-white border border-gray-400 text-gray-700 text-sm hover:bg-gray-50 transition shadow-sm rounded"
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Limpiar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* A4 Document */}
      <div className="flex justify-center py-8 px-4 print:p-0">
        <div className="w-full max-w-[800px] bg-white border border-gray-400 p-8 sm:p-12 shadow-xl print:shadow-none print:border-none print:m-0 min-h-[297mm] flex flex-col break-inside-avoid">
          {/* Header */}
          <div className="flex justify-between items-center mb-10">
            <ClubLogo logoUrl={profile.logoClub} className="w-24 h-24 print:w-20 print:h-20" />
            <div className="flex-1 flex flex-col items-center justify-center">
              <h2 className="text-xl font-bold uppercase tracking-widest mb-4">{clubName.toUpperCase()}</h2>
              <div className="flex items-center text-lg font-bold uppercase gap-2 flex-wrap justify-center">
                <span>{clubName.toUpperCase()} V.S.</span>
                <span className="border-b-2 border-black px-2 min-w-[200px] text-center">
                  {session?.rival?.toUpperCase() || '—'}
                </span>
              </div>
              {team && <p className="text-sm text-gray-500 mt-2 print:text-gray-700">{teamDisplayName(team)}</p>}
            </div>
          </div>

          {/* Validation banner */}
          {hasAnyMarked && !allValid && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4 print:hidden">
              Hay jugadores que no cumplen la norma: deben jugar 2 o 3 de los 5 primeros sextos.
            </div>
          )}

          {/* Table */}
          <div className="flex-1 w-full mb-8 overflow-x-auto">
            <table className="w-full border-collapse border-2 border-black">
              <thead>
                <tr className="bg-gray-100 print:bg-transparent">
                  <th className="border-2 border-black p-3 text-left w-[40%] text-sm uppercase tracking-wider">
                    Jugador
                  </th>
                  {SEXTO_LABELS.map((label, idx) => (
                    <th
                      key={idx}
                      className={`border-2 border-black p-3 text-center w-[10%] text-sm ${idx === 5 ? 'bg-blue-50 print:bg-transparent' : ''}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validated.map((jugador, pIdx) => {
                  const hasMarks = jugador.sextos.some(Boolean);
                  const isInvalid = hasMarks && !jugador.valid;

                  return (
                    <tr key={pIdx} className={`h-12 transition-colors ${isInvalid ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                      <td className={`border border-black px-3 font-medium text-sm ${isInvalid ? 'text-red-700' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span>
                            {jugador.dorsal ? `${jugador.dorsal} — ` : ''}
                            {jugador.nombre || '—'}
                          </span>
                          {isInvalid && (
                            <span className="text-[10px] text-red-500 font-semibold ml-2 whitespace-nowrap print:hidden">
                              {jugador.countFirst5}/5
                            </span>
                          )}
                        </div>
                      </td>
                      {jugador.sextos.map((active, sIdx) => (
                        <td
                          key={sIdx}
                          onClick={() => toggleSexto(pIdx, sIdx)}
                          className={`border border-black text-center cursor-pointer select-none transition-colors ${
                            sIdx === 5 ? 'bg-blue-50/50 print:bg-transparent' : ''
                          } ${active ? 'font-bold text-lg' : 'text-gray-300'} ${
                            isInvalid && sIdx < 5 && active
                              ? 'text-red-600'
                              : active
                                ? 'text-blue-800 print:text-black'
                                : ''
                          }`}
                        >
                          {active ? 'X' : ''}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-auto pt-6 border-t border-gray-300 gap-4 flex-wrap">
            <div className="flex items-center text-sm font-bold uppercase flex-1 min-w-[150px]">
              <span className="mr-2 shrink-0">FASE:</span>
              <input
                type="text"
                value={meta.fase}
                onChange={(e) => updateMeta('fase', e.target.value)}
                className="border-b border-black focus:outline-none bg-transparent flex-1 w-full uppercase"
              />
            </div>
            <div className="flex items-center text-sm font-bold uppercase flex-1 min-w-[150px]">
              <span className="mr-2 shrink-0">JORNADA:</span>
              <input
                type="text"
                value={meta.jornada}
                onChange={(e) => updateMeta('jornada', e.target.value)}
                className="border-b border-black focus:outline-none bg-transparent flex-1 w-full uppercase text-center"
              />
            </div>
            <div className="flex items-center text-sm font-bold uppercase flex-1 min-w-[150px]">
              <span className="mr-2 shrink-0">FECHA:</span>
              <span className="border-b border-black flex-1 text-right">
                {session?.fecha
                  ? new Date(session.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
            <div className="flex items-center text-sm font-bold uppercase flex-1 min-w-[120px]">
              <span className="mr-2 shrink-0">HORA:</span>
              <span className="border-b border-black flex-1 text-right">{session?.horaInicio || '—'}</span>
            </div>
            <div className="flex items-center text-sm font-bold uppercase flex-1 min-w-[120px]">
              <span className="mr-2 shrink-0">LUGAR:</span>
              <span className="border-b border-black flex-1 text-right">{session?.lugar || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
