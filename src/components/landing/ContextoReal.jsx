import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePublicTheme } from '../../hooks/usePublicTheme';
import {
  CONTEXTO_REAL_COURTS,
  CONTEXTO_REAL_ORDERED_SESSIONS,
  CONTEXTO_REAL_SESSIONS,
  CONTEXTO_REAL_TEAMS,
} from './contextoRealData';

const STAGE = { width: 1100, height: 620 };
const DAY_BANDS = {
  sabado: { y: 110, height: 190, label: 'Sábado' },
  domingo: { y: 350, height: 190, label: 'Domingo' },
};
const START_MIN = 540;
const END_MIN = 1260;

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

function buildChaosPosition(session) {
  const seed = hashSeed(session.id);
  const x = 60 + (seed % 920);
  const y = 70 + ((seed * 17) % 470);
  const rotation = -7 + ((seed * 13) % 15);
  return { x, y, rotation };
}

function buildOrderedPosition(session, courtIndex) {
  const band = DAY_BANDS[session.day];
  const span = END_MIN - START_MIN;
  const rowRatio = (session.startMin - START_MIN) / span;
  const x = 80 + courtIndex * 320;
  const y = band.y + rowRatio * band.height;
  const height = Math.max(30, Math.min(54, 24 + session.durationMin * 0.22));
  return { x, y, height };
}

function sessionLabel(teamMap, session) {
  const team = teamMap.get(session.teamId)?.name ?? session.teamId;
  const prefix = session.type === 'match' ? 'Partido' : 'Entreno';
  return `${prefix} · ${team}`;
}

