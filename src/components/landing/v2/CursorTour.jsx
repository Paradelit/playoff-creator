import React, { useEffect, useRef, useState } from 'react';
import {
  Users,
  ClipboardList,
  CalendarDays,
  Trophy,
  MapPin,
  Plus,
  Maximize2,
  X,
  Send,
  Pause,
  Play,
} from 'lucide-react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { usePublicTheme } from '../../../hooks/usePublicTheme';
import ClubLogo from '../../ClubLogo';
import { tokens, gradients } from '../../../design/tokens';

const PROMPT = 'Pick, prepara entreno mañana 18h. 60 min. Bloqueo directo y transición.';

const RESPONSE_BLOCKS = [
  { time: "00'", dur: "8'", kind: 'Calentamiento', detail: 'Activación + manejo balones', tone: 'cyan', icon: '🔥' },
  { time: "08'", dur: "20'", kind: 'Bloqueo directo', detail: 'P&R 2×2 progresivo', tone: 'orange', icon: '⚡', highlight: true },
  { time: "28'", dur: "20'", kind: 'Transición', detail: '5×0 → 5×5 finalización', tone: 'orange', icon: '🏃' },
  { time: "48'", dur: "12'", kind: 'Aplicación', detail: 'Partido condicionado', tone: 'green', icon: '🏀' },
];

const TONE_BG = {
  orange: 'rgba(249,115,22,0.10)',
  cyan: 'rgba(26,111,212,0.08)',
  green: 'rgba(16,185,129,0.10)',
};
const TONE_BORDER = {
  orange: 'rgba(249,115,22,0.32)',
  cyan: 'rgba(26,111,212,0.30)',
  green: 'rgba(16,185,129,0.32)',
};
const TONE_LABEL = {
  orange: '#C2410C',
  cyan: '#1535A8',
  green: '#047857',
};

const STEPS = [
  { id: 'home', cursorX: 60, cursorY: 76, dwell: 2400, label: 'Abrir Calendario' },
  { id: 'calendar', cursorX: 56, cursorY: 70, dwell: 2400, label: 'Hueco · Martes 18h' },
  { id: 'pick', cursorX: 78, cursorY: 86, dwell: 5800, label: 'Pídelo a Pick' },
];

