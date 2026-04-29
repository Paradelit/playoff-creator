import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePublicTheme } from '../../hooks/usePublicTheme';
import {
  CONTEXTO_REAL_GAPS,
  CONTEXTO_REAL_ORDERED_SESSIONS,
  CONTEXTO_REAL_SESSIONS,
  CONTEXTO_REAL_TEAMS,
} from './contextoRealData';

/**
 * Mock fiel de la `WeekView` real (`src/components/calendar/WeekView.jsx`):
 * white card, 7 columnas con header (día abreviado + píldora circular de fecha,
 * amber para hoy), sesiones como chips de color (rose partidos, amber playoffs,
 * cyan/team-color entrenos). Sobre eso aplicamos el mecanismo caos→orden con
 * dos partidos solapados al inicio que la app detecta y reordena.
 */

const STAGE = { width: 740, height: 460 };
const DAYS = [
  { key: 'lun', label: 'Lun', date: 5 },
  { key: 'mar', label: 'Mar', date: 6 },
  { key: 'mie', label: 'Mié', date: 7 },
  { key: 'jue', label: 'Jue', date: 8 },
  { key: 'vie', label: 'Vie', date: 9 },
  { key: 'sabado', label: 'Sáb', date: 10, today: true },
  { key: 'domingo', label: 'Dom', date: 11 },
];
const COLUMN_WIDTH = STAGE.width / DAYS.length;
const HEADER_HEIGHT = 56;
const BODY_TOP = HEADER_HEIGHT + 10;
const BODY_BOTTOM = STAGE.height - 12;
const BODY_HEIGHT = BODY_BOTTOM - BODY_TOP;
const DAY_START_MIN = 540; // 09:00
const DAY_END_MIN = 1320; // 22:00
const DAY_RANGE = DAY_END_MIN - DAY_START_MIN;

