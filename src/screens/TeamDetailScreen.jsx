import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X, User, Users, ShieldHalf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams, saveTeam, subscribeToMembers, saveMember, deleteMember } from '../services/teamsService';
import { teamDisplayName, TeamFormFields } from './TeamsScreen';

const ROLES_STAFF = ['Entrenador', 'Entrenador asistente', 'Fisioterapeuta', 'Delegado', 'Médico', 'Otro'];
const POSICIONES = ['Base', 'Escolta', 'Alero', 'Ala-Pívot', 'Pívot'];

function emptyMember(tipo) {
  return {
    tipo,
    nombre: '',
    fechaNacimiento: '',
    dni: '',
    alergias: '',
    ...(tipo === 'staff' ? { rol: '' } : { dorsal: '', altura: '', posicion: '' }),
  };
}

export default function TeamDetailScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  const [editingMember, setEditingMember] = useState(null);
  const [savingMember, setSavingMember] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState(null);

  const [editingTeam, setEditingTeam] = useState(false);
  const [teamForm, setTeamForm] = useState(null);
  const [savingTeam, setSavingTeam] = useState(false);

  useEffect(() => {
    if (!user || !db) return;
    const unsub = subscribeToTeams(user.uid, db, appId, data => {
      const found = data.find(t => t.id === teamId);
      setTeam(found || null);
      setLoadingTeam(false);
    });
    return unsub;
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return;
    const unsub = subscribeToMembers(teamId, user.uid, db, appId, setMembers);
    return unsub;
  }, [user, db, appId, teamId]);

  async function handleSaveMember(e) {
    e.preventDefault();
    if (!editingMember.nombre.trim()) return;
    setSavingMember(true);
    try {
      const member = {
        ...editingMember,
        id: editingMember.id || crypto.randomUUID(),
        nombre: editingMember.nombre.trim(),
        dorsal: editingMember.dorsal !== '' && editingMember.dorsal != null ? Number(editingMember.dorsal) : null,
        altura: editingMember.altura !== '' && editingMember.altura != null ? Number(editingMember.altura) : null,
      };
      await saveMember(member, teamId, { uid: user.uid, db, appId });
      setEditingMember(null);
    } finally {
      setSavingMember(false);
    }
  }

  async function handleDeleteMember(memberId) {
    await deleteMember(memberId, teamId, { uid: user.uid, db, appId });
    setDeletingMemberId(null);
  }

  async function handleSaveTeam(e) {
    e.preventDefault();
    setSavingTeam(true);
    try {
      await saveTeam({ ...team, ...teamForm }, { uid: user.uid, db, appId });
      setEditingTeam(false);
    } finally {
      setSavingTeam(false);
    }
  }

  const staff = members.filter(m => m.tipo === 'staff');
  const jugadores = members.filter(m => m.tipo === 'jugador');

  if (loadingTeam) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 font-sans">
        <p className="text-slate-600">Equipo no encontrado</p>
        <button onClick={() => navigate('/teams')} className="text-blue-600 font-bold hover:underline">Volver a Equipos</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-8 font-sans pb-24">
      <div className="max-w-2xl mx-auto">

        {/* Navegación y título */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition mb-3"
          >
            <ArrowLeft size={16} /> Equipos
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <ShieldHalf size={28} className="text-amber-500 shrink-0" />
              <h1 className="text-2xl font-bold text-slate-900 truncate">{teamDisplayName(team)}</h1>
            </div>
            <button
              onClick={() => {
                setTeamForm({ categoria: team.categoria, año: team.año || '1º', letra: team.letra || '', genero: team.genero, division: team.division || '' });
                setEditingTeam(true);
              }}
              className="shrink-0 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-bold transition-colors border border-slate-300"
            >
              <Pencil size={14} /> Editar
            </button>
          </div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mt-2 ml-10">
            {team.categoria}{team.genero ? ` · ${team.genero}` : ''}
          </p>
        </div>

        {/* Sección Staff */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              Staff técnico
              <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full normal-case tracking-normal">{staff.length}</span>
            </h2>
            <button
              onClick={() => setEditingMember(emptyMember('staff'))}
              className="text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1 text-sm transition"
            >
              <Plus size={16} /> Añadir
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            {staff.length === 0 ? (
              <EmptySection text="Sin miembros de staff" />
            ) : (
              staff.map(m => (
                <MemberRow
                  key={m.id}
                  primary={m.nombre}
                  secondary={m.rol || '—'}
                  onEdit={() => setEditingMember({ ...m })}
                  onDelete={() => setDeletingMemberId(m.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Sección Jugadores */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              Jugadores
              <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full normal-case tracking-normal">{jugadores.length}</span>
            </h2>
            <button
              onClick={() => setEditingMember(emptyMember('jugador'))}
              className="text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1 text-sm transition"
            >
              <Plus size={16} /> Añadir
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            {jugadores.length === 0 ? (
              <EmptySection text="Sin jugadores" />
            ) : (
              jugadores.map(m => (
                <MemberRow
                  key={m.id}
                  primary={m.nombre}
                  secondary={[m.dorsal != null ? `#${m.dorsal}` : null, m.posicion].filter(Boolean).join(' · ') || '—'}
                  onEdit={() => setEditingMember({ ...m })}
                  onDelete={() => setDeletingMemberId(m.id)}
                />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Modal miembro */}
      {editingMember && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingMember(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <User size={18} className="text-blue-600" />
                {editingMember.id ? 'Editar' : 'Añadir'} {editingMember.tipo === 'staff' ? 'staff' : 'jugador'}
              </h3>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveMember} className="px-6 py-5 flex flex-col gap-4">
              <Field label="Nombre *">
                <input type="text" required value={editingMember.nombre}
                  onChange={e => setEditingMember(m => ({ ...m, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de nacimiento">
                  <input type="date" value={editingMember.fechaNacimiento || ''}
                    onChange={e => setEditingMember(m => ({ ...m, fechaNacimiento: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </Field>
                <Field label="DNI / NIE">
                  <input type="text" value={editingMember.dni || ''}
                    onChange={e => setEditingMember(m => ({ ...m, dni: e.target.value }))}
                    placeholder="00000000X"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </Field>
              </div>

              <Field label="Alergias / notas médicas">
                <textarea value={editingMember.alergias || ''}
                  onChange={e => setEditingMember(m => ({ ...m, alergias: e.target.value }))}
                  placeholder="Sin alergias conocidas..."
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </Field>

              {editingMember.tipo === 'staff' && (
                <Field label="Rol">
                  <select value={editingMember.rol || ''}
                    onChange={e => setEditingMember(m => ({ ...m, rol: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                    <option value="">Sin especificar</option>
                    {ROLES_STAFF.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              )}

              {editingMember.tipo === 'jugador' && (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Dorsal">
                    <input type="number" min="0" max="99" value={editingMember.dorsal ?? ''}
                      onChange={e => setEditingMember(m => ({ ...m, dorsal: e.target.value }))}
                      placeholder="—"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </Field>
                  <Field label="Altura (cm)">
                    <input type="number" min="100" max="250" value={editingMember.altura ?? ''}
                      onChange={e => setEditingMember(m => ({ ...m, altura: e.target.value }))}
                      placeholder="—"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </Field>
                  <Field label="Posición">
                    <select value={editingMember.posicion || ''}
                      onChange={e => setEditingMember(m => ({ ...m, posicion: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                      <option value="">—</option>
                      {POSICIONES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingMember(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={savingMember}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60">
                  {savingMember ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado miembro */}
      {deletingMemberId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDeletingMemberId(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar miembro?</h3>
            <p className="text-slate-600 mb-6 text-sm">Se eliminarán todos sus datos de forma permanente.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingMemberId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition">Cancelar</button>
              <button onClick={() => handleDeleteMember(deletingMemberId)}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar equipo */}
      {editingTeam && teamForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingTeam(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-800">Editar equipo</h3>
              <button onClick={() => setEditingTeam(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveTeam} className="flex flex-col gap-4">
              <TeamFormFields form={teamForm} setForm={setTeamForm} />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingTeam(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={savingTeam}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60">
                  {savingTeam ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ primary, secondary, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
        <User size={15} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm truncate">{primary}</p>
        <p className="text-xs text-slate-500 truncate">{secondary}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Editar"><Pencil size={15} /></button>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function EmptySection({ text }) {
  return (
    <div className="flex items-center justify-center py-10 text-slate-400 text-sm gap-2">
      <Users size={16} /> {text}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
