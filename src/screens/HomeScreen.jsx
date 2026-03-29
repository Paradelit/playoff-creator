import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users, ArrowRight, LogOut, ShieldHalf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen() {
  const { user, handleLogout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.isAnonymous ? 'Invitado' : (user?.displayName || user?.email || 'Entrenador');
  const photoURL = user?.photoURL || null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-8 font-sans pb-24">
      <div className="max-w-lg mx-auto">

        {/* Pill usuario */}
        <div className="flex justify-end mb-8">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              {photoURL
                ? <img src={photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />
                : <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{initial}</div>
              }
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">{displayName}</span>
            </div>
            <div className="w-px h-4 bg-slate-300" />
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-500 flex items-center gap-1 text-sm font-medium transition">
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>

        {/* Título */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Trophy className="text-amber-500" size={36} /> FBM Coach
          </h1>
          <p className="text-slate-500 mt-2">Panel de herramientas para entrenadores.</p>
        </div>

        {/* Tarjetas de acceso rápido */}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Acceso rápido</h2>
        <div className="flex flex-col gap-4">

          <button
            onClick={() => navigate('/playoffs')}
            className="bg-white rounded-xl shadow-md border border-slate-200 p-6 flex items-center gap-4 hover:shadow-xl transition-shadow text-left w-full"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Trophy size={24} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-lg">Playoffs</p>
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mt-0.5">Cuadros de competición</p>
            </div>
            <ArrowRight size={20} className="text-blue-600 shrink-0" />
          </button>

          <button
            onClick={() => navigate('/teams')}
            className="bg-white rounded-xl shadow-md border border-slate-200 p-6 flex items-center gap-4 hover:shadow-xl transition-shadow text-left w-full"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <ShieldHalf size={24} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-lg">Equipos</p>
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mt-0.5">Plantillas y jugadores</p>
            </div>
            <ArrowRight size={20} className="text-blue-600 shrink-0" />
          </button>

        </div>
      </div>
    </div>
  );
}
