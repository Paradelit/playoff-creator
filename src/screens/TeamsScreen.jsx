import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ShieldHalf, X, FolderOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { saveTeam, deleteTeam } from '../services/teamsService';
import { autoAddCoachToTeam } from '../services/settingsService';
import { useProfile } from '../hooks/useProfile';
import { useHomeDashboard } from '../hooks/useHomeDashboard';
import { teamDisplayName } from '../utils/teamUtils';
import TeamDashboard from '../components/teams/TeamDashboard';
import { TeamFormFields } from '../components/teams/TeamFormFields';
import { EMPTY_FORM } from '../components/teams/teamFormConstants';

export default function TeamsScreen() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const navigate = useNavigate();

  const { teams, loadingTeams: loading, allSessions, activePlayoffs } = useHomeDashboard();
  const { profile } = useProfile();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const carouselRef = useRef(null);
  const cardRefs = useRef([]);
  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = teams.findIndex((t) => t.id === tabParam);
    return idx >= 0 ? idx : 0;
  });

  useEffect(() => {
    if (!carouselRef.current || teams.length === 0) return undefined;
    const observers = teams.map((_, i) => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveIdx(i);
            const teamId = teams[i]?.id;
            if (teamId && teamId !== tabParam) {
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('tab', teamId);
                  return next;
                },
                { replace: true },
              );
            }
          }
        },
        { threshold: 0.6, root: carouselRef.current },
      );
      if (cardRefs.current[i]) obs.observe(cardRefs.current[i]);
      return obs;
    });
    return () => observers.forEach((obs) => obs.disconnect());
  }, [teams, tabParam, setSearchParams]);

  useEffect(() => {
    if (!tabParam || teams.length === 0) return;
    const idx = teams.findIndex((t) => t.id === tabParam);
    if (idx < 0) return;
    const el = cardRefs.current[idx];
    if (el && carouselRef.current) {
      carouselRef.current.scrollTo({ left: el.offsetLeft, behavior: 'auto' });
    }
  }, [tabParam, teams]);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const teamId = crypto.randomUUID();
      await saveTeam({ id: teamId, ...form }, { uid: user.uid, db, appId });
      if (profile?.autoAddToTeams) {
        await autoAddCoachToTeam(teamId, profile, { uid: user.uid, db, appId });
      }
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(teamId) {
    await deleteTeam(teamId, { uid: user.uid, db, appId });
    setDeletingTeamId(null);
  }

  function playoffForTeam(teamId) {
    return activePlayoffs.find((p) => p.teamId === teamId) || null;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-12 font-sans pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ShieldHalf className="text-amber-500" size={36} aria-hidden="true" /> Mis Equipos
            </h1>
            <p className="text-slate-500 mt-2">Gestiona plantillas, jugadores y staff técnico.</p>
          </div>
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowCreateModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
          >
            <Plus size={20} aria-hidden="true" /> Nuevo equipo
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center shadow-sm">
            <FolderOpen size={64} className="mx-auto text-slate-300 mb-4" aria-hidden="true" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">Todavía no tienes equipos</h3>
            <p className="text-slate-500 mb-6">Crea tu primer equipo para empezar a gestionar plantillas.</p>
            <button
              onClick={() => {
                setForm(EMPTY_FORM);
                setShowCreateModal(true);
              }}
              className="text-blue-600 font-bold hover:underline"
            >
              Crear equipo ahora
            </button>
          </div>
        ) : (
          <>
            <div className="md:hidden -mx-6">
              <div
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-6 pb-3"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {teams.map((team, idx) => (
                  <div
                    key={team.id}
                    ref={(el) => (cardRefs.current[idx] = el)}
                    className="snap-center flex-shrink-0 w-[calc(100vw-3rem)] max-w-md bg-slate-50 rounded-2xl p-4 border border-slate-200"
                  >
                    <TeamDashboard
                      team={team}
                      sessions={allSessions}
                      activePlayoff={playoffForTeam(team.id)}
                      navigate={navigate}
                      onDeleteTeam={() => setDeletingTeamId(team.id)}
                    />
                  </div>
                ))}
              </div>
              {teams.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                  {teams.map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-300 ${
                        i === activeIdx ? 'w-5 h-1.5 bg-blue-600' : 'w-1.5 h-1.5 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="bg-white rounded-xl shadow-md border border-slate-200 p-5 hover:shadow-xl transition-shadow"
                >
                  <TeamDashboard
                    team={team}
                    sessions={allSessions}
                    activePlayoff={playoffForTeam(team.id)}
                    navigate={navigate}
                    onDeleteTeam={() => setDeletingTeamId(team.id)}
                    compact
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldHalf size={20} className="text-blue-600" aria-hidden="true" /> Nuevo equipo
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                aria-label="Cerrar"
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <TeamFormFields form={form} setForm={setForm} />

              <div className="bg-slate-50 rounded-xl px-4 py-3 text-center border border-slate-200">
                <p className="text-xs text-slate-500 mb-0.5">Nombre del equipo</p>
                <p className="font-bold text-slate-800">{teamDisplayName(form)}</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? 'Creando...' : 'Crear equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingTeamId && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
          onClick={() => setDeletingTeamId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-2 text-slate-800">Â¿Eliminar equipo?</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Esta acción borrará el equipo y todos sus datos permanentemente.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingTeamId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingTeamId)}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