function sessionTime(session) {
  const hours = String(Math.floor(session.startMin / 60)).padStart(2, '0');
  const minutes = String(session.startMin % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function ContextoReal() {
  const sectionRef = useRef(null);
  const reduced = useReducedMotion();
  const { theme } = usePublicTheme();
  const [progress, setProgress] = useState(1);

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
  const courtMap = useMemo(() => new Map(CONTEXTO_REAL_COURTS.map((court) => [court.id, court])), []);
  const courtIndex = useMemo(() => new Map(CONTEXTO_REAL_COURTS.map((court, index) => [court.id, index])), []);

  const chipScenes = useMemo(
    () =>
      CONTEXTO_REAL_SESSIONS.map((chaosSession, index) => {
        const orderedSession = CONTEXTO_REAL_ORDERED_SESSIONS[index];
        const chaos = buildChaosPosition(chaosSession);
        const ordered = buildOrderedPosition(orderedSession, courtIndex.get(orderedSession.court) ?? 0);
        return { chaosSession, orderedSession, chaos, ordered };
      }),
    [courtIndex],
  );

  const arrange = reduced ? 1 : easeInOut(clamp01((progress - 0.5) / 0.5));
  const chaosFade = reduced ? 0 : 1 - arrange;
  const beamVisible = reduced ? 0.85 : clamp01((progress - 0.28) / 0.45);
  const darkTheme = theme === 'dark';
  const stageFill = darkTheme ? '#090915' : '#ffffff';
  const boardStroke = darkTheme ? 'rgba(255,255,255,.08)' : 'rgba(148,163,184,.26)';

  return (
    <section
      ref={sectionRef}
      className="relative bg-slate-50 transition-colors dark:bg-[#080813]"
      style={{ height: '200vh' }}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden px-6 py-16">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-center">
          <div className="max-w-md">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-orange-400">Contexto real</p>
            <h2 className="mb-4 text-3xl font-extrabold leading-tight text-slate-900 dark:text-white lg:text-4xl">
              Tu fin de semana en 5 segundos
            </h2>
            <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              47 sesiones. 10 equipos. 3 pistas. La IA lo cuadra antes de que termines de leer esto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              {['CB Demo Aro', 'Conflictos detectados', 'Orden automático'].map((label) => (
                <span
                  key={label}
                  className="rounded-full border px-3 py-1.5"
                  style={{
                    borderColor: darkTheme ? 'rgba(255,255,255,.08)' : 'rgba(148,163,184,.18)',
                    background: darkTheme ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.7)',
                    color: darkTheme ? '#cbd5e1' : '#475569',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-[28px] border p-4 shadow-[0_30px_80px_rgba(15,23,42,.12)] dark:shadow-[0_30px_90px_rgba(0,0,0,.45)]"
            style={{
              borderColor: boardStroke,
              background: darkTheme
                ? 'linear-gradient(180deg, rgba(17,17,34,.96), rgba(10,10,24,.98))'
                : 'rgba(255,255,255,.94)',
            }}
          >
            <div
              className="pointer-events-none absolute left-0 right-0 top-1/2 h-px overflow-hidden"
              style={{ opacity: beamVisible }}
              aria-hidden="true"
            >
              <span
                className={`cr-beam block h-full w-2/5 rounded-full ${reduced ? '' : ''}`}
                style={{
                  background: darkTheme
                    ? 'linear-gradient(90deg, transparent, rgba(249,115,22,.05), rgba(249,115,22,.9), rgba(59,130,246,.4), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(249,115,22,.06), rgba(249,115,22,.85), rgba(251,191,36,.32), transparent)',
                }}
              />
            </div>

            <svg viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} className="relative z-10 h-auto w-full">
              <rect x="0" y="0" width={STAGE.width} height={STAGE.height} rx="24" fill={stageFill} />

              {Object.entries(DAY_BANDS).map(([day, band]) => (
                <g key={day}>
                  <text x="56" y={band.y - 20} fill={darkTheme ? '#f8fafc' : '#0f172a'} fontSize="18" fontWeight="700">
                    {band.label}
                  </text>
                  <line
                    x1="56"
                    x2={STAGE.width - 56}
                    y1={band.y - 6}
                    y2={band.y - 6}
                    stroke={darkTheme ? 'rgba(255,255,255,.08)' : 'rgba(148,163,184,.22)'}
                  />
                </g>
              ))}

              {CONTEXTO_REAL_COURTS.map((court, index) => (
                <g key={court.id}>
                  <text
                    x={80 + index * 320}
                    y="64"
                    fill={darkTheme ? '#94a3b8' : '#475569'}
                    fontSize="15"
                    fontWeight="600"
                  >
                    {court.label}
                  </text>
                  {[...Array(7).keys()].map((hour) => {
                    const yTop = 96 + hour * 30;
                    const yBottom = 336 + hour * 30;
                    return (
                      <React.Fragment key={`${court.id}-${hour}`}>
                        <line
                          x1={68 + index * 320}
                          x2={330 + index * 320}
                          y1={yTop}
                          y2={yTop}
                          stroke={darkTheme ? 'rgba(255,255,255,.04)' : 'rgba(148,163,184,.12)'}
                        />
                        <line
                          x1={68 + index * 320}
                          x2={330 + index * 320}
                          y1={yBottom}
                          y2={yBottom}
                          stroke={darkTheme ? 'rgba(255,255,255,.04)' : 'rgba(148,163,184,.12)'}
                        />
                      </React.Fragment>
                    );
                  })}
                </g>
              ))}

              {chipScenes.map(({ chaosSession, orderedSession, chaos, ordered }) => {
                const conflict = chaosSession.conflicts.length > 0;
                const x = lerp(chaos.x, ordered.x, arrange);
                const y = lerp(chaos.y, ordered.y, arrange);
                const rotate = lerp(chaos.rotation, 0, arrange);
                const width = 246;
                const height = lerp(42, ordered.height, arrange);
                const fill =
                  conflict && chaosFade > 0.15
                    ? 'rgba(248,113,113,.22)'
                    : darkTheme
                      ? 'rgba(255,255,255,.07)'
                      : 'rgba(255,255,255,.92)';
                const stroke =
                  conflict && chaosFade > 0.15
                    ? 'rgba(248,113,113,.55)'
                    : darkTheme
                      ? 'rgba(255,255,255,.1)'
                      : 'rgba(148,163,184,.22)';

                return (
                  <g
                    key={chaosSession.id}
                    data-testid="contexto-session-chip"
                    className={conflict && chaosFade > 0.15 && !reduced ? 'cr-warn' : ''}
                    transform={`translate(${x} ${y}) rotate(${rotate})`}
                  >
                    <rect x="0" y="0" rx="14" width={width} height={height} fill={fill} stroke={stroke} />
                    <text x="14" y="18" fill={darkTheme ? '#f8fafc' : '#0f172a'} fontSize="12" fontWeight="700">
                      {sessionLabel(teamMap, orderedSession)}
                    </text>
                    <text x="14" y="33" fill={darkTheme ? '#94a3b8' : '#475569'} fontSize="11">
                      {sessionTime(orderedSession)}
                      {' · '}
                      {courtMap.get(orderedSession.court)?.label}
                    </text>
                    {conflict && chaosFade > 0.15 ? (
                      <text x={width - 54} y="20" fill="#fca5a5" fontSize="11" fontWeight="700">
                        SOLAPA
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
