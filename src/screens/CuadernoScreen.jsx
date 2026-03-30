import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import ClubLogo from '../components/ClubLogo';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams } from '../services/teamsService';
import { subscribeToProfile } from '../services/settingsService';
import { teamDisplayName } from './TeamsScreen';

function getTemporada() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

const SECTIONS = [
  { num: 1, title: 'Información',            path: 'info' },
  { num: 2, title: 'Pilares del club',       path: 'pilares' },
  { num: 3, title: 'Normas',                 path: 'normas' },
  { num: 4, title: 'Test de tiro',           path: 'test-tiro' },
  { num: 5, title: 'Biblioteca',             path: null, external: '/exercises' },
  { num: 6, title: 'Jugadores interesantes', path: 'jugadores' },
  { num: 7, title: 'Notas',                  path: 'notas' },
  { num: 8, title: 'Entrenamientos',         path: null, trainings: true },
];

export default function CuadernoScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [team, setTeam] = useState(null);
  const [profile, setProfile] = useState({});

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, data => {
      setTeam(data.find(t => t.id === teamId) || null);
    });
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToProfile(user.uid, db, appId, setProfile);
  }, [user, db, appId]);

  function handleOpen(section) {
    if (section.external) {
      navigate(section.external);
    } else if (section.trainings) {
      navigate(`/teams/${teamId}/trainings`);
    } else {
      navigate(`/teams/${teamId}/cuaderno/${section.path}`);
    }
  }

  const clubName = profile.nombreClub || 'Uros de Rivas';
  const temporada = getTemporada();

  return (
    <div className="min-h-screen bg-gray-200 py-8 px-4 font-serif text-black print:bg-white print:p-0">

      {/* Toolbar */}
      <div className="max-w-[800px] mx-auto mb-4 flex items-center justify-between print:hidden font-sans">
        <button
          onClick={() => navigate('/teams')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Mis equipos
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold font-sans transition"
        >
          <Printer size={15} /> Imprimir
        </button>
      </div>

      {/* Documento A4 — Portada + Índice */}
      <div className="max-w-[800px] mx-auto bg-white border border-gray-400 shadow-xl print:shadow-none print:border-none print:m-0 min-h-[297mm] flex flex-col">

        {/* ── Portada ── */}
        <div className="flex flex-col items-center justify-center flex-1 py-16 px-12 text-center border-b border-gray-200">

          {/* Cabecera pequeña */}
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 font-sans mb-8">
            Temporada {temporada}
          </p>

          <div className="mb-8">
            <ClubLogo logoUrl={profile.logoClub} className="w-52 h-52" />
          </div>

          {/* Club */}
          <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wide mb-3">
            {clubName}
          </h1>

          {/* Equipo */}
          {team && (
            <p className="text-lg text-gray-500 mb-6">{teamDisplayName(team)}</p>
          )}

          {/* Título del cuaderno */}
          <div className="flex items-center gap-4 mt-2">
            <div className="h-px w-12 bg-gray-300" />
            <p className="text-sm uppercase tracking-widest text-gray-400 font-sans">Cuaderno de Entrenamientos</p>
            <div className="h-px w-12 bg-gray-300" />
          </div>
        </div>

        {/* ── Índice ── */}
        <div className="px-12 py-10">
          <h2 className="font-bold text-xl uppercase tracking-widest text-center mb-8 text-gray-700">
            Índice
          </h2>
          <div>
            {SECTIONS.map(section => (
              <button
                key={section.num}
                onClick={() => handleOpen(section)}
                className="w-full flex items-end py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group text-left px-2"
              >
                <span className="w-8 text-gray-400 text-[15px] shrink-0">{section.num}.</span>
                <span className="text-[15px] text-gray-900 group-hover:text-black shrink-0">{section.title}</span>
                <span className="flex-1 border-b border-dotted border-gray-300 mx-3 mb-1" />
                <span className="font-sans text-gray-400 group-hover:text-gray-700 transition-colors text-sm shrink-0">→</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
