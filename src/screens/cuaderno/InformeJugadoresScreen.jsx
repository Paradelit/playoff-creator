import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RotateCcw, GripVertical, ChevronDown, ChevronUp, Info } from 'lucide-react';
import ClubLogo from '../../components/ClubLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { subscribeToMembers, subscribeToInformeJugadores, saveInformeJugadores } from '../../services/teamsService';
import { teamDisplayName } from '../../utils/teamUtils';
import { useTeams } from '../../hooks/useTeams';
import { useProfile } from '../../hooks/useProfile';
import { getTemporada } from '../../utils/dateUtils';
import ConfirmDialog from '../../components/ConfirmDialog';

/* ─── Columnas del informe ──────────────────────────────────────────────── */
const COLUMNS = [
  { key: 'ranking', label: 'Ranking', width: 'w-[60px]', type: 'number', placeholder: '' },
  { key: 'nombre', label: 'Nombre', width: 'w-[170px]', type: 'text', placeholder: '' },
  { key: 'compromiso', label: 'Compromiso', width: 'flex-1', type: 'textarea', placeholder: '' },
  { key: 'actitud', label: 'Actitud', width: 'flex-1', type: 'textarea', placeholder: '' },
  { key: 'aptitudes', label: 'Aptitudes', width: 'flex-1', type: 'textarea', placeholder: '' },
  { key: 'capAprender', label: 'Cap. Aprender', width: 'flex-1', type: 'textarea', placeholder: '' },
  { key: 'calidad', label: 'Calidad', width: 'flex-1', type: 'textarea', placeholder: '' },
  { key: 'tiro', label: 'Tiro', width: 'flex-1', type: 'textarea', placeholder: '' },
];

function emptyRow(id, nombre = '') {
  return {
    id,
    nombre,
    ranking: '',
    compromiso: '',
    actitud: '',
    aptitudes: '',
    capAprender: '',
    calidad: '',
    tiro: '',
  };
}

