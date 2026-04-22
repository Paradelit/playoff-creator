import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Trophy } from 'lucide-react';
import { TEAM_COLORS, teamColorIndex } from '../../utils/constants';
import { hhmmToMinutes, minutesToHHMM, toYMD } from '../../utils/dateUtils';

const PX_PER_MIN = 1;
const LABEL_WIDTH = 56;
const DEFAULT_RANGE_START = 8 * 60;
const DEFAULT_RANGE_END = 22 * 60;
const MIN_BLOCK_HEIGHT = 40;

function sessionBgClass(s) {
  if (s.tipo === 'playoff') return 'bg-amber-500 text-white';
  if (s.tipo === 'partido') return 'bg-rose-500 text-white';
  return TEAM_COLORS[teamColorIndex(s.teamId)];
}

function sessionIcon(s) {
  if (s.tipo === 'playoff' || s.tipo === 'partido') return <Trophy size={14} />;
  return <ClipboardList size={14} />;
}

function sessionTitle(s, getTrainingNum) {
  if (s.tipo === 'playoff') return `Torneo vs ${s.rival || 'Rival'}`;
  if (s.tipo === 'partido') return `vs ${s.rival || 'Rival'}`;
  return `Entrenamiento #${getTrainingNum ? getTrainingNum(s) : ''}`.trim();
}

function parseSessionTimes(s) {
  const start = hhmmToMinutes(s.horaInicio);
  if (start == null) return null;
  let end = hhmmToMinutes(s.horaFin);
  if (end == null || end <= start) end = Math.min(24 * 60, start + 60);
  return { start, end };
}

function computeRange(timed) {
  if (timed.length === 0) {
    return { rangeStart: DEFAULT_RANGE_START, rangeEnd: DEFAULT_RANGE_END };
  }
  const earliest = Math.min(...timed.map((t) => t.start));
  const latest = Math.max(...timed.map((t) => t.end));
  const rangeStart = Math.max(0, Math.floor((earliest - 60) / 60) * 60);
  const rangeEnd = Math.min(24 * 60, Math.ceil((latest + 60) / 60) * 60);
  return { rangeStart, rangeEnd };
}

function assignColumns(timed) {
  const sorted = [...timed].sort((a, b) => a.start - b.start || a.end - b.end);
  const columnsEnd = [];
  const items = sorted.map((t) => {
    let col = columnsEnd.findIndex((e) => e <= t.start);
    if (col === -1) {
      col = columnsEnd.length;
      columnsEnd.push(t.end);
    } else {
      columnsEnd[col] = t.end;
    }
    return { ...t, col };
  });
  return { items, cols: Math.max(1, columnsEnd.length) };
}

function computeGapBadges(timed) {
  const sorted = [...timed].sort((a, b) => a.start - b.start);
  const badges = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const diff = b.start - a.end;
    if (diff >= 30) {
      badges.push({
        key: `gap-${i}`,
        at: (a.end + b.start) / 2,
        type: 'gap',
        text: formatGap(diff),
      });
    } else if (diff < 0) {
      badges.push({
        key: `over-${i}`,
        at: b.start,
        type: 'overlap',
        text: 'Solape',
      });
    }
  }
  return badges;
}