function dayIndex(dayKey) {
  return DAYS.findIndex((d) => d.key === dayKey);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function hashSeed(input) {
  return Array.from(input).reduce((total, char) => total * 31 + char.charCodeAt(0), 17);
}

function sessionTime(startMin) {
  const hours = String(Math.floor(startMin / 60)).padStart(2, '0');
  const minutes = String(startMin % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const TYPE_BG = {
  match: '#F43F5E', // bg-rose-500 — real WeekView partido
  playoff: '#F59E0B', // bg-amber-500 — real WeekView playoff
  training: '#1A6FD4', // Score-Clock Cyan — entreno (cadete-a maps here for clarity)
};

function sessionDisplay(session, teamMap) {
  const team = teamMap.get(session.teamId);
  const teamName = team?.name ?? session.teamId;
  if (session.type === 'match') return `vs ${session.label}`;
  if (session.type === 'playoff') return `PO vs ${session.label}`;
  return teamName;
}

function buildOrderedPosition(session) {
  const idx = dayIndex(session.day);
  if (idx < 0) return null;
  const colX = idx * COLUMN_WIDTH;
  const startRatio = clamp01((session.startMin - DAY_START_MIN) / DAY_RANGE);
  const heightRatio = session.durationMin / DAY_RANGE;
  const y = BODY_TOP + startRatio * BODY_HEIGHT;
  const height = Math.max(30, heightRatio * BODY_HEIGHT);
  return { x: colX + 6, y, width: COLUMN_WIDTH - 12, height };
}

function buildChaosPosition(session) {
  const idx = dayIndex(session.day);
  const colX = idx >= 0 ? idx * COLUMN_WIDTH : 80;
  const seed = hashSeed(session.id);
  const startRatio = clamp01((session.startMin - DAY_START_MIN) / DAY_RANGE);
  const heightRatio = session.durationMin / DAY_RANGE;
  const y = BODY_TOP + startRatio * BODY_HEIGHT;
  const height = Math.max(30, heightRatio * BODY_HEIGHT);
  const xOffset = ((seed * 7) % 18) - 9;
  return {
    x: colX + 6 + xOffset,
    y,
    width: COLUMN_WIDTH - 12,
    height,
    rotation: -5 + ((seed * 13) % 11),
  };
}

export default function ContextoReal() {
  const sectionRef = useRef(null);
  const reduced = useReducedMotion();
  const { theme } = usePublicTheme();
  const [progress, setProgress] = useState(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return undefined;
    const section = sectionRef.current;
    if (!section) return undefined;
    let ticking = false;
    let listenerAttached = false;
    const compute = () => {
      const { top, height } = section.getBoundingClientRect();
      const scrollable = height - window.innerHeight;
      if (scrollable <= 0) return;
      setProgress(clamp01(-top / scrollable));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        compute();
        ticking = false;
      });
    };
    const attach = () => {
      if (listenerAttached) return;
      window.addEventListener('scroll', onScroll, { passive: true });
      listenerAttached = true;
      compute();
    };
    const detach = () => {
      if (!listenerAttached) return;
      window.removeEventListener('scroll', onScroll);
      listenerAttached = false;
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) attach();
        else detach();
      },
      { rootMargin: '180px' },
    );
    observer.observe(section);
    compute();
    return () => {
      observer.disconnect();
      detach();
    };
  }, [reduced]);

  const teamMap = useMemo(() => new Map(CONTEXTO_REAL_TEAMS.map((team) => [team.id, team])), []);

  const arrange = reduced ? 1 : easeInOut(clamp01((progress - 0.4) / 0.5));
  const chaosFade = reduced ? 0 : 1 - arrange;
  const beamVisible = reduced ? 0 : clamp01((progress - 0.2) / 0.4);
  const warnVisible = reduced ? 0 : clamp01((progress - 0.05) / 0.2) * (1 - clamp01((progress - 0.55) / 0.2));
  const successVisible = reduced ? 1 : clamp01((arrange - 0.85) / 0.15);
  const gapsVisible = reduced ? 1 : clamp01((arrange - 0.6) / 0.3);

  const darkTheme = theme === 'dark';
  const cardBg = darkTheme ? 'rgba(15,23,42,0.55)' : '#FFFFFF';
  const cardBorder = darkTheme ? 'rgba(255,255,255,0.08)' : '#E2E8F0';
  const cardShadow = darkTheme
    ? '0 30px 90px rgba(0,0,0,0.45)'
    : '0 4px 6px -1px rgba(15,23,42,0.06), 0 2px 4px -2px rgba(15,23,42,0.06)';
  const dayDividerColor = darkTheme ? 'rgba(255,255,255,0.05)' : '#F1F5F9';
  const headerDividerColor = darkTheme ? 'rgba(255,255,255,0.08)' : '#E2E8F0';
  const dayLabelColor = darkTheme ? '#94A3B8' : '#64748B';
  const dayDateColor = darkTheme ? '#E2E8F0' : '#334155';
  const todayBg = darkTheme ? 'rgba(251,191,36,0.10)' : '#FEF3C7';
  const sessionsCount = CONTEXTO_REAL_SESSIONS.length;

  return (
    <section
      ref={sectionRef}
      className="relative bg-slate-50 transition-colors dark:bg-[#080813]"
      style={{ height: '200vh' }}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden px-6 py-16">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-center">
          <div className="max-w-md">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-orange-400">Contexto real</p>
            <h2 className="mb-4 text-3xl font-extrabold leading-tight text-slate-900 dark:text-white lg:text-4xl">
              Tu fin de semana, ordenado en 5 segundos
            </h2>
            <p className="mb-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Dos partidos, un entreno de tiro y un playoff. Empiezas con dos partidos a la misma hora en la misma
              pista. Pick lo detecta, te avisa y reordena el calendario sin solapes.
            </p>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                Detecta solapes en pista y horario al instante
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Reordena partidos y entrenos respetando descansos
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Marca cuántos minutos libres quedan entre sesiones
              </li>
            </ul>
          </div>

          <div className="relative">
            {/* Chrome del calendario: imitamos el wrapper de CalendarScreen */}
            <div
              className="relative overflow-hidden rounded-2xl border shadow-md transition-colors"
              style={{ background: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-3"
                style={{ borderColor: headerDividerColor }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Calendario · Vista semana
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">5 – 11 mayo 2026</span>
              </div>

              <div
                className="relative"
                style={{
                  width: '100%',
                  aspectRatio: `${STAGE.width} / ${STAGE.height}`,
                }}
              >
                {/* Beam de Pick scaneando */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-px overflow-hidden"
                  style={{ opacity: beamVisible }}
                >
                  <span
                    className="cr-beam block h-full w-2/5 rounded-full"
                    style={{
                      background: darkTheme
                        ? 'linear-gradient(90deg, transparent, rgba(249,115,22,0.05), rgba(249,115,22,0.9), rgba(59,130,246,0.4), transparent)'
                        : 'linear-gradient(90deg, transparent, rgba(249,115,22,0.06), rgba(249,115,22,0.85), rgba(251,191,36,0.32), transparent)',
                    }}
                  />
                </div>

                {/* Grid 7-col: cabecera + columnas día (estructural, sin sesiones) */}
                <div className="absolute inset-0 grid grid-cols-7">
                  {DAYS.map((day, idx) => (
                    <div
                      key={day.key}
                      className="relative flex h-full flex-col"
                      style={{
                        borderRight: idx < DAYS.length - 1 ? `1px solid ${dayDividerColor}` : 'none',
                      }}
                    >
                      <div
                        className="flex flex-col items-center justify-center gap-0.5 py-2"
                        style={{
                          height: HEADER_HEIGHT,
                          background: day.today ? todayBg : 'transparent',
                          borderBottom: `1px solid ${headerDividerColor}`,
                        }}
                      >
                        <span
                          className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
                          style={{ color: dayLabelColor }}
                        >
                          {day.label}
                        </span>
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold leading-none"
                          style={{
                            background: day.today ? '#FBBF24' : 'transparent',
                            color: day.today ? '#FFFFFF' : dayDateColor,
                          }}
                        >
                          {day.date}
                        </span>
                      </div>
                      <div className="flex-1" />
                    </div>
                  ))}
                </div>

                {/* Chips de sesión (animadas, posicionadas en porcentaje) */}
                <div className="absolute inset-0 z-20">
                  {CONTEXTO_REAL_SESSIONS.map((session) => {
                    const ordered = buildOrderedPosition(session);
                    const chaos = buildChaosPosition(session);
                    if (!ordered) return null;
                    const x = lerp(chaos.x, ordered.x, arrange);
                    const y = lerp(chaos.y, ordered.y, arrange);
                    const width = lerp(chaos.width, ordered.width, arrange);
                    const height = lerp(chaos.height, ordered.height, arrange);
                    const rotation = lerp(chaos.rotation, 0, arrange);
                    const conflict = session.conflicts.length > 0;
                    const showConflict = conflict && chaosFade > 0.15;
                    const baseColor = TYPE_BG[session.type] ?? TYPE_BG.match;
                    const fillColor = showConflict ? 'rgba(244,63,94,0.95)' : baseColor;
                    const text = sessionDisplay(session, teamMap);

                    return (
                      <button
                        key={session.id}
                        type="button"
                        tabIndex={-1}
                        data-testid="contexto-session-chip"
                        className={`absolute overflow-hidden rounded text-left text-white ${
                          showConflict && !reduced ? 'cr-warn' : ''
                        }`}
                        style={{
                          left: `${(x / STAGE.width) * 100}%`,
                          top: `${(y / STAGE.height) * 100}%`,
                          width: `${(width / STAGE.width) * 100}%`,
                          height: `${(height / STAGE.height) * 100}%`,
                          background: fillColor,
                          transform: `rotate(${rotation}deg)`,
                          boxShadow: showConflict
                            ? '0 0 0 2px #B91C1C inset, 0 4px 12px -2px rgba(244,63,94,0.5)'
                            : '0 1px 2px rgba(15,23,42,0.18)',
                          padding: '4px 6px',
                          fontSize: '10px',
                          fontWeight: 700,
                          lineHeight: 1.15,
                          transformOrigin: 'top left',
                        }}
                        aria-label={`${sessionTime(session.startMin)} ${text}`}
                      >
                        <span className="block opacity-90 font-mono text-[8.5px] uppercase tracking-[0.06em]">
                          {sessionTime(session.startMin)}
                        </span>
                        <span className="block truncate text-[10.5px] font-bold">{text}</span>
                        {showConflict ? (
                          <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-white/95 px-1 py-px font-mono text-[8px] font-extrabold uppercase tracking-[0.10em] text-rose-700">
                            ! solapa
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Etiquetas de hueco entre sesiones consecutivas en el mismo día */}
                <div className="absolute inset-0 z-30 pointer-events-none">
                  {CONTEXTO_REAL_GAPS.map((gap) => {
                    const after = CONTEXTO_REAL_ORDERED_SESSIONS.find((s) => s.id === gap.afterId);
                    const before = CONTEXTO_REAL_ORDERED_SESSIONS.find((s) => s.id === gap.beforeId);
                    if (!after || !before) return null;
                    const afterPos = buildOrderedPosition(after);
                    const beforePos = buildOrderedPosition(before);
                    if (!afterPos || !beforePos) return null;
                    const cx = afterPos.x + afterPos.width / 2;
                    const startY = afterPos.y + afterPos.height + 2;
                    const endY = beforePos.y - 2;
                    const labelY = (startY + endY) / 2;
                    return (
                      <div
                        key={gap.id}
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: `${(cx / STAGE.width) * 100}%`,
                          top: `${(labelY / STAGE.height) * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          opacity: gapsVisible,
                          transition: 'opacity 250ms ease',
                        }}
                      >
                        <span
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none"
                          style={{
                            background: darkTheme ? 'rgba(16,185,129,0.18)' : '#DCFCE7',
                            borderColor: 'rgba(16,185,129,0.40)',
                            color: '#047857',
                          }}
                        >
                          <span aria-hidden="true">↕</span>
                          {gap.minutes} min libres
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Líneas verticales discontinuas por columna (visibles cuando ordenado) */}
                <svg
                  aria-hidden="true"
                  viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                  style={{ opacity: arrange * 0.3 }}
                >
                  {DAYS.slice(0, -1).map((_, idx) => {
                    const x = (idx + 1) * COLUMN_WIDTH;
                    return (
                      <line
                        key={idx}
                        x1={x}
                        x2={x}
                        y1={HEADER_HEIGHT + 4}
                        y2={STAGE.height - 8}
                        stroke={dayDividerColor}
                        strokeDasharray="2 6"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Toast de aviso mientras hay solape */}
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute right-4 top-16 z-30 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-lg backdrop-blur"
              style={{
                background: darkTheme ? 'rgba(244,63,94,0.18)' : 'rgba(254,226,226,0.96)',
                borderColor: 'rgba(244,63,94,0.36)',
                color: '#B91C1C',
                opacity: warnVisible,
                transform: `translateY(${(1 - warnVisible) * -10}px)`,
                transition: 'opacity 200ms ease, transform 200ms ease',
              }}
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: '#F43F5E', color: '#FFFFFF' }}
                aria-hidden="true"
              >
                <AlertTriangle size={12} />
              </span>
              <div className="text-[11px] leading-tight">
                <p className="m-0 font-extrabold">Solape detectado</p>
                <p className="m-0 font-medium opacity-80">2 partidos · Pista 1 · sáb 11:00</p>
              </div>
            </div>

            {/* Toast de éxito tras ordenar */}
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute right-4 top-16 z-30 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-lg backdrop-blur"
              style={{
                background: darkTheme ? 'rgba(16,185,129,0.16)' : 'rgba(220,252,231,0.95)',
                borderColor: 'rgba(16,185,129,0.36)',
                color: '#047857',
                opacity: successVisible,
                transform: `translateY(${(1 - successVisible) * -10}px)`,
                transition: 'opacity 200ms ease, transform 200ms ease',
              }}
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: '#10B981', color: '#FFFFFF' }}
                aria-hidden="true"
              >
                <CheckCircle2 size={12} />
              </span>
              <div className="text-[11px] leading-tight">
                <p className="m-0 font-extrabold">Sin solapes</p>
                <p className="m-0 font-medium opacity-80">{sessionsCount} sesiones · 2 días · 1 pista</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
