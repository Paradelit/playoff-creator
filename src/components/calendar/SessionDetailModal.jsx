import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ClipboardList, ArrowRight, Trophy, Search, BarChart3, Pencil, Trash2, Repeat, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { saveCalendarSession } from '../../services/calendarService';
import { updatePlayoffMatchScoreFromSession, readPlayoffGameResult } from '../../services/bracketCalendarSyncService';
import { isMinibasketSextos } from '../../utils/minibasketUtils';
import { formatDateDisplay } from '../../utils/dateUtils';
import { readJugadoresConvocados } from '../../utils/calendarUtils';
import { DetailRow, QuickResultado } from './CalendarHelpers';
import Dialog from '../Dialog';
import ConvocatoriaModal from './ConvocatoriaModal';
import { useCompetitions } from '../../hooks/useCompetitions';

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
  const titleId = useId();
  const [showConvocatoria, setShowConvocatoria] = useState(false);
  const { competitions } = useCompetitions(session.teamId);
  const sessionTeam = teams.find((t) => t.id === session.teamId) || null;
  const competition = (competitions || []).find((c) => c.id === session.competitionId) || null;

  const headerIcon =
    session.tipo === 'playoff' ? (
      <Trophy size={18} className="text-amber-600" aria-hidden="true" />
    ) : session.tipo === 'partido' ? (
      <Trophy size={18} className="text-rose-600" aria-hidden="true" />
    ) : (
      <ClipboardList size={18} className="text-blue-600" aria-hidden="true" />
    );

  const titleText =
    session.tipo === 'playoff'
      ? `Torneo vs ${session.rival}`
      : session.tipo === 'partido'
        ? `vs ${session.rival || 'Rival'}`
        : `Entrenamiento #${getTrainingNum(session)}`;

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[calc(100vh-5.5rem)] sm:max-h-[92vh] overflow-y-auto overflow-x-hidden animate-in zoom-in-95 duration-200 my-auto shrink-0"
    >
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${session.tipo === 'playoff' ? 'bg-amber-100' : session.tipo === 'partido' ? 'bg-rose-100' : 'bg-blue-100'}`}
            aria-hidden="true"
          >
            {headerIcon}
          </div>
          <div className="min-w-0">
            <p id={titleId} className="font-bold text-slate-800 truncate">
              {titleText}
            </p>
            <p className="text-xs text-slate-500 truncate">{session.teamName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-4 flex flex-col gap-2">
        <DetailRow label="Fecha" value={formatDateDisplay(session.fecha)} />
        {session.recurrenceId && !session.recurrenceDetached && (
          <div className="flex items-center gap-1.5 -mt-1 mb-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              <Repeat size={10} aria-hidden="true" /> Semanal
            </span>
          </div>
        )}
        <DetailRow
          label="Horario"
          value={
            session.horaInicio && session.horaFin
              ? `${session.horaInicio} – ${session.horaFin}`
              : session.horaInicio || '–'
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
            {readJugadoresConvocados(session) && (
              <div className="mt-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Convocados</span>
                <p className="text-sm text-slate-700 whitespace-pre-line mt-0.5">{readJugadoresConvocados(session)}</p>
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
        {(() => {
          const todayYMD = new Date().toISOString().slice(0, 10);
          const isPast = session.fecha && session.fecha < todayYMD;
          const isMatch = session.tipo === 'partido' || session.tipo === 'playoff';
          const isMinibasket = isMinibasketSextos(teams.find((t) => t.id === session.teamId));
          const navStateFor = () => (session.tipo === 'playoff' ? { state: { playoffSession: session } } : undefined);

          // Primary action: one per session type / state. Blue for in-app utility,
          // amber for the trophy reservation. No other accent colors.
          let primary = null;
          if (session.tipo === 'entrenamiento') {
            primary = {
              key: 'training',
              icon: ClipboardList,
              label: creatingTraining ? 'Abriendo...' : 'Abrir entrenamiento',
              tone: 'blue',
              disabled: creatingTraining || !session.teamId,
              onClick: () => {
                if (session.trainingId) {
                  navigate(`/teams/${session.teamId}/trainings/${session.trainingId}`);
                } else {
                  onCreateTraining(session);
                }
              },
            };
          } else if (session.tipo === 'playoff') {
            primary = {
              key: 'cuadro',
              icon: Trophy,
              label: 'Ver cuadro del torneo',
              tone: 'amber',
              onClick: () => {
                onClose();
                navigate(`/playoffs?teamId=${session.teamId}`);
              },
            };
          } else if (session.tipo === 'partido' && isPast) {
            primary = {
              key: 'analysis',
              icon: BarChart3,
              label: 'Análisis post-partido',
              tone: 'blue',
              onClick: () => {
                onClose();
                navigate(`/calendar/${session.id}/analysis`);
              },
            };
          } else if (session.tipo === 'partido') {
            primary = {
              key: 'convocatoria',
              icon: Send,
              label: session.convocatoriaSentAt ? 'Convocatoria enviada · Reenviar' : 'Mandar convocatoria',
              tone: 'blue',
              onClick: () => setShowConvocatoria(true),
            };
          }

          // Secondary actions: compact slate buttons. Built per session type, primary excluded.
          const secondary = [];
          if (isMatch) {
            if (primary?.key !== 'convocatoria') {
              secondary.push({
                key: 'convocatoria',
                icon: Send,
                label: session.convocatoriaSentAt ? 'Reenviar convocatoria' : 'Mandar convocatoria',
                onClick: () => setShowConvocatoria(true),
              });
            }
            secondary.push({
              key: 'scouting',
              icon: Search,
              label: 'Scouting rival',
              onClick: () => {
                onClose();
                navigate(`/calendar/${session.id}/scouting`, navStateFor());
              },
            });
            if (primary?.key !== 'analysis') {
              secondary.push({
                key: 'analysis',
                icon: BarChart3,
                label: 'Análisis post-partido',
                onClick: () => {
                  onClose();
                  navigate(`/calendar/${session.id}/analysis`, navStateFor());
                },
              });
            }
            if (isMinibasket) {
              secondary.push({
                key: 'planilla',
                icon: ClipboardList,
                label: 'Planilla de Sextos',
                onClick: () => {
                  onClose();
                  navigate(`/calendar/${session.id}/planilla`, navStateFor());
                },
              });
            }
          }

          const primaryClass =
            primary?.tone === 'amber'
              ? 'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400'
              : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-400';

          return (
            <>
              {primary && (
                <button
                  type="button"
                  onClick={primary.onClick}
                  disabled={primary.disabled}
                  className={`w-full ${primaryClass} text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
                >
                  <primary.icon size={16} aria-hidden="true" />
                  {primary.label}
                  {!primary.disabled && <ArrowRight size={15} aria-hidden="true" />}
                </button>
              )}
              {secondary.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {secondary.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={a.onClick}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                    >
                      <a.icon size={14} aria-hidden="true" /> {a.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            <Pencil size={14} aria-hidden="true" /> Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(session)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
          >
            <Trash2 size={14} aria-hidden="true" /> Eliminar
          </button>
        </div>
      </div>
      {showConvocatoria && (
        <ConvocatoriaModal
          session={session}
          team={sessionTeam}
          competition={competition}
          onClose={() => setShowConvocatoria(false)}
        />
      )}
    </Dialog>
  );
}

function PlayoffResultado({ session, db, appId, user, onClose }) {
  const resultado = readPlayoffGameResult(session);

  return (
    <QuickResultado
      session={{ ...session, resultado }}
      onSave={async (res) => {
        const { bracketId, bracketMatchId, gameIndex, isMyTeamTeam1 } = session;
        if (!bracketId || !bracketMatchId) return;
        await updatePlayoffMatchScoreFromSession(
          { bracketId, bracketMatchId, gameIndex: gameIndex || 0, isMyTeamTeam1 },
          { local: res.local, visitante: res.visitante },
          { uid: user.uid, db, appId },
        );
        onClose();
      }}
    />
  );
}