/* ─── Explicación del informe (contenido del PDF) ───────────────────────── */
function ExplicacionInforme({ open, onToggle }) {
  return (
    <div className="mb-6 print:mb-8">
      <button
        onClick={onToggle}
        className="print:hidden flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition mb-2"
      >
        <Info size={15} aria-hidden="true" />
        Cómo cumplimentar el informe
        {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      <div className={`${open ? 'block' : 'hidden'} print:block`}>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-[12.5px] leading-relaxed text-gray-800 font-sans print:bg-transparent print:border-none print:p-0 print:text-[11px]">
          <p className="mb-3">
            Como bien sabéis, somos un club muy grande, por lo que necesito tener con tiempo vuestro punto de vista de
            los/as jugadores/as del/los equipo/s que estáis entrenando para ir trabajando ya en la configuración de la
            próxima temporada. Hay ítems que son muy objetivos y otros que evidentemente son más subjetivos y que quiero
            que libremente me deis vuestra valoración.
          </p>
          <p className="mb-3">
            Sintetizar lo que podáis, pero no dejéis de poner nada que sea importante. Si tenéis que extenderos, lo
            hacéis.
          </p>

          <p className="font-bold mb-1 text-gray-900">Explicación de cada columna:</p>

          <p className="mb-2">
            <span className="font-bold">Ranking.</span>- Esto aunque venga lo primero, será lo último en cumplimentar.
            Una vez tengáis todo relleno, valoráis todo lo que habéis puesto y dais un ranking general con el conjunto
            de todos los ítems. Después, los colocáis por ese orden de Ranking.
          </p>
          <p className="mb-2">
            <span className="font-bold">Nombre.</span>- Nombre y los 2 apellidos (se rellenan automáticamente con los
            jugadores del equipo).
          </p>
          <p className="mb-2">
            <span className="font-bold">Compromiso.</span>- Valoramos las ausencias (faltas de la temporada). Hay que
            valorar los lesionados que han venido, las ausencias injustificadas, las épocas de exámenes que desaparecen,
            etc. También si acude a ver partidos de otros equipos y su implicación en el club.
          </p>
          <p className="mb-2">
            <span className="font-bold">Actitud.</span>- Valoramos la actitud tanto física en darlo todo sin reservarse
            como la mental en el nivel de concentración que tiene a lo largo de los entrenos y partidos. Si hay que
            llamarle la atención porque se dispersa o no se entera de los ejercicios, etc.
          </p>
          <p className="mb-2">
            <span className="font-bold">Aptitudes.</span>- Vuestra opinión de cara al futuro. Si consideráis que puede
            tener más recorrido que otros/as, aunque ahora sea peor jugador/a por haber empezado tarde, o por su
            desarrollo madurativo, o por el físico, su carácter, su comprensión del juego, etc.
          </p>
          <p className="mb-2">
            <span className="font-bold">Cap. Aprender.</span>- Puntuamos la evolución que ha llevado en esta temporada.
            Hay jugadores/as que se quedan estancados y otros/as que han evolucionado mucho, aunque aún no lleguen al
            nivel de otros/as.
          </p>
          <p className="mb-2">
            <span className="font-bold">Calidad.</span>- Calidad en el equipo a día de hoy. Qué jugador es más
            importante a la hora de jugar por todo lo que hace tanto en defensa como en ataque. Valoramos el resultado,
            la capacidad de decisión, la ejecución y el físico.
          </p>
          <p className="mb-0">
            <span className="font-bold">Tiro.</span>- Puntuamos de 0 a 10 su tiro en cuanto a mecánica a día de hoy y
            qué detalle/s creéis que debe corregir aún.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────────────────── */
export default function InformeJugadoresScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const { teams } = useTeams();
  const { profile } = useProfile();
  const team = teams.find((t) => t.id === teamId) || null;

  const [rows, setRows] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [showExplicacion, setShowExplicacion] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const debounceRef = useRef(null);
  const isFirstLoad = useRef(true);
  const membersRef = useRef([]);

  /* ─── Drag state ─── */
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const dragNodeRef = useRef(null);
  const touchStartY = useRef(null);
  const rowRefs = useRef([]);

  /* ─── Cargar miembros del equipo ─── */
  useEffect(() => {
    if (!user || !db) return;
    return subscribeToMembers(teamId, user.uid, db, appId, (data) => {
      membersRef.current = data.filter((m) => m.tipo === 'jugador');
    });
  }, [user, db, appId, teamId]);

  /* ─── Cargar datos del informe ─── */
  useEffect(() => {
    if (!user || !db) return;
    return subscribeToInformeJugadores(
      teamId,
      user.uid,
      db,
      appId,
      ({ rows: loadedRows, observaciones: loadedObs }) => {
        if (isFirstLoad.current) {
          if (loadedRows.length > 0) {
            setRows(loadedRows);
          } else {
            // Auto-poblar con los jugadores del equipo
            const jugadores = membersRef.current;
            if (jugadores.length > 0) {
              setRows(jugadores.map((j, i) => emptyRow(i, j.nombre || '')));
            } else {
              setRows(Array.from({ length: 12 }, (_, i) => emptyRow(i)));
            }
          }
          setObservaciones(loadedObs || '');
          isFirstLoad.current = false;
        }
      },
    );
  }, [user, db, appId, teamId]);

  /* ─── Auto-save con debounce ─── */
  const triggerSave = useCallback(
    (newRows, newObservaciones) => {
      setSaveStatus('unsaved');
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        await saveInformeJugadores(
          teamId,
          { rows: newRows, observaciones: newObservaciones },
          { uid: user.uid, db, appId },
        );
        setSaveStatus('saved');
      }, 1500);
    },
    [teamId, user, db, appId],
  );

  function updateRow(id, field, value) {
    const updated = rows.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    setRows(updated);
    triggerSave(updated, observaciones);
  }

  function resetAll() {
    setShowResetConfirm(true);
  }

  function confirmReset() {
    setShowResetConfirm(false);
    const jugadores = membersRef.current;
    const fresh =
      jugadores.length > 0
        ? jugadores.map((j, i) => emptyRow(i, j.nombre || ''))
        : Array.from({ length: 12 }, (_, i) => emptyRow(i));
    setRows(fresh);
    setObservaciones('');
    triggerSave(fresh, '');
  }

  /* ─── Ordenar por ranking ─── */
  function sortByRanking() {
    const sorted = [...rows].sort((a, b) => {
      const ra = a.ranking !== '' ? Number(a.ranking) : Infinity;
      const rb = b.ranking !== '' ? Number(b.ranking) : Infinity;
      return ra - rb;
    });
    setRows(sorted);
    triggerSave(sorted, observaciones);
  }

  /* ─── Drag & Drop (mouse) ─── */
  function handleDragStart(e, index) {
    setDragIndex(index);
    dragNodeRef.current = e.target;
    e.dataTransfer.effectAllowed = 'move';
    // Hacerlo transparente momentáneamente
    setTimeout(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4';
    }, 0);
  }

  function handleDragEnd() {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
    setDragIndex(null);
    setOverIndex(null);
    dragNodeRef.current = null;
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== overIndex) setOverIndex(index);
  }

  function handleDrop(e, index) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      handleDragEnd();
      return;
    }
    const updated = [...rows];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setRows(updated);
    triggerSave(updated, observaciones);
    handleDragEnd();
  }

  /* ─── Drag & Drop (touch) ─── */
  function handleTouchStart(e, index) {
    setDragIndex(index);
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e) {
    if (dragIndex === null) return;
    const touch = e.touches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elementBelow) {
      const row = elementBelow.closest('[data-row-index]');
      if (row) {
        const idx = parseInt(row.getAttribute('data-row-index'), 10);
        if (idx !== overIndex) setOverIndex(idx);
      }
    }
  }

  function handleTouchEnd() {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const updated = [...rows];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(overIndex, 0, moved);
      setRows(updated);
      triggerSave(updated, observaciones);
    }
    setDragIndex(null);
    setOverIndex(null);
    touchStartY.current = null;
  }

  function updateObservaciones(value) {
    setObservaciones(value);
    triggerSave(rows, value);
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
          <ArrowLeft size={16} aria-hidden="true" /> Cuaderno
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={sortByRanking}
            className="flex items-center px-3 py-1 bg-white border border-blue-300 text-blue-700 text-sm hover:bg-blue-50 transition shadow-sm rounded"
          >
            Ordenar por Ranking
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {saveStatus === 'saving' && 'Guardando...'}
            {saveStatus === 'saved' && '✓ Guardado'}
          </span>
          <button
            onClick={resetAll}
            className="flex items-center px-3 py-1 bg-white border border-gray-400 text-gray-700 text-sm hover:bg-gray-50 transition shadow-sm rounded"
          >
            <RotateCcw className="w-4 h-4 mr-1" aria-hidden="true" /> Limpiar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            <Printer size={15} aria-hidden="true" /> Imprimir A4
          </button>
        </div>
      </div>

      {/* Documento A4 */}
      <div className="py-8 px-4 print:p-0">
        <div className="max-w-[1100px] mx-auto bg-white border border-gray-400 pt-10 pb-10 px-8 shadow-xl print:shadow-none print:border-none print:m-0 print:p-6 print:max-w-none">
          {/* Cabecera */}
          <div className="flex justify-between items-start mb-6">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-xl tracking-wider uppercase underline decoration-2 underline-offset-4">
                {clubName}
              </h1>
              <h2 className="font-bold text-lg uppercase tracking-wide mt-2">INFORME JUGADORES/AS</h2>
              {team && <p className="text-sm text-gray-600 mt-1 font-sans">Equipo: {teamDisplayName(team)}</p>}
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2 font-sans">
              <p>Temporada {temporada}</p>
            </div>
          </div>

          {/* Explicación colapsable */}
          <ExplicacionInforme open={showExplicacion} onToggle={() => setShowExplicacion(!showExplicacion)} />

          {/* Observaciones generales */}
          <div className="mb-4 flex items-start gap-2 text-[12px] text-gray-500 font-sans print:hidden">
            <GripVertical size={14} className="mt-0.5 text-gray-400 shrink-0" aria-hidden="true" />
            <span>
              Arrastra las filas con el icono de la izquierda para reordenar el ranking. También puedes asignar un
              número de ranking a cada jugador y pulsar «Ordenar por Ranking».
            </span>
          </div>

          {/* Tabla del informe */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px] print:text-[9px]">
              <thead>
                <tr>
                  <th className="print:hidden w-[30px] border border-gray-300 bg-gray-100 p-1" />
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`border border-gray-300 bg-gray-100 p-1.5 text-center font-bold uppercase text-[10px] tracking-wide text-gray-700 print:bg-gray-100 print:text-[8px] ${col.key === 'ranking' ? 'w-[50px]' : col.key === 'nombre' ? 'w-[140px] print:w-[100px]' : ''}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    data-row-index={index}
                    ref={(el) => (rowRefs.current[index] = el)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onTouchStart={(e) => handleTouchStart(e, index)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`transition-colors ${
                      overIndex === index && dragIndex !== null
                        ? dragIndex < index
                          ? 'border-b-2 border-b-blue-500'
                          : 'border-t-2 border-t-blue-500'
                        : ''
                    } ${dragIndex === index ? 'opacity-40 bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Drag handle */}
                    <td className="print:hidden border border-gray-300 p-0 w-[30px] text-center cursor-grab active:cursor-grabbing select-none">
                      <div className="flex items-center justify-center h-full py-2">
                        <GripVertical size={14} className="text-gray-400" aria-hidden="true" />
                      </div>
                    </td>

                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={`border border-gray-300 p-0 align-top ${col.key === 'ranking' ? 'w-[50px]' : col.key === 'nombre' ? 'w-[140px] print:w-[100px]' : ''}`}
                      >
                        {col.type === 'textarea' ? (
                          <textarea
                            value={row[col.key] || ''}
                            onChange={(e) => updateRow(row.id, col.key, e.target.value)}
                            aria-label={`${col.label} de jugador fila ${row.id + 1}`}
                            className="w-full min-h-[52px] resize-y p-1.5 focus:outline-none bg-transparent font-sans text-[11px] leading-tight print:text-[9px] print:min-h-0 print:resize-none"
                            rows={2}
                          />
                        ) : col.key === 'ranking' ? (
                          <input
                            type="number"
                            min="1"
                            value={row.ranking || ''}
                            onChange={(e) => updateRow(row.id, 'ranking', e.target.value)}
                            aria-label={`Ranking de jugador fila ${row.id + 1}`}
                            className="w-full h-full p-1.5 text-center focus:outline-none bg-transparent font-sans text-sm font-bold text-blue-800 print:text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={row[col.key] || ''}
                            onChange={(e) => updateRow(row.id, col.key, e.target.value)}
                            aria-label={`${col.label} de jugador fila ${row.id + 1}`}
                            className="w-full h-full p-1.5 focus:outline-none bg-transparent font-sans text-[11px] print:text-[9px]"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Observaciones generales (campo libre al final) */}
          <div className="mt-8 border border-gray-300 p-3">
            <p className="font-bold text-sm mb-1">Observaciones.-</p>
            <div className="border-t border-gray-200 pt-2">
              <textarea
                value={observaciones}
                onChange={(e) => updateObservaciones(e.target.value)}
                className="w-full min-h-[80px] resize-y focus:outline-none bg-transparent font-sans text-sm print:min-h-[40px]"
                placeholder="Observaciones generales sobre el equipo..."
                aria-label="Observaciones generales sobre el equipo"
              />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        title="Limpiar informe"
        message="¿Estás seguro de que quieres limpiar todos los datos del informe? Se volverán a cargar los jugadores del equipo con los campos vacíos. Esta acción no se puede deshacer."
        confirmLabel="Limpiar"
        destructive
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
