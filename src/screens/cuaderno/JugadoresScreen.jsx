import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Printer } from 'lucide-react';
import ClubLogo from '../../components/ClubLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { subscribeToTeams } from '../../services/teamsService';
import { subscribeToProfile } from '../../services/settingsService';
import { subscribeToTeamJugadores, saveTeamJugadores } from '../../services/teamsService';
import { teamDisplayName } from '../TeamsScreen';

function getTemporada() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

function emptyJugador(id) {
  return { id, equipo: '', numero: '', nombre: '', categoria: '', anioNac: '', observaciones: '' };
}

function emptyGrid() {
  return Array.from({ length: 9 }, (_, i) => emptyJugador(i));
}

export default function JugadoresScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [team, setTeam] = useState(null);
  const [profile, setProfile] = useState({});
  const [jugadores, setJugadores] = useState(emptyGrid());
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
    return subscribeToTeamJugadores(teamId, user.uid, db, appId, data => {
      if (isFirstLoad.current) {
        setJugadores(data.length > 0 ? data : emptyGrid());
        isFirstLoad.current = false;
      }
    });
  }, [user, db, appId, teamId]);

  function triggerSave(lista) {
    setSaveStatus('unsaved');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveTeamJugadores(teamId, lista, { uid: user.uid, db, appId });
      setSaveStatus('saved');
    }, 1500);
  }

  function updateJugador(id, field, value) {
    const updated = jugadores.map(j => j.id === id ? { ...j, [field]: value } : j);
    setJugadores(updated);
    triggerSave(updated);
  }

  function addRow() {
    const nextId = jugadores.length > 0 ? Math.max(...jugadores.map(j => j.id)) + 1 : 0;
    const newRow = Array.from({ length: 3 }, (_, i) => emptyJugador(nextId + i));
    const updated = [...jugadores, ...newRow];
    setJugadores(updated);
    triggerSave(updated);
  }

  function removeRow() {
    if (jugadores.length <= 3) return;
    const updated = jugadores.slice(0, -3);
    setJugadores(updated);
    triggerSave(updated);
  }

  const clubName = profile.nombreClub || 'Uros de Rivas';
  const temporada = getTemporada();

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
        <div className="flex items-center gap-2">
          <button onClick={addRow} className="flex items-center px-3 py-1 bg-white border border-gray-400 text-sm hover:bg-gray-50 transition shadow-sm rounded">
            <Plus className="w-4 h-4 mr-1" /> Añadir Fila
          </button>
          <button onClick={removeRow} disabled={jugadores.length <= 3} className="flex items-center px-3 py-1 bg-white border border-red-300 text-red-700 text-sm hover:bg-red-50 transition shadow-sm rounded disabled:opacity-40">
            <Minus className="w-4 h-4 mr-1" /> Quitar Fila
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {saveStatus === 'saving' && 'Guardando...'}
            {saveStatus === 'saved' && '✓ Guardado'}
          </span>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
            <Printer size={15} /> Imprimir A4
          </button>
        </div>
      </div>

      {/* Documento A4 */}
      <div className="py-8 px-4 print:p-0">
        <div className="max-w-[900px] mx-auto bg-white border border-gray-400 p-8 shadow-xl print:shadow-none print:border-none print:p-6">

          {/* Cabecera */}
          <div className="flex justify-between items-start mb-6">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-xl tracking-wide uppercase underline decoration-2 underline-offset-4 mb-2">
                {clubName}
              </h1>
              <h2 className="font-bold text-lg uppercase tracking-wide">
                JUGADORES/AS INTERESANTES
              </h2>
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2 font-sans">
              <p>Temporada {temporada}</p>
              {team && <p className="italic text-xs mt-0.5">{teamDisplayName(team)}</p>}
            </div>
          </div>

          {/* Texto explicativo */}
          <div className="text-[13px] leading-relaxed text-justify mb-8 px-4 text-gray-900">
            <p className="mb-2">
              Cualquier jugador/a que veamos, de equipos del entorno de Rivas, lo anotamos para tener los datos que
              podamos y después iremos a verlo más detenidamente. Es posible que solo podamos coger algunos de estos
              datos, pero cuantos más mejor. Mínimo equipo y categoría para poder ir a verlos. No tiene por qué ser de
              nuestra categoría, podría ser del partido que se juega antes del nuestro y ver ahí algo interesante.
            </p>
            <p className="mb-2">
              En observaciones poned la posición de juego y lo que os hace verle interesante (muy grande, muy rápido/a,
              base director, el tiro, etc...).
            </p>
            <p>
              Tras tomar datos, poner un whatsapp o un mail para anotarlo y preparamos para ir a verlo en otro partido.
            </p>
          </div>

          {/* Cuadrícula de fichas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-8 px-4">
            {jugadores.map(jugador => (
              <div key={jugador.id} className="border border-black flex flex-col text-sm break-inside-avoid">
                <div className="flex border-b border-black">
                  <span className="font-bold p-1 w-20">Equipo.-</span>
                  <input type="text" value={jugador.equipo}
                    onChange={e => updateJugador(jugador.id, 'equipo', e.target.value)}
                    className="flex-1 p-1 focus:outline-none bg-transparent font-sans text-sm" />
                </div>
                <div className="flex border-b border-black">
                  <span className="font-bold p-1 w-12">Nº.-</span>
                  <input type="text" value={jugador.numero}
                    onChange={e => updateJugador(jugador.id, 'numero', e.target.value)}
                    className="flex-1 p-1 focus:outline-none bg-transparent font-sans text-sm" />
                </div>
                <div className="flex border-b border-black">
                  <span className="font-bold p-1 w-20">Nombre.-</span>
                  <input type="text" value={jugador.nombre}
                    onChange={e => updateJugador(jugador.id, 'nombre', e.target.value)}
                    className="flex-1 p-1 focus:outline-none bg-transparent font-sans text-sm" />
                </div>
                <div className="flex border-b border-black">
                  <span className="font-bold p-1 w-24">Categoría.-</span>
                  <input type="text" value={jugador.categoria}
                    onChange={e => updateJugador(jugador.id, 'categoria', e.target.value)}
                    className="flex-1 p-1 focus:outline-none bg-transparent font-sans text-sm" />
                </div>
                <div className="flex border-b border-black">
                  <span className="font-bold p-1 w-24">Año Nac.-</span>
                  <input type="text" value={jugador.anioNac}
                    onChange={e => updateJugador(jugador.id, 'anioNac', e.target.value)}
                    className="flex-1 p-1 focus:outline-none bg-transparent font-sans text-sm" />
                </div>
                <div className="flex flex-col p-1 min-h-[90px]">
                  <span className="font-bold mb-1">Observaciones.-</span>
                  <textarea value={jugador.observaciones}
                    onChange={e => updateJugador(jugador.id, 'observaciones', e.target.value)}
                    className="w-full flex-1 resize-none focus:outline-none bg-transparent font-sans text-xs leading-tight" />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
