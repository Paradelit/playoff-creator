import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import ClubLogo from '../../components/ClubLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { subscribeToTeams } from '../../services/teamsService';
import { subscribeToProfile } from '../../services/settingsService';
import { subscribeToTeamNotes, saveTeamNotes } from '../../services/teamsService';
import { teamDisplayName } from '../TeamsScreen';

function getTemporada() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export default function NotasScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [team, setTeam] = useState(null);
  const [profile, setProfile] = useState({});
  const [texto, setTexto] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const debounceRef = useRef(null);
  const isFirstLoad = useRef(true);

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

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeamNotes(teamId, user.uid, db, appId, data => {
      if (isFirstLoad.current) {
        setTexto(data);
        isFirstLoad.current = false;
      }
    });
  }, [user, db, appId, teamId]);

  function handleChange(val) {
    setTexto(val);
    setSaveStatus('unsaved');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveTeamNotes(teamId, val, { uid: user.uid, db, appId });
      setSaveStatus('saved');
    }, 1500);
  }

  const clubName = profile.nombreClub || 'Uros de Rivas';
  const temporada = getTemporada();

  return (
    <div className="min-h-screen bg-gray-200 py-8 px-4 font-serif text-black print:bg-white print:p-0">

      {/* Toolbar */}
      <div className="max-w-[800px] mx-auto mb-4 flex items-center justify-between print:hidden font-sans">
        <button
          onClick={() => navigate(`/teams/${teamId}/cuaderno`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Cuaderno
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {saveStatus === 'saving' && 'Guardando...'}
            {saveStatus === 'saved' && '✓ Guardado'}
          </span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            <Printer size={15} /> Imprimir A4
          </button>
        </div>
      </div>

      {/* Documento A4 */}
      <div className="max-w-[800px] mx-auto bg-white border border-gray-400 p-12 shadow-xl print:shadow-none print:border-none print:m-0 print:p-8 min-h-[297mm]">

        {/* Cabecera */}
        <div className="flex justify-between items-start mb-8">
          <div className="w-1/4">
            <ClubLogo logoUrl={profile.logoClub} />
          </div>
          <div className="w-1/2 text-center pt-2">
            <h1 className="font-bold text-xl tracking-wider uppercase underline decoration-2 underline-offset-4 mb-3">
              {clubName}
            </h1>
            <h2 className="font-bold text-2xl tracking-widest uppercase">
              NOTAS
            </h2>
          </div>
          <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2">
            <p>Temporada {temporada}</p>
            {team && <p className="italic text-xs text-gray-500 mt-0.5">{teamDisplayName(team)}</p>}
          </div>
        </div>

        {/* Área de notas — hoja en blanco */}
        <textarea
          value={texto}
          onChange={e => handleChange(e.target.value)}
          placeholder="Escribe aquí tus apuntes y notas..."
          className="w-full min-h-[550px] resize-none border-none focus:outline-none bg-transparent font-sans text-sm leading-relaxed text-gray-800 placeholder-gray-300"
        />

      </div>
    </div>
  );
}
