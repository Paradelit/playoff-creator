import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Trophy, Users, CalendarDays, Plus, X,
  ShieldHalf, ClipboardList, BookOpen
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams, saveTeam } from '../services/teamsService';
import { saveTraining } from '../services/trainingsService';
import { subscribeToProfile, autoAddCoachToTeam } from '../services/settingsService';
import { teamDisplayName, TeamFormFields, EMPTY_FORM } from '../screens/TeamsScreen';

const LEFT_ITEMS = [
  { to: '/',        label: 'Inicio',   Icon: Home,         end: true  },
  { to: '/playoffs',label: 'Playoffs', Icon: Trophy,       end: false },
];
const RIGHT_ITEMS = [
  { to: '/teams',   label: 'Equipos',  Icon: Users,        end: false },
  { to: '/calendar',label: 'Calendario',Icon: CalendarDays, end: false },
];

function NavItem({ to, label, Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
          isActive ? 'text-amber-400' : 'text-blue-400 hover:text-blue-200'
        }`
      }
    >
      <Icon size={22} />
      <span>{label}</span>
    </NavLink>
  );
}

// ─── Create Sheet ───────────────────────────────────────────────

function CreateSheet({ onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [teams, setTeams] = useState([]);
  const [step, setStep] = useState('main'); // 'main' | 'new-team' | 'pick-team'
  const [pendingAction, setPendingAction] = useState(null); // 'training'
  const [teamForm, setTeamForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({});

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, setTeams);
  }, [user, db, appId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToProfile(user.uid, db, appId, setProfile);
  }, [user, db, appId]);

  async function handleCreateTeam(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const teamId = crypto.randomUUID();
      await saveTeam({ id: teamId, ...teamForm }, { uid: user.uid, db, appId });
      if (profile?.autoAddToTeams) {
        await autoAddCoachToTeam(teamId, profile, { uid: user.uid, db, appId });
      }
      onClose();
      navigate('/teams');
    } finally {
      setSaving(false);
    }
  }

  async function handleNewTrainingForTeam(team) {
    const trainingId = crypto.randomUUID();
    await saveTraining({
      id: trainingId, teamId: team.id,
      meta: { numero: 1, dia: '', fecha: '', horaInicio: '', horaFin: '', lugar: '' },
      objetivos: '', ejercicios: [],
      cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
    }, team.id, { uid: user.uid, db, appId });
    onClose();
    navigate(`/teams/${team.id}/trainings/${trainingId}`);
  }

  function handleTrainingAction() {
    if (teams.length === 0) { onClose(); navigate('/teams'); return; }
    if (teams.length === 1) { handleNewTrainingForTeam(teams[0]); return; }
    setPendingAction('training');
    setStep('pick-team');
  }

  const OPTIONS = [
    {
      icon: ShieldHalf, label: 'Nuevo equipo',
      desc: 'Crear plantilla con jugadores',
      color: 'bg-blue-50 text-blue-600',
      action: () => setStep('new-team'),
    },
    {
      icon: ClipboardList, label: 'Nuevo entrenamiento',
      desc: 'Ficha A4 de sesión',
      color: 'bg-amber-50 text-amber-600',
      action: handleTrainingAction,
    },
    {
      icon: CalendarDays, label: 'Nueva sesión',
      desc: 'Entrenamiento o partido en el calendario',
      color: 'bg-emerald-50 text-emerald-600',
      action: () => { onClose(); navigate('/calendar'); },
    },
    {
      icon: Trophy, label: 'Nuevo cuadro de playoff',
      desc: 'Torneo de eliminación directa',
      color: 'bg-amber-50 text-amber-600',
      action: () => { onClose(); navigate('/playoffs'); },
    },
    {
      icon: BookOpen, label: 'Nuevo ejercicio',
      desc: 'Añadir a la biblioteca de ejercicios',
      color: 'bg-rose-50 text-rose-600',
      action: () => { onClose(); navigate('/exercises'); },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 z-[150] backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[160] bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-250 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-4 px-1 pt-1">
            <h3 className="text-xl font-bold text-slate-800">Crear</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
          </div>

          {/* ── Step: main ── */}
          {step === 'main' && (
            <div className="flex flex-col gap-1">
              {OPTIONS.map(opt => (
                <button key={opt.label} onClick={opt.action}
                  className="flex items-center gap-4 p-3.5 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left w-full">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${opt.color}`}>
                    <opt.icon size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step: pick-team ── */}
          {step === 'pick-team' && (
            <div>
              <button onClick={() => setStep('main')} className="text-sm text-blue-600 font-semibold mb-4 flex items-center gap-1">
                ← Volver
              </button>
              <p className="text-sm text-slate-600 mb-3">¿Para qué equipo?</p>
              <div className="flex flex-col gap-2">
                {teams.map(team => (
                  <button key={team.id}
                    onClick={() => pendingAction === 'training' && handleNewTrainingForTeam(team)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-left">
                    <ShieldHalf size={18} className="text-blue-600 shrink-0" />
                    <span className="font-semibold text-slate-800 text-sm">{teamDisplayName(team)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: new-team ── */}
          {step === 'new-team' && (
            <div>
              <button onClick={() => setStep('main')} className="text-sm text-blue-600 font-semibold mb-4 flex items-center gap-1">
                ← Volver
              </button>
              <form onSubmit={handleCreateTeam} className="flex flex-col gap-4">
                <TeamFormFields form={teamForm} setForm={setTeamForm} />
                <div className="bg-slate-50 rounded-xl px-4 py-3 text-center border border-slate-200">
                  <p className="text-xs text-slate-500 mb-0.5">Nombre del equipo</p>
                  <p className="font-bold text-slate-800">{teamDisplayName(teamForm)}</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep('main')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition">Cancelar</button>
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60">
                    {saving ? 'Creando...' : 'Crear equipo'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Nav principal ────────────────────────────────────────────────

export default function CoachesNav() {
  const location = useLocation();
  const [showCreate, setShowCreate] = useState(false);

  if (location.pathname === '/login') return null;

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] bg-blue-950 border-t border-blue-900 flex items-stretch h-16"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {LEFT_ITEMS.map(item => <NavItem key={item.to} {...item} />)}

        {/* Botón central "+" */}
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => setShowCreate(true)}
            className="w-14 h-14 bg-amber-400 hover:bg-amber-300 active:scale-95 rounded-full -translate-y-5 shadow-2xl border-4 border-blue-950 flex items-center justify-center transition-all duration-150"
            aria-label="Crear"
          >
            <Plus size={28} className="text-blue-950" strokeWidth={3} />
          </button>
        </div>

        {RIGHT_ITEMS.map(item => <NavItem key={item.to} {...item} />)}
      </nav>

      {showCreate && <CreateSheet onClose={() => setShowCreate(false)} />}
    </>
  );
}