function formatGap(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `hueco ${m}m`;
  if (m === 0) return `hueco ${h}h`;
  return `hueco ${h}h${m}m`;
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function UntimedRow({ session, onSelectSession, getTrainingNum }) {
  const isPartido = session.tipo === 'partido';
  const isPlayoff = session.tipo === 'playoff';
  const colorClass = TEAM_COLORS[teamColorIndex(session.teamId)].split(' ')[0];
  return (
    <button
      onClick={() => onSelectSession(session)}
      className="w-full text-left flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPlayoff ? 'bg-amber-100' : isPartido ? 'bg-rose-100' : 'bg-blue-100'}`}
      >
        {isPlayoff ? (
          <Trophy size={16} className="text-amber-600" />
        ) : isPartido ? (
          <Trophy size={16} className="text-rose-600" />
        ) : (
          <ClipboardList size={16} className="text-blue-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 text-sm truncate">{sessionTitle(session, getTrainingNum)}</p>
        <p className="text-xs text-slate-500 truncate">
          {session.teamName}
          {session.lugar ? ` · ${session.lugar}` : ''}
        </p>
      </div>
      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide shrink-0">Sin hora</span>
      <div className={`w-1.5 h-9 rounded-full shrink-0 ${colorClass}`} />
    </button>
  );
}

export default function DayView({ sessions, loading, currentDate, onSelectSession, getTrainingNum }) {
  const isToday = currentDate ? toYMD(new Date()) === toYMD(currentDate) : false;
  const [nowMin, setNowMin] = useState(currentMinutes);

  useEffect(() => {
    if (!isToday) return undefined;
    const id = setInterval(() => setNowMin(currentMinutes()), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const { timedSessions, untimedSessions } = useMemo(() => {
    const timed = [];
    const untimed = [];
    for (const s of sessions) {
      const t = parseSessionTimes(s);
      if (t) timed.push({ ...t, session: s });
      else untimed.push(s);
    }
    return { timedSessions: timed, untimedSessions: untimed };
  }, [sessions]);

  const { rangeStart, rangeEnd } = useMemo(() => computeRange(timedSessions), [timedSessions]);
  const { items, cols } = useMemo(() => assignColumns(timedSessions), [timedSessions]);
  const gapBadges = useMemo(() => computeGapBadges(timedSessions), [timedSessions]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalHeight = (rangeEnd - rangeStart) * PX_PER_MIN;
  const hourMarks = [];
  for (let m = rangeStart; m <= rangeEnd; m += 60) hourMarks.push(m);
  const nowVisible = isToday && nowMin >= rangeStart && nowMin <= rangeEnd;
  const hasAnySession = sessions.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
      {untimedSessions.length > 0 && (
        <div className="divide-y divide-slate-100 border-b border-slate-100">
          {untimedSessions.map((s) => (
            <UntimedRow key={s.id} session={s} onSelectSession={onSelectSession} getTrainingNum={getTrainingNum} />
          ))}
        </div>
      )}

      <div className="relative" style={{ height: totalHeight, paddingLeft: LABEL_WIDTH }}>
        {hourMarks.map((m, idx) => (
          <div
            key={m}
            className={`absolute left-0 right-0 ${idx === 0 ? '' : 'border-t border-slate-100'}`}
            style={{ top: (m - rangeStart) * PX_PER_MIN }}
          >
            <span className="absolute -top-2 left-2 text-[11px] text-slate-400 font-medium tabular-nums">
              {minutesToHHMM(m)}
            </span>
          </div>
        ))}

        {items.map(({ session, start, end, col }) => {
          const top = (start - rangeStart) * PX_PER_MIN;
          const height = Math.max(MIN_BLOCK_HEIGHT, (end - start) * PX_PER_MIN);
          const widthPct = 100 / cols;
          const leftPct = col * widthPct;
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session)}
              className={`absolute rounded-lg text-left px-2.5 py-1.5 shadow-sm hover:shadow-md hover:brightness-110 transition overflow-hidden ${sessionBgClass(session)}`}
              style={{
                top,
                height,
                left: `calc(${leftPct}% + 4px)`,
                width: `calc(${widthPct}% - 8px)`,
              }}
            >
              <div className="flex items-center gap-1 text-[10px] font-bold opacity-90 tabular-nums">
                {sessionIcon(session)}
                <span>
                  {minutesToHHMM(start)}
                  {session.horaFin ? `–${minutesToHHMM(end)}` : ''}
                </span>
              </div>
              <p className="text-xs font-bold leading-tight mt-0.5 line-clamp-2">
                {sessionTitle(session, getTrainingNum)}
              </p>
              {session.lugar && height >= 60 && (
                <p className="text-[10px] opacity-85 truncate mt-0.5">{session.lugar}</p>
              )}
            </button>
          );
        })}

        {gapBadges.map((g) => (
          <div
            key={g.key}
            className={`absolute text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm ${
              g.type === 'overlap' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
            }`}
            style={{
              top: (g.at - rangeStart) * PX_PER_MIN - 9,
              right: 10,
            }}
          >
            {g.text}
          </div>
        ))}

        {nowVisible && (
          <div
            data-testid="now-line"
            className="absolute left-0 right-0 pointer-events-none z-20"
            style={{ top: (nowMin - rangeStart) * PX_PER_MIN }}
          >
            <span className="absolute left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white" />
            <div className="border-t-2 border-red-500" />
          </div>
        )}

        {!hasAnySession && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
            <CalendarDays size={40} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium">No hay sesiones este día</p>
          </div>
        )}
      </div>
    </div>
  );
}
