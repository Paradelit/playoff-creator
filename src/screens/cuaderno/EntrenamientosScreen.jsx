import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, X, Printer, ArrowRight } from 'lucide-react';
import ClubLogo from '../../components/ClubLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { subscribeToTrainings, saveTraining } from '../../services/trainingsService';
import { subscribeToTeamSessions, linkTrainingToSession } from '../../services/calendarService';
import { teamDisplayName } from '../../utils/teamUtils';
import { useTeams } from '../../hooks/useTeams';
import { useProfile } from '../../hooks/useProfile';
import { useTrainingNumbers } from '../../hooks/useTrainingNumbers';
import { getTemporada, formatDateDisplay } from '../../utils/dateUtils';

export default function EntrenamientosScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const { teams } = useTeams();
  const { profile } = useProfile();
  const trainingNumbers = useTrainingNumbers();
  const team = teams.find((t) => t.id === teamId) || null;
  const [sessions, setSessions] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const syncedRef = useRef(new Set());

  // Subscribe to calendar sessions of type 'entrenamiento' for this team
  useEffect(() => {
    if (!user || !db || !teamId) return;
    return subscribeToTeamSessions(user.uid, db, appId, teamId, 'entrenamiento', (data) => {
      setSessions(data);
    });
  }, [user, db, appId, teamId]);

  // Subscribe to training docs for this team
  useEffect(() => {
    if (!user || !db || !teamId) return;
    return subscribeToTrainings(teamId, user.uid, db, appId, (data) => {
      setTrainings(data);
      setLoading(false);
    });
  }, [user, db, appId, teamId]);

  // Auto-create missing training docs for sessions that don't have one
  useEffect(() => {
    if (!user || !db || !team || sessions.length === 0) return;
    const trainingIds = new Set(trainings.map((t) => t.id));
    const ctx = { uid: user.uid, db, appId };
    const teamName = teamDisplayName(team);

    for (const s of sessions) {
      if (s.trainingId && trainingIds.has(s.trainingId)) continue;
      if (syncedRef.current.has(s.id)) continue;
      syncedRef.current.add(s.id);

      const trainingId = s.trainingId || crypto.randomUUID();
      saveTraining(
        {
          id: trainingId,
          teamId,
          meta: {
            numero: trainingNumbers.get(s.id) || s.sessionNumber || 1,
            fecha: s.fecha || '',
            horaInicio: s.horaInicio || '',
            horaFin: s.horaFin || '',
            lugar: s.lugar || '',
            dia: '',
            equipo: teamName,
          },
          objetivos: '',
          ejercicios: [],
          cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
        },
        teamId,
        ctx,
      ).then(() => {
        if (!s.trainingId) {
          linkTrainingToSession(s.id, trainingId, ctx);
        }
      });
    }
  }, [user, db, appId, team, sessions, trainings, teamId, trainingNumbers]);

  // Build page list: one entry per session, merged with training data
  const pages = useMemo(() => {
    const trainingMap = new Map(trainings.map((t) => [t.id, t]));
    return sessions.map((s) => {
      const training = s.trainingId ? trainingMap.get(s.trainingId) : null;
      const chronoNumber = trainingNumbers.get(s.id) ?? s.sessionNumber;
      return { session: { ...s, sessionNumber: chronoNumber }, training };
    });
  }, [sessions, trainings, trainingNumbers]);

  // Compute initial index for the next upcoming training
  const initialIndex = useMemo(() => {
    if (pages.length === 0) return -1;
    const today = new Date().toISOString().slice(0, 10);
    const idx = pages.findIndex((p) => (p.session.fecha || '') >= today);
    return idx === -1 ? pages.length - 1 : idx;
  }, [pages]);

  // Use initialIndex until user navigates manually
  const effectiveIndex = currentIndex >= 0 ? currentIndex : initialIndex;

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return pages
      .map((p, idx) => ({ ...p, _idx: idx }))
      .filter((p) => {
        const num = String(p.session.sessionNumber || '');
        const fecha = p.session.fecha || '';
        const fechaFormatted = formatDateDisplay(fecha).toLowerCase();
        return num.includes(q) || fecha.includes(q) || fechaFormatted.includes(q);
      });
  }, [pages, searchQuery]);

  const current = pages[effectiveIndex] || null;
  const clubName = profile.nombreClub || 'Mi Club';
  const temporada = getTemporada();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 font-serif text-black print:bg-white print:p-0">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm px-4 py-2.5 flex items-center justify-between gap-4 font-sans">
        <button
          onClick={() => navigate(`/teams/${teamId}/cuaderno`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Cuaderno
        </button>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={effectiveIndex <= 0}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition"
            title="Entrenamiento anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold text-slate-600 min-w-[80px] text-center">
            {current ? `${effectiveIndex + 1} / ${pages.length}` : '—'}
          </span>
          <button
            onClick={() => setCurrentIndex((i) => Math.min(pages.length - 1, i + 1))}
            disabled={effectiveIndex >= pages.length - 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition"
            title="Siguiente entrenamiento"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={`p-2 rounded-lg transition ${searchOpen ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-500'}`}
              title="Buscar entrenamiento"
            >
              <Search size={18} />
            </button>
            {searchOpen && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl w-72 z-20">
                <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                  <Search size={14} className="text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nº sesión o fecha..."
                    className="flex-1 text-sm focus:outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      aria-label="Limpiar búsqueda"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchQuery && searchResults.length === 0 && (
                    <p className="text-sm text-slate-400 p-3 text-center">Sin resultados</p>
                  )}
                  {searchResults.map((r) => (
                    <button
                      key={r.session.id}
                      onClick={() => {
                        setCurrentIndex(r._idx);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-sm border-b border-slate-50 last:border-0"
                    >
                      <span className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                        #{r.session.sessionNumber ?? '?'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">Entrenamiento {r.session.sessionNumber}</p>
                        <p className="text-xs text-slate-400">
                          {formatDateDisplay(r.session.fecha)} · {r.session.lugar || 'Sin lugar'}
                        </p>
                      </div>
                    </button>
                  ))}
                  {!searchQuery && (
                    <p className="text-xs text-slate-400 p-3 text-center">
                      Busca por número de sesión o fecha (dd/mm/aaaa)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex justify-center py-8 px-4 print:p-0">
        {pages.length === 0 ? (
          <div className="w-full max-w-[800px] bg-white border border-gray-400 shadow-xl min-h-[297mm] flex flex-col items-center justify-center text-center p-12">
            <p className="text-gray-400 text-lg mb-4">No hay entrenamientos programados</p>
            <p className="text-gray-400 text-sm">Añade sesiones de entrenamiento en el calendario para verlas aquí.</p>
          </div>
        ) : !current ? (
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="w-full max-w-[800px] bg-white border border-gray-400 p-8 sm:p-12 shadow-xl print:shadow-none print:border-none print:m-0 min-h-[297mm] flex flex-col break-inside-avoid">
            {/* Header */}
            <div className="flex items-start gap-6 mb-8">
              <ClubLogo logoUrl={profile.logoClub} className="w-20 h-20 print:w-16 print:h-16 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold uppercase tracking-wider">{clubName}</h2>
                    {team && <p className="text-sm text-gray-500">{teamDisplayName(team)}</p>}
                  </div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Temporada {temporada}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm border-t border-gray-200 pt-3">
                  <span>
                    <strong>Sesión:</strong> {current.session.sessionNumber ?? '—'}
                  </span>
                  <span>
                    <strong>Fecha:</strong> {formatDateDisplay(current.session.fecha)}
                  </span>
                  <span>
                    <strong>Horario:</strong>{' '}
                    {current.session.horaInicio && current.session.horaFin
                      ? `${current.session.horaInicio} – ${current.session.horaFin}`
                      : current.session.horaInicio || '—'}
                  </span>
                  <span>
                    <strong>Lugar:</strong> {current.session.lugar || '—'}
                  </span>
                </div>
              </div>
            </div>

            {current.training ? (
              <>
                {/* Objetivos */}
                {current.training.objetivos && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 border-b border-gray-200 pb-1">
                      Objetivos semanales
                    </h3>
                    <p className="text-sm whitespace-pre-wrap">{current.training.objetivos}</p>
                  </div>
                )}

                {/* Ejercicios */}
                <div className="flex-1 mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3 border-b border-gray-200 pb-1">
                    Ejercicios
                  </h3>
                  {!current.training.ejercicios || current.training.ejercicios.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Sin ejercicios definidos</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {current.training.ejercicios.map((ej, idx) => (
                        <div key={ej.id || idx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-sm flex-1">{ej.contenido || 'Sin título'}</span>
                            {ej.tiempo && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{ej.tiempo}</span>
                            )}
                            {ej.tipoPista && (
                              <span className="text-xs text-gray-400">
                                {ej.tipoPista === 'entera' ? 'Pista entera' : 'Media pista'}
                              </span>
                            )}
                          </div>
                          {ej.descripcion && (
                            <p className="text-sm text-gray-600 ml-9 whitespace-pre-wrap">{ej.descripcion}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cierre */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Cierre</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="font-semibold text-gray-600">Faltas:</span>{' '}
                      <span>{current.training.cierre?.faltas || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Retrasos:</span>{' '}
                      <span>{current.training.cierre?.retrasos || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Anotaciones:</span>{' '}
                      <span>{current.training.cierre?.anotaciones || '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Observaciones:</span>{' '}
                      <span>{current.training.cierre?.observaciones || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Edit button */}
                <div className="mt-8 print:hidden">
                  <button
                    onClick={() => navigate(`/teams/${teamId}/trainings/${current.training.id}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition font-sans"
                  >
                    Editar entrenamiento <ArrowRight size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Preparando entrenamiento...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
