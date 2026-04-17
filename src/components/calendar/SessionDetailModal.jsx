import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoc, setDoc } from 'firebase/firestore';
import { X, ClipboardList, ArrowRight, Trophy, Search, BarChart3, Pencil, Trash2, Repeat } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { saveCalendarSession } from '../../services/calendarService';
import { userDocRef } from '../../services/firestoreHelpers';
import { isMinibasketSextos } from '../../utils/minibasketUtils';
import { formatDateDisplay } from '../../utils/dateUtils';
import { calculateMatchWinner } from '../../utils/bracketEngine';
import { DetailRow, QuickResultado } from './CalendarHelpers';

export default function SessionDetailModal({
  session,
  teams,
  getTrainingNum,
  creatingTraining,
  onClose,
  onEdit,
  onDelete,
  onCreateTraining,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[calc(100vh-5.5rem)] sm:max-h-[92vh] overflow-y-auto overflow-x-hidden animate-in zoom-in-95 duration-200 my-auto shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${session.tipo === 'playoff' ? 'bg-amber-100' : session.tipo === 'partido' ? 'bg-rose-100' : 'bg-blue-100'}`}
            >
              {session.tipo === 'playoff' ? (
                <Trophy size={18} className="text-amber-600" />
              ) : session.tipo === 'partido' ? (
                <Trophy size={18} className="text-rose-600" />
              ) : (
                <ClipboardList size={18} className="text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">
                {session.tipo === 'playoff'
                  ? `Torneo vs ${session.rival}`
                  : session.tipo === 'partido'
                    ? `vs ${session.rival || 'Rival'}`
                    : `Entrenamiento #${getTrainingNum(session)}`}
              </p>
              <p className="text-xs text-slate-500 truncate">{session.teamName}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2">
          <DetailRow label="Fecha" value={formatDateDisplay(session.fecha)} />
          {session.recurrenceId && !session.recurrenceDetached && (
            <div className="flex items-center gap-1.5 -mt-1 mb-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                <Repeat size={10} /> Semanal
              </span>
            </div>
          )}
          <DetailRow
            label="Horario"
            value={
              session.horaInicio && session.horaFin
                ? `${session.horaInicio} – ${session.horaFin}`
                : session.horaInicio || '—'
            }
          />
          {session.lugar && <DetailRow label="Lugar" value={session.lugar} />}
          {session.tipo === 'playoff' && (
            <>
              <DetailRow label="Torneo" value={session.bracketName} />
              <DetailRow label="Ronda" value={session.matchTitle} />
              {session.gamesCount > 1 && (
                <DetailRow label="Partido" value={`${session.gameIndex + 1} de ${session.gamesCount}`} />
              )}
            </>
          )}
          {(session.tipo === 'partido' || session.tipo === 'playoff') && (
            <>
              {session.rival && <DetailRow label="Rival" value={session.rival} />}
              <DetailRow label="Campo" value={session.esLocal ? 'Local' : 'Visitante'} />
              {session.convocatoria && (
                <div className="mt-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Convocatoria</span>
                  <p className="text-sm text-slate-700 whitespace-pre-line mt-0.5">{session.convocatoria}</p>
                </div>
              )}
              {session.tipo === 'partido' && (
                <QuickResultado
                  session={session}
                  onSave={async (resultado) => {
                    const updated = { ...session, resultado };
                    await saveCalendarSession(updated, { uid: user.uid, db, appId });
                    onClose();
                  }}
                />
              )}
              {session.tipo === 'playoff' && (
                <PlayoffResultado session={session} db={db} appId={appId} user={user} onClose={onClose} />
              )}
            </>
          )}
        </div>
        <div className="px-5 pb-5 flex flex-col gap-2">
          {session.tipo === 'playoff' && (
            <button
              onClick={() => {
                onClose();
                navigate(`/playoffs?teamId=${session.teamId}`);
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Trophy size={16} /> Ver cuadro del torneo <ArrowRight size={15} />
            </button>
          )}
          {session.tipo === 'entrenamiento' && (
            <button
              onClick={() => {
                if (session.trainingId) {
                  navigate(`/teams/${session.teamId}/trainings/${session.trainingId}`);
                } else {
                  onCreateTraining(session);
                }
              }}
              disabled={creatingTraining || !session.teamId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              <ClipboardList size={16} />
              {creatingTraining ? 'Abriendo...' : 'Abrir entrenamiento'}
              <ArrowRight size={15} />
            </button>
          )}
          {(session.tipo === 'partido' || session.tipo === 'playoff') && (
            <>
              {isMinibasketSextos(teams.find((t) => t.id === session.teamId)) && (
                <button
                  onClick={() => {
                    const navState = session.tipo === 'playoff' ? { state: { playoffSession: session } } : undefined;
                    onClose();
                    navigate(`/calendar/${session.id}/planilla`, navState);
                  }}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <ClipboardList size={16} /> Planilla de Sextos <ArrowRight size={15} />
                </button>
              )}
              <button
                onClick={() => {
                  const navState = session.tipo === 'playoff' ? { state: { playoffSession: session } } : undefined;
                  onClose();
                  navigate(`/calendar/${session.id}/scouting`, navState);
                }}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Search size={16} /> Scouting rival <ArrowRight size={15} />
              </button>
              <button
                onClick={() => {
                  const navState = session.tipo === 'playoff' ? { state: { playoffSession: session } } : undefined;
                  onClose();
                  navigate(`/calendar/${session.id}/analysis`, navState);
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
              >
                <BarChart3 size={16} /> Análisis post-partido <ArrowRight size={15} />
              </button>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
            >
              <Pencil size={14} /> Editar
            </button>
            <button
              onClick={() => onDelete(session)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm transition"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayoffResultado({ session, db, appId, user, onClose }) {
  const resultado = (() => {
    const sc = session.scores?.[session.gameIndex];
    if (!sc) return { local: '', visitante: '' };
    const myS = session.isMyTeamTeam1 ? sc.s1 : sc.s2;
    const rivS = session.isMyTeamTeam1 ? sc.s2 : sc.s1;
    return { local: myS || '', visitante: rivS || '' };
  })();

  return (
    <QuickResultado
      session={{ ...session, resultado }}
      onSave={async (res) => {
        const { bracketId, bracketMatchId, gameIndex, isMyTeamTeam1 } = session;
        if (!bracketId || !bracketMatchId) return;
        const bracketRef = userDocRef(db, appId, user.uid, 'brackets', bracketId);
        const snap = await getDoc(bracketRef);
        if (!snap.exists()) return;
        const bracketDoc = snap.data();
        const match = bracketDoc.bracketData?.state?.[bracketMatchId];
        if (!match) return;
        const newScores = [...(match.scores || [])];
        newScores[gameIndex] = {
          s1: isMyTeamTeam1 ? res.local : res.visitante,
          s2: isMyTeamTeam1 ? res.visitante : res.local,
        };
        const updatedMatch = { ...match, scores: newScores };
        const winner = calculateMatchWinner(updatedMatch);
        const updatedState = {
          ...bracketDoc.bracketData.state,
          [bracketMatchId]: { ...updatedMatch, winner },
        };
        if (winner && match.nextId && match.slot) {
          updatedState[match.nextId] = {
            ...updatedState[match.nextId],
            [match.slot]: winner,
          };
        }
        await setDoc(bracketRef, {
          ...bracketDoc,
          bracketData: { ...bracketDoc.bracketData, state: updatedState },
        });
        onClose();
      }}
    />
  );
}