export default function CursorTour() {
  const { theme } = usePublicTheme();
  const reduced = useReducedMotion();
  const darkTheme = theme === 'dark';

  const [stepIdx, setStepIdx] = useState(reduced ? STEPS.length - 1 : 0);
  const [pickPhase, setPickPhase] = useState(reduced ? 'done' : 'idle');
  const [typed, setTyped] = useState(reduced ? PROMPT.length : 0);
  const [blocksShown, setBlocksShown] = useState(reduced ? RESPONSE_BLOCKS.length : 0);
  const [manualPaused, setManualPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const sectionRef = useRef(null);
  const stepTimerRef = useRef(null);
  const pickTimerRef = useRef(null);

  const isPaused = manualPaused || offscreen;

  useEffect(() => {
    if (reduced || isPaused) return undefined;
    const advance = () => {
      setStepIdx((current) => {
        if (current < STEPS.length - 1) return current + 1;
        setPickPhase('idle');
        setTyped(0);
        setBlocksShown(0);
        return 0;
      });
    };
    stepTimerRef.current = setTimeout(advance, STEPS[stepIdx].dwell);
    return () => clearTimeout(stepTimerRef.current);
  }, [stepIdx, reduced, isPaused]);

  useEffect(() => {
    if (reduced || isPaused) return undefined;
    if (stepIdx !== 2) {
      setPickPhase('idle');
      setTyped(0);
      setBlocksShown(0);
      return undefined;
    }
    const schedule = (callback, ms) => {
      pickTimerRef.current = setTimeout(callback, ms);
    };
    if (pickPhase === 'idle') {
      schedule(() => setPickPhase('typing'), 350);
    } else if (pickPhase === 'typing') {
      if (typed < PROMPT.length) {
        schedule(() => setTyped((value) => value + 1), 28);
      } else {
        schedule(() => setPickPhase('thinking'), 600);
      }
    } else if (pickPhase === 'thinking') {
      schedule(() => {
        setBlocksShown(0);
        setPickPhase('responding');
      }, 1200);
    } else if (pickPhase === 'responding') {
      if (blocksShown < RESPONSE_BLOCKS.length) {
        schedule(() => setBlocksShown((value) => value + 1), 320);
      } else {
        schedule(() => setPickPhase('done'), 0);
      }
    }
    return () => clearTimeout(pickTimerRef.current);
  }, [pickPhase, stepIdx, reduced, isPaused, typed, blocksShown]);

  useEffect(() => {
    if (reduced) return undefined;
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  const restart = () => {
    clearTimeout(stepTimerRef.current);
    clearTimeout(pickTimerRef.current);
    setStepIdx(0);
    setPickPhase('idle');
    setTyped(0);
    setBlocksShown(0);
    setManualPaused(false);
  };

  const sectionBg = darkTheme
    ? `linear-gradient(180deg, ${tokens.surfaceNight} 0%, ${tokens.surfaceNightSoft} 100%)`
    : `linear-gradient(180deg, ${tokens.ash50} 0%, ${tokens.surfaceWhite} 100%)`;
  const frameBg = darkTheme
    ? 'linear-gradient(180deg, #0e0e20 0%, #06060f 100%)'
    : `linear-gradient(180deg, ${tokens.surfaceWhite} 0%, ${tokens.ash50} 100%)`;
  const frameBorder = darkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.22)';

  const showSurfaceA = stepIdx <= 0;
  const showSurfaceB = stepIdx === 1;
  const showSurfaceC = stepIdx >= 2;

  const cursorTarget = STEPS[stepIdx];

  return (
    <section
      ref={sectionRef}
      id="tour"
      aria-label="Tour de la app con un cursor automatizado"
      className="relative py-20 transition-colors lg:py-28"
      style={{ background: sectionBg }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-10 mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-orange-400">Tour guiado</p>
          <h2 className="mb-4 text-3xl font-extrabold leading-tight text-slate-900 dark:text-white lg:text-4xl">
            Mira a Pick crear el entreno de mañana.
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Tres clics: abrir el calendario, encontrar el hueco del martes y pedir a Pick que lo prepare. Esto lo haces cada semana.
          </p>
        </div>

        <div
          className="relative mx-auto overflow-hidden rounded-2xl border shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] dark:shadow-[0_40px_100px_-30px_rgba(0,0,0,0.7)]"
          style={{ background: frameBg, borderColor: frameBorder, maxWidth: 1040 }}
        >
          <div
            className="flex items-center gap-2 border-b px-4 py-3"
            style={{
              borderColor: frameBorder,
              background: darkTheme ? 'rgba(255,255,255,0.02)' : 'rgba(248,250,252,0.95)',
            }}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-3 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
              app.pickandcoach.com / area-privada / calendar?teamId=cadete-a
            </span>
          </div>

          <div className="relative" style={{ minHeight: 520 }}>
            <SurfaceHome darkTheme={darkTheme} visible={showSurfaceA} />
            <SurfaceCalendar darkTheme={darkTheme} visible={showSurfaceB} />
            <SurfacePick
              darkTheme={darkTheme}
              visible={showSurfaceC}
              pickPhase={pickPhase}
              typed={typed}
              blocksShown={blocksShown}
            />

            {!reduced ? (
              <Cursor x={cursorTarget.cursorX} y={cursorTarget.cursorY} label={cursorTarget.label} />
            ) : null}
          </div>
        </div>

        {!reduced ? (
          <div className="mx-auto mt-4 flex max-w-[1040px] items-center justify-between gap-3 text-[11px] font-medium">
            <div className="flex items-center gap-1.5">
              {STEPS.map((step, idx) => (
                <span
                  key={step.id}
                  aria-hidden="true"
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: idx === stepIdx ? 24 : 8,
                    background:
                      idx === stepIdx
                        ? tokens.courtOrange
                        : darkTheme
                          ? 'rgba(255,255,255,0.18)'
                          : 'rgba(148,163,184,0.4)',
                  }}
                />
              ))}
              <span
                aria-live="polite"
                className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500"
              >
                {`${String(stepIdx + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')} · ${cursorTarget.label}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={restart}
                className="rounded px-1.5 py-0.5 text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label="Reiniciar el tour"
              >
                Reiniciar
              </button>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <button
                type="button"
                onClick={() => setManualPaused((value) => !value)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={manualPaused ? 'Reanudar el tour' : 'Pausar el tour'}
                aria-pressed={manualPaused}
              >
                {manualPaused ? <Play size={11} aria-hidden="true" /> : <Pause size={11} aria-hidden="true" />}
                {manualPaused ? 'Reanudar' : 'Pausar'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Cursor({ x, y, label }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-30 transition-[left,top] duration-[850ms]"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transitionTimingFunction: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))',
      }}
    >
      <div className="relative">
        <span
          className="absolute -inset-1 rounded-full opacity-90"
          style={{ background: 'rgba(249,115,22,0.32)', filter: 'blur(8px)' }}
        />
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="relative">
          <path
            d="M5 3 L5 17 L9 14 L11.5 20 L14 19 L11.6 13 L17 13 Z"
            fill="#ffffff"
            stroke={tokens.ink900}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="absolute left-6 top-6 inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{
            background: tokens.ink900,
            borderColor: 'rgba(249,115,22,0.45)',
            color: '#fb923c',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function SurfaceHome({ darkTheme, visible }) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-500"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        background: darkTheme ? 'rgba(6,6,15,0.85)' : 'rgba(248,250,252,0.96)',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <article
          className="relative w-full max-w-md rounded-2xl p-6 text-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)]"
          style={{ background: gradients.teamCardCyan }}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200/80">
                Cadete · Federado · Mixto
              </p>
              <h3 className="m-0 mt-1 truncate text-2xl font-bold tracking-tight">Cadete A</h3>
            </div>
            <ClubLogo className="h-10 w-10 shrink-0 opacity-90" placeholderText="" />
          </div>
          <p className="m-0 mt-2 text-sm text-cyan-100/85">Próx. partido: vs Estudiantes · sáb 11h</p>
          <p className="m-0 mt-0.5 text-sm text-amber-200/85">Torneo: vs Real Madrid (1-0)</p>

          <div className="my-4 h-0.5 w-12 rounded-full bg-white/20" />

          <nav aria-label="Acciones rápidas" className="flex gap-5">
            {[
              { Icon: Users, label: 'Plantilla' },
              { Icon: ClipboardList, label: 'Cuaderno' },
              { Icon: CalendarDays, label: 'Calendario', highlight: true },
              { Icon: Trophy, label: 'Torneos' },
            ].map(({ Icon, label, highlight }) => (
              <span key={label} className="flex flex-col items-center gap-1.5">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors"
                  style={{
                    background: highlight ? 'rgba(249,115,22,0.32)' : 'rgba(255,255,255,0.15)',
                    boxShadow: highlight ? '0 0 0 2px rgba(249,115,22,0.45)' : 'none',
                  }}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-cyan-100/95">{label}</span>
              </span>
            ))}
          </nav>
        </article>
      </div>
    </div>
  );
}

const WEEK_DAYS = [
  { label: 'Lun', date: 5 },
  { label: 'Mar', date: 6, target: true },
  { label: 'Mié', date: 7 },
  { label: 'Jue', date: 8 },
  { label: 'Vie', date: 9 },
  { label: 'Sáb', date: 10, today: true },
  { label: 'Dom', date: 11 },
];

const WEEK_SESSIONS = {
  5: [{ kind: 'training', team: 'Cadete A', color: tokens.scoreClockBlue, time: '18h' }],
  6: [],
  7: [{ kind: 'training', team: 'Cadete A', color: tokens.scoreClockBlue, time: '18h' }],
  8: [],
  9: [{ kind: 'training', team: 'Cadete A', color: tokens.scoreClockBlue, time: '18h' }],
  10: [{ kind: 'partido', team: 'vs Estudiantes', color: tokens.rosePartido, time: '11h' }],
  11: [{ kind: 'playoff', team: 'PO vs RM', color: tokens.trophyAmberDeep, time: '12h' }],
};

function SurfaceCalendar({ darkTheme, visible }) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-500"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        background: darkTheme ? 'rgba(15,23,42,0.65)' : tokens.ash100,
      }}
    >
      <div className="absolute inset-0 flex flex-col px-6 py-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-base font-extrabold tracking-tight" style={{ color: darkTheme ? tokens.surfaceWhite : tokens.ink900 }}>
              Calendario · Cadete A
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: darkTheme ? '#94a3b8' : tokens.ink500 }}>
              Semana del 5 al 11 mayo
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{
              background: 'rgba(249,115,22,0.12)',
              color: tokens.courtOrangeDeep,
              border: `1px solid ${tokens.courtOrange}40`,
            }}
          >
            Vista semana
          </span>
        </header>

        <div
          className="flex-1 overflow-hidden rounded-xl"
          style={{
            background: darkTheme ? 'rgba(255,255,255,0.04)' : tokens.surfaceWhite,
            border: `1px solid ${darkTheme ? 'rgba(255,255,255,0.08)' : tokens.ash200}`,
            boxShadow: darkTheme ? 'none' : '0 4px 12px -4px rgba(15,23,42,0.08)',
          }}
        >
          <div className="grid h-full grid-cols-7">
            {WEEK_DAYS.map((day, idx) => {
              const sessions = WEEK_SESSIONS[day.date] || [];
              const isLast = idx === WEEK_DAYS.length - 1;
              return (
                <div
                  key={day.date}
                  className="flex flex-col"
                  style={{ borderRight: isLast ? 'none' : `1px solid ${darkTheme ? 'rgba(255,255,255,0.05)' : tokens.ash100}` }}
                >
                  <div
                    className="flex flex-col items-center gap-1 py-2"
                    style={{
                      borderBottom: `1px solid ${darkTheme ? 'rgba(255,255,255,0.05)' : tokens.ash200}`,
                      background: day.today ? '#FEF3C7' : 'transparent',
                    }}
                  >
                    <span className="text-[10px] font-semibold uppercase" style={{ color: tokens.ink500 }}>
                      {day.label}
                    </span>
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold leading-none"
                      style={{
                        background: day.today ? tokens.trophyAmber : 'transparent',
                        color: day.today
                          ? tokens.surfaceWhite
                          : darkTheme
                            ? tokens.surfaceWhite
                            : tokens.ink700,
                      }}
                    >
                      {day.date}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-1 p-1">
                    {sessions.map((session) => (
                      <span
                        key={`${day.date}-${session.team}`}
                        className="truncate rounded px-1.5 py-1 text-[10px] font-semibold leading-none text-white"
                        style={{ background: session.color }}
                      >
                        {session.time} · {session.team}
                      </span>
                    ))}
                    {day.target ? (
                      <span
                        aria-label="Hueco libre martes 18h, listo para asignar"
                        className="flex items-center justify-center rounded border-2 border-dashed py-1 text-[9px] font-bold uppercase tracking-[0.08em]"
                        style={{
                          borderColor: tokens.courtOrange,
                          background: 'rgba(249,115,22,0.08)',
                          color: tokens.courtOrangeDeep,
                          minHeight: 24,
                          animation: 'pc-glow 2s ease-in-out infinite',
                        }}
                      >
                        + 18h
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SurfacePick({ darkTheme, visible, pickPhase, typed, blocksShown }) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-500"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        background: darkTheme ? 'rgba(15,23,42,0.65)' : tokens.ash100,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 px-6 py-6 opacity-50"
        aria-hidden="true"
      >
        <SurfaceCalendar darkTheme={darkTheme} visible />
      </div>

      <div
        className="absolute bottom-4 right-4 z-20 w-[360px] max-w-[calc(100%-32px)] overflow-hidden rounded-2xl border bg-white shadow-2xl"
        style={{
          borderColor: tokens.ash200,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 400ms cubic-bezier(0.16,1,0.3,1), opacity 400ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div
          className="flex items-center justify-between gap-2 border-b px-3 py-2"
          style={{ borderColor: tokens.ash100 }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <h4 className="m-0 text-[13px] font-extrabold" style={{ color: tokens.ink900 }}>
              Pick
            </h4>
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]"
              style={{ background: tokens.ash50, color: tokens.ink500 }}
            >
              <MapPin size={9} aria-hidden="true" />
              Calendario
            </span>
          </div>
          <div className="flex gap-1">
            {[Plus, Maximize2, X].map((Icon, idx) => (
              <span
                key={idx}
                aria-hidden="true"
                className="inline-flex h-5 w-5 items-center justify-center"
                style={{ color: tokens.ink400 }}
              >
                <Icon size={12} />
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-h-[260px] flex-col gap-2 px-3 py-3">
          <div className="flex justify-end">
            <div
              className="max-w-[88%] px-3 py-2 text-[12.5px] font-medium text-white"
              style={{ background: tokens.scoreClockBlue, borderRadius: '14px 14px 4px 14px' }}
            >
              {PROMPT.slice(0, typed)}
              {pickPhase === 'typing' ? (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-3 w-0.5 align-middle"
                  style={{ background: tokens.surfaceWhite, animation: 'pc-blink 1s step-end infinite' }}
                />
              ) : null}
            </div>
          </div>

          {pickPhase === 'thinking' ? (
            <div className="flex items-end justify-start gap-2">
              <PickAvatarSmall />
              <div
                aria-label="Pick está pensando"
                className="inline-flex items-center gap-1 px-3 py-2"
                style={{ background: tokens.ash100, borderRadius: '14px 14px 14px 4px' }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: tokens.ink400, animation: 'pc-dot 1.2s infinite 0s' }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: tokens.ink400, animation: 'pc-dot 1.2s infinite 0.16s' }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: tokens.ink400, animation: 'pc-dot 1.2s infinite 0.32s' }}
                />
              </div>
            </div>
          ) : null}

          {pickPhase === 'responding' || pickPhase === 'done' ? (
            <div className="flex items-start justify-start gap-2">
              <PickAvatarSmall />
              <section
                aria-label="Vista previa: entrenamiento generado"
                className="flex max-w-[calc(100%-36px)] flex-col gap-1 rounded-xl border bg-white p-2 shadow-sm"
                style={{ borderColor: tokens.ash200 }}
              >
                <div
                  className="mb-0.5 flex items-center gap-1.5 border-b pb-1.5"
                  style={{ borderColor: tokens.ash100 }}
                >
                  <span aria-hidden="true" className="text-[12px] leading-none">
                    🏀
                  </span>
                  <span className="flex-1 truncate text-[11px] font-bold" style={{ color: tokens.ink900 }}>
                    Entrenamiento · Cadete A
                  </span>
                  <span
                    className="font-mono text-[9px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: tokens.ink500 }}
                  >
                    60'
                  </span>
                </div>

                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {RESPONSE_BLOCKS.slice(0, blocksShown).map((block) => (
                    <li
                      key={block.kind}
                      className="pc-fsu flex items-center gap-1.5 rounded px-1.5 py-1"
                      style={{
                        background: block.highlight ? TONE_BG[block.tone] : tokens.ash50,
                        border: `1px solid ${block.highlight ? TONE_BORDER[block.tone] : tokens.ash100}`,
                      }}
                    >
                      <span aria-hidden="true" className="text-[12px] leading-none">
                        {block.icon}
                      </span>
                      <span
                        className="font-mono text-[8.5px] font-bold w-5 shrink-0"
                        style={{ color: tokens.ink500 }}
                      >
                        {block.time}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-[10.5px] font-semibold"
                          style={{ color: block.highlight ? TONE_LABEL[block.tone] : tokens.ink900 }}
                        >
                          {block.kind}
                        </span>
                      </span>
                      <span
                        className="font-mono text-[8.5px] font-bold shrink-0"
                        style={{ color: tokens.ink600 }}
                      >
                        {block.dur}
                      </span>
                    </li>
                  ))}
                </ul>

                {pickPhase === 'done' ? (
                  <div className="mt-1 flex gap-1">
                    <span
                      className="rounded px-2 py-1 text-[10px] font-bold text-white"
                      style={{
                        background: tokens.scoreClockBlue,
                        boxShadow: `0 2px 6px -1px ${tokens.scoreClockBlue}66`,
                      }}
                    >
                      Guardar
                    </span>
                    <span
                      className="rounded px-2 py-1 text-[10px] font-semibold"
                      style={{ background: tokens.surfaceWhite, color: tokens.ink600, border: `1px solid ${tokens.ash200}` }}
                    >
                      Editar
                    </span>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        <div
          className="flex items-center gap-1.5 border-t bg-white px-2.5 py-2"
          style={{ borderColor: tokens.ash100 }}
        >
          <input
            type="text"
            disabled
            placeholder="Pregunta sobre Calendario…"
            tabIndex={-1}
            aria-hidden="true"
            className="flex-1 rounded-md border bg-slate-50 px-2.5 py-1 text-[12px] outline-none"
            style={{ borderColor: tokens.ash200, color: tokens.ink700 }}
          />
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white"
            style={{ background: tokens.scoreClockBlue }}
          >
            <Send size={12} strokeWidth={2.4} />
          </span>
        </div>
      </div>
    </div>
  );
}

function PickAvatarSmall() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
      style={{
        background: gradients.pickAvatar,
        boxShadow: `0 4px 10px ${gradients.pickAvatar.includes('#') ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
      }}
    >
      P
    </span>
  );
}
