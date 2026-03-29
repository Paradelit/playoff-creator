import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShieldHalf, Trash2, ArrowRight, X, Users, FolderOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams, saveTeam, deleteTeam } from '../services/teamsService';

export const CATEGORIAS = ['Prebenjamín', 'Benjamín', 'Alevín', 'Infantil', 'Cadete', 'Junior', 'Senior'];
export const AÑOS = ['1º', '2º'];
export const LETRAS_RAPIDAS = ['A', 'B', 'C', 'D', 'E'];
export const GENEROS = ['Masculino', 'Femenino', 'Mixto'];

export function teamDisplayName(team) {
  const parts = [team.categoria];
  if (team.categoria === 'Senior') {
    if (team.division) parts.push(team.division);
  } else {
    if (team.año) parts.push(team.año);
  }
  if (team.letra) parts.push(team.letra);
  const genero = team.genero ? ` · ${team.genero}` : '';
  return parts.join(' ') + genero;
}

const EMPTY_FORM = { categoria: 'Prebenjamín', año: '1º', letra: 'A', genero: 'Masculino', division: '' };

export default function TeamsScreen() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState(null);

  useEffect(() => {
    if (!user || !db) return;
    const unsub = subscribeToTeams(user.uid, db, appId, data => {
      setTeams(data);
      setLoading(false);
    });
    return unsub;
  }, [user, db, appId]);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveTeam({ id: crypto.randomUUID(), ...form }, { uid: user.uid, db, appId });
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

  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-12 font-sans pb-24">
      <div className="max-w-5xl mx-auto">

        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ShieldHalf className="text-amber-500" size={36} /> Mis Equipos
            </h1>
            <p className="text-slate-500 mt-2">Gestiona plantillas, jugadores y staff técnico.</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setShowCreateModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
          >
            <Plus size={20} /> Nuevo equipo
          </button>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center shadow-sm">
            <FolderOpen size={64} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">Todavía no tienes equipos</h3>
            <p className="text-slate-500 mb-6">Crea tu primer equipo para empezar a gestionar plantillas.</p>
            <button
              onClick={() => { setForm(EMPTY_FORM); setShowCreateModal(true); }}
              className="text-blue-600 font-bold hover:underline"
            >
              Crear equipo ahora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <div key={team.id} className="bg-white rounded-xl shadow-md border border-slate-200 p-6 flex flex-col hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <ShieldHalf size={20} className="text-blue-600 shrink-0" />
                    <h3 className="text-lg font-bold text-slate-800 truncate">{teamDisplayName(team)}</h3>
                  </div>
                </div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-4">{team.categoria}{team.genero ? ` · ${team.genero}` : ''}</p>
                <div className="flex justify-between items-center mt-auto border-t border-slate-100 pt-4">
                  <button
                    onClick={() => navigate(`/teams/${team.id}`)}
                    className="text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1"
                  >
                    Ver plantilla <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => setDeletingTeamId(team.id)}
                    className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar equipo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal crear equipo */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldHalf size={20} className="text-blue-600" /> Nuevo equipo
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <TeamFormFields form={form} setForm={setForm} />

              <div className="bg-slate-50 rounded-xl px-4 py-3 text-center border border-slate-200">
                <p className="text-xs text-slate-500 mb-0.5">Nombre del equipo</p>
                <p className="font-bold text-slate-800">{teamDisplayName(form)}</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60">
                  {saving ? 'Creando...' : 'Crear equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado */}
      {deletingTeamId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDeletingTeamId(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar equipo?</h3>
            <p className="text-slate-600 mb-6 text-sm">Esta acción borrará el equipo y todos sus datos permanentemente.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingTeamId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition">Cancelar</button>
              <button onClick={() => handleDelete(deletingTeamId)}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Formulario reutilizable en crear y editar equipo
export function TeamFormFields({ form, setForm }) {
  const esSenior = form.categoria === 'Senior';

  return (
    <div className="flex flex-col gap-4">
      {/* Categoría + Género */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoría</label>
          <select value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value, division: '', año: '1º' }))}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Género</label>
          <select value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value }))}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            {GENEROS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* División (solo Senior) */}
      {esSenior && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">División <span className="text-slate-400 font-normal">(opcional)</span></label>
          <input type="text" value={form.division || ''}
            onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
            placeholder="Nacional, Sub22, Autonómica..."
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}

      {/* Año (no Senior) */}
      {!esSenior && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Año</label>
          <div className="flex gap-2">
            {AÑOS.map(a => (
              <button key={a} type="button"
                onClick={() => setForm(f => ({ ...f, año: a }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  form.año === a ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Letra */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Letra</label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {LETRAS_RAPIDAS.map(l => (
              <button key={l} type="button"
                onClick={() => setForm(f => ({ ...f, letra: l }))}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                  form.letra === l ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {l}
              </button>
            ))}
          </div>
          <input type="text" value={form.letra || ''}
            onChange={e => setForm(f => ({ ...f, letra: e.target.value.toUpperCase() }))}
            placeholder="F…"
            maxLength={4}
            className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>
    </div>
  );
}
