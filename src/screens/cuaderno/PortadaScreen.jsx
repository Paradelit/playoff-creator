import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { subscribeToTeams } from '../../services/teamsService';
import { subscribeToProfile } from '../../services/settingsService';
import { teamDisplayName } from '../TeamsScreen';

function getTemporada() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export default function PortadaScreen() {
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

  const clubName = profile.nombreClub || 'Mi Club';
  const temporada = getTemporada();

  return (
    <div className="min-h-screen bg-gray-200 py-8 px-4 font-serif text-black print:bg-white print:p-0 flex flex-col items-center">

      {/* Toolbar */}
      <div className="w-full max-w-[800px] mb-4 flex items-center justify-between print:hidden font-sans">
        <button
          onClick={() => navigate(`/teams/${teamId}/cuaderno`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Cuaderno
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg shadow transition text-sm"
        >
          <Printer className="w-4 h-4 mr-2" /> Imprimir Portada
        </button>
      </div>

      {/* Documento A4 */}
      <div className="w-full max-w-[800px] bg-white border border-gray-400 shadow-xl print:shadow-none print:border-none print:m-0 min-h-[297mm] flex flex-col items-center py-24 px-12 relative">

        {/* Título Superior */}
        <h1 className="text-4xl sm:text-5xl font-normal tracking-wide mt-8 mb-20 text-center">
          {clubName.toUpperCase()}
        </h1>

        {/* Espacio para el Logo */}
        <div className="w-64 h-64 sm:w-80 sm:h-80 border-4 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-sans text-xl mb-24 print:border-none print:bg-transparent">
          [ Insertar Logo ]
        </div>

        {/* Nombre del Equipo */}
        <div className="w-full mb-16 text-center">
          <p className="text-4xl sm:text-5xl font-normal py-2">
            {team ? teamDisplayName(team) : ''}
          </p>
        </div>

        {/* Temporada */}
        <div className="flex flex-col items-center space-y-4">
          <p className="text-3xl sm:text-4xl font-normal">
            Temporada {temporada}
          </p>
        </div>

      </div>
    </div>
  );
}
