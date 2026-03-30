import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RotateCcw, Plus, Minus } from 'lucide-react';
import ClubLogo from '../../components/ClubLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { subscribeToTeams } from '../../services/teamsService';
import { subscribeToProfile } from '../../services/settingsService';
import { subscribeToTestTiro, saveTestTiro } from '../../services/teamsService';
import { teamDisplayName } from '../TeamsScreen';

function getTemporada() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

function createInitialTable() {
  return {
    fecha: '',
    headers: Array(8).fill(''),
    rows: Array(15).fill(null).map((_, i) => ({
      id: i,
      jugador: '',
      scores: Array(8).fill(''),
    })),
  };
}

export default function TestTiroScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [team, setTeam] = useState(null);
  const [profile, setProfile] = useState({});
  const [tables, setTables] = useState([createInitialTable(), createInitialTable()]);
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
    return subscribeToTestTiro(teamId, user.uid, db, appId, data => {
      if (isFirstLoad.current) {
        if (data) setTables(data);
        isFirstLoad.current = false;
      }
    });
  }, [user, db, appId, teamId]);

  function triggerSave(newTables) {
    setSaveStatus('unsaved');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveTestTiro(teamId, newTables, { uid: user.uid, db, appId });
      setSaveStatus('saved');
    }, 1500);
  }

  function updateFecha(tIndex, value) {
    const updated = tables.map((t, i) => i === tIndex ? { ...t, fecha: value } : t);
    setTables(updated);
    triggerSave(updated);
  }

  function updateHeader(tIndex, colIndex, value) {
    const updated = tables.map((t, i) => {
      if (i !== tIndex) return t;
      const headers = [...t.headers];
      headers[colIndex] = value;
      return { ...t, headers };
    });
    setTables(updated);
    triggerSave(updated);
  }

  function updateRow(tIndex, rowId, field, value, colIndex = null) {
    const updated = tables.map((t, i) => {
      if (i !== tIndex) return t;
      const rows = t.rows.map(r => {
        if (r.id !== rowId) return r;
        if (field === 'jugador') return { ...r, jugador: value };
        if (field === 'score') {
          const scores = [...r.scores];
          scores[colIndex] = value;
          return { ...r, scores };
        }
        return r;
      });
      return { ...t, rows };
    });
    setTables(updated);
    triggerSave(updated);
  }

  function addRowToBoth() {
    const updated = tables.map(t => {
      const newId = t.rows.length > 0 ? Math.max(...t.rows.map(r => r.id)) + 1 : 0;
      return { ...t, rows: [...t.rows, { id: newId, jugador: '', scores: Array(8).fill('') }] };
    });
    setTables(updated);
    triggerSave(updated);
  }

  function removeRowFromBoth() {
    if (tables[0].rows.length <= 1) return;
    const updated = tables.map(t => ({ ...t, rows: t.rows.slice(0, -1) }));
    setTables(updated);
    triggerSave(updated);
  }

  function resetAll() {
    if (!window.confirm('¿Estás seguro de que quieres limpiar todos los datos?')) return;
    const fresh = [createInitialTable(), createInitialTable()];
    setTables(fresh);
    triggerSave(fresh);
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
          <button onClick={addRowToBoth} className="flex items-center px-3 py-1 bg-white border border-gray-400 text-sm hover:bg-gray-50 transition shadow-sm rounded">
            <Plus className="w-4 h-4 mr-1" /> Añadir Fila
          </button>
          <button onClick={removeRowFromBoth} disabled={tables[0].rows.length <= 1} className="flex items-center px-3 py-1 bg-white border border-red-300 text-red-700 text-sm hover:bg-red-50 transition shadow-sm rounded disabled:opacity-40">
            <Minus className="w-4 h-4 mr-1" /> Quitar Fila
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {saveStatus === 'saving' && 'Guardando...'}
            {saveStatus === 'saved' && '✓ Guardado'}
          </span>
          <button onClick={resetAll} className="flex items-center px-3 py-1 bg-white border border-gray-400 text-gray-700 text-sm hover:bg-gray-50 transition shadow-sm rounded">
            <RotateCcw className="w-4 h-4 mr-1" /> Limpiar
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
            <Printer size={15} /> Imprimir A4
          </button>
        </div>
      </div>

      {/* Documento A4 */}
      <div className="py-8 px-4 print:p-0">
        <div className="max-w-[800px] mx-auto bg-white border border-gray-400 pt-10 pb-10 px-12 shadow-xl print:shadow-none print:border-none print:m-0 print:p-8 min-h-[297mm]">

          {/* Cabecera */}
          <div className="flex justify-between items-start mb-8">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-xl tracking-wider uppercase underline decoration-2 underline-offset-4">
                {clubName}
              </h1>
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2 font-sans">
              <p>Temporada {temporada}</p>
              {team && <p className="italic text-xs text-gray-500 mt-0.5">{teamDisplayName(team)}</p>}
            </div>
          </div>

          {/* Dos tablas */}
          <div className="flex flex-col space-y-12">
            {tables.map((table, tIndex) => (
              <div key={tIndex} className="flex flex-col">
                <div className="flex items-end mb-2 text-[15px]">
                  <span className="mr-1">Test de Tiro/Dominio de fecha:</span>
                  <input
                    type="text"
                    value={table.fecha}
                    onChange={e => updateFecha(tIndex, e.target.value)}
                    className="w-48 border-b border-black focus:outline-none bg-transparent font-sans text-sm pb-px px-1"
                  />
                </div>

                <table className="w-full border-collapse border-spacing-0 table-fixed">
                  <thead>
                    <tr>
                      <th className="w-[30%] border-none p-0 h-6" />
                      {table.headers.map((headerText, colIdx) => (
                        <th key={colIdx} className="border border-black bg-transparent font-normal p-0 h-6">
                          <input
                            type="text"
                            value={headerText}
                            onChange={e => updateHeader(tIndex, colIdx, e.target.value)}
                            className="w-full h-full text-center focus:outline-none bg-transparent font-sans text-xs px-1"
                            placeholder={`Test ${colIdx + 1}`}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map(row => (
                      <tr key={row.id}>
                        <td className="border border-black p-0 h-6">
                          <input
                            type="text"
                            value={row.jugador}
                            onChange={e => updateRow(tIndex, row.id, 'jugador', e.target.value)}
                            className="w-full h-full focus:outline-none bg-transparent font-sans text-sm px-2"
                          />
                        </td>
                        {row.scores.map((score, colIdx) => (
                          <td key={colIdx} className="border border-black p-0 h-6">
                            <input
                              type="text"
                              value={score}
                              onChange={e => updateRow(tIndex, row.id, 'score', e.target.value, colIdx)}
                              className="w-full h-full text-center focus:outline-none bg-transparent font-sans text-sm font-semibold text-blue-900 print:text-black"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
