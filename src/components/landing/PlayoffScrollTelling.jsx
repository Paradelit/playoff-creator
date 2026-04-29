import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trophy, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePublicTheme } from '../../hooks/usePublicTheme';

// Torneo de Reyes 2026 — Cadete Masculino. Ocho clubes federados de Madrid.
// CB Demo Aro es el equipo del usuario (myTeam).
const TEAMS_IN_ORDER = [
  { name: 'CB Demo Aro', sub: 'Cadete · Masculino', isMyTeam: true },
  { name: 'CB Movistar', sub: 'Cadete · Masculino' },
  { name: 'Estudiantes', sub: 'Cadete · Masculino' },
  { name: 'CB Hortaleza', sub: 'Cadete · Masculino' },
  { name: 'Real Madrid', sub: 'Cadete · Masculino' },
  { name: 'CB Aravaca', sub: 'Cadete · Masculino' },
  { name: 'CB Pozuelo', sub: 'Cadete · Masculino' },
  { name: 'CB Moncloa', sub: 'Cadete · Masculino' },
];

export const PLAYOFF_BRACKET = {
  qf: [
    { a: 'CB Demo Aro', b: 'CB Movistar' },
    { a: 'Estudiantes', b: 'CB Hortaleza' },
    { a: 'Real Madrid', b: 'CB Aravaca' },
    { a: 'CB Pozuelo', b: 'CB Moncloa' },
  ],
  sf: [
    { a: 'Ganador QF 1', b: 'Ganador QF 2' },
    { a: 'Ganador QF 3', b: 'Ganador QF 4' },
  ],
  final: { a: 'Ganador SF 1', b: 'Ganador SF 2', format: 'BO3' },
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * clamp01(amount);
}

function easeOut(value) {
  return 1 - Math.pow(1 - value, 3);
}

function BracketCell({
  title,
  team1,
  team2,
  score1,
  score2,
  bye,
  isFinal,
  isMyTeam,
  darkTheme,
  visible,
  showScores,
  size = 'sm',
}) {
  const baseBg = darkTheme ? 'rgba(255,255,255,.04)' : '#ffffff';
  const baseBorder = isFinal ? '#FBBF24' : darkTheme ? 'rgba(255,255,255,.1)' : '#CBD5E1';
  const headerBg = isFinal ? '#FBBF24' : darkTheme ? 'rgba(255,255,255,.06)' : '#E2E8F0';
  const headerColor = isFinal ? '#ffffff' : darkTheme ? '#cbd5e1' : '#334155';
  const rowBorder = darkTheme ? 'rgba(255,255,255,.08)' : '#F1F5F9';
  const teamColor = darkTheme ? '#e2e8f0' : '#1E293B';
  const placeholderColor = darkTheme ? '#64748b' : '#94A3B8';
  const myTeamBg = darkTheme ? 'rgba(251,191,36,0.10)' : '#FEF3C7';
  const myTeamColor = darkTheme ? '#FBBF24' : '#92400E';

  const padding = size === 'lg' ? 'px-2.5 py-1.5' : 'px-2 py-1';
  const teamFontSize = size === 'lg' ? 'text-[12px]' : 'text-[11px]';
  const headerFontSize = size === 'lg' ? 'text-[10px]' : 'text-[9px]';

  const renderRow = (team, score, isLast) => {
    const placeholder = !team || team.startsWith('Ganador');
    const isMyTeamRow = isMyTeam && team === 'CB Demo Aro';
    return (
      <div
        className={`flex items-center justify-between ${padding}`}
        style={{
          borderBottom: isLast ? 'none' : `1px solid ${rowBorder}`,
          background: isMyTeamRow ? myTeamBg : 'transparent',
        }}
      >
        <span
          className={`truncate ${teamFontSize} font-semibold`}
          style={{
            color: placeholder ? placeholderColor : isMyTeamRow ? myTeamColor : teamColor,
            fontStyle: placeholder ? 'italic' : 'normal',
          }}
        >
          {team || 'Por determinar'}
        </span>
        {bye && isLast ? (
          <span className="ml-1 shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500">
            BYE
          </span>
        ) : (
          <span
            className="ml-2 inline-flex w-6 shrink-0 items-center justify-center font-mono text-[10px] font-bold tabular-nums"
            style={{
              color: showScores && score ? (isMyTeamRow ? myTeamColor : teamColor) : placeholderColor,
              minHeight: 16,
            }}
          >
            {showScores && score ? score : '—'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      data-testid="playoff-bracket-cell"
      className="overflow-hidden rounded-md"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 350ms cubic-bezier(0.16,1,0.3,1), transform 350ms cubic-bezier(0.16,1,0.3,1)',
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        boxShadow: isFinal
          ? '0 10px 15px -3px rgba(251,191,36,0.40), 0 4px 6px -4px rgba(251,191,36,0.40)'
          : darkTheme
            ? 'none'
            : '0 1px 2px rgba(15,23,42,0.05), 0 2px 4px -2px rgba(15,23,42,0.06)',
      }}
    >
      <header
        className={`flex items-center justify-center gap-1 px-2 py-0.5 text-center font-mono ${headerFontSize} font-bold uppercase tracking-[0.08em]`}
        style={{ background: headerBg, color: headerColor }}
      >
        {isFinal ? <Trophy size={10} aria-hidden="true" /> : null}
        <span>{title}</span>
        {isFinal ? <Trophy size={10} aria-hidden="true" /> : null}
      </header>
      {renderRow(team1, score1, false)}
      {renderRow(team2, score2, true)}
    </div>
  );
}

function VerticalLine({ amber, height = 16, darkTheme }) {
  const color = amber ? '#F59E0B' : darkTheme ? 'rgba(255,255,255,0.18)' : '#CBD5E1';
  return (
    <div
      aria-hidden="true"
      style={{
        width: 2,
        height,
        background: color,
      }}
    />
  );
}

/**
 * Subtree rendering: parent (SF) on top, then 2 children (QF) at the bottom,
 * connected by 2px lines that form an inverted-T (┴ rotated 180). Mirrors the
 * shape of the real BracketNode.jsx recursion.
 *
 * `myTeamSlot`: which child carries the my-team path: 'left', 'right', or null.
 */
function BracketSubtree({ sf, qfLeft, qfRight, myTeamSlot, darkTheme, sfVisible, qfVisible, showScores }) {
  const slateColor = darkTheme ? 'rgba(255,255,255,0.18)' : '#CBD5E1';
  const leftConnectorColor = myTeamSlot === 'left' ? '#F59E0B' : slateColor;
  const rightConnectorColor = myTeamSlot === 'right' ? '#F59E0B' : slateColor;

  return (
    <div className="flex flex-col items-stretch">
      <div className="flex justify-center">
        <BracketCell
          {...sf}
          darkTheme={darkTheme}
          visible={sfVisible}
          showScores={showScores}
          isMyTeam={myTeamSlot === 'left'}
        />
      </div>

      <div className="flex flex-col items-center">
        <VerticalLine amber={!!myTeamSlot} darkTheme={darkTheme} />
      </div>

      <div className="grid grid-cols-2">
        <div className="relative flex flex-col items-center">
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 h-[2px] w-1/2"
            style={{ background: leftConnectorColor }}
          />
          <VerticalLine amber={myTeamSlot === 'left'} darkTheme={darkTheme} />
          <div className="mt-0 w-[88%]">
            <BracketCell
              {...qfLeft}
              darkTheme={darkTheme}
              visible={qfVisible}
              showScores={showScores}
              isMyTeam={myTeamSlot === 'left'}
            />
          </div>
        </div>
        <div className="relative flex flex-col items-center">
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 h-[2px] w-1/2"
            style={{ background: rightConnectorColor }}
          />
          <VerticalLine amber={myTeamSlot === 'right'} darkTheme={darkTheme} />
          <div className="mt-0 w-[88%]">
            <BracketCell
              {...qfRight}
              darkTheme={darkTheme}
              visible={qfVisible}
              showScores={showScores}
              isMyTeam={myTeamSlot === 'right'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function BracketDisplay({ darkTheme, qfFilled, sfVisible, finalVisible, showScores }) {
  const slateColor = darkTheme ? 'rgba(255,255,255,0.18)' : '#CBD5E1';

  return (
    <div className="mx-auto w-full max-w-md" aria-label="Cuadro de playoffs generado">
      <div className="mb-2 flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        <span>Cuadro · 8 equipos · BO3 final</span>
      </div>

      <div className="flex flex-col items-stretch">
        {/* Final at the top */}
        <div className="flex justify-center">
          <BracketCell
            title="Final · BO3"
            team1="CB Demo Aro"
            team2="Por determinar"
            isFinal
            isMyTeam
            darkTheme={darkTheme}
            visible={finalVisible}
            showScores={showScores}
            size="lg"
          />
        </div>

        {/* Connector down from FINAL */}
        <div className="flex flex-col items-center">
          <VerticalLine amber height={18} darkTheme={darkTheme} />
        </div>

        {/* SF→FINAL ceiling: half left amber, half right slate */}
        <div className="grid grid-cols-2">
          <div className="relative h-0">
            <div
              aria-hidden="true"
              className="absolute right-0 top-0 h-[2px] w-1/2"
              style={{ background: '#F59E0B' }}
            />
          </div>
          <div className="relative h-0">
            <div
              aria-hidden="true"
              className="absolute left-0 top-0 h-[2px] w-1/2"
              style={{ background: slateColor }}
            />
          </div>
        </div>

        {/* Vertical lines down to each SF subtree */}
        <div className="grid grid-cols-2">
          <div className="flex flex-col items-center">
            <VerticalLine amber height={18} darkTheme={darkTheme} />
          </div>
          <div className="flex flex-col items-center">
            <VerticalLine darkTheme={darkTheme} height={18} />
          </div>
        </div>

        {/* SF + QF subtrees side by side */}
        <div className="grid grid-cols-2 gap-2">
          <BracketSubtree
            sf={{ title: 'Semi 1', team1: 'CB Demo Aro', team2: 'Estudiantes', score1: '71', score2: '58' }}
            qfLeft={{ title: 'Cuarto 1', team1: 'CB Demo Aro', team2: 'CB Movistar', score1: '78', score2: '72' }}
            qfRight={{ title: 'Cuarto 2', team1: 'Estudiantes', team2: 'CB Hortaleza', score1: '89', score2: '74' }}
            myTeamSlot="left"
            darkTheme={darkTheme}
            sfVisible={sfVisible}
            qfVisible={qfFilled}
            showScores={showScores}
          />
          <BracketSubtree
            sf={{ title: 'Semi 2', team1: 'Real Madrid', team2: 'CB Pozuelo' }}
            qfLeft={{ title: 'Cuarto 3', team1: 'Real Madrid', team2: 'CB Aravaca', score1: '82', score2: '75' }}
            qfRight={{ title: 'Cuarto 4', team1: 'CB Pozuelo', team2: 'CB Moncloa', score1: '88', score2: '64' }}
            myTeamSlot={null}
            darkTheme={darkTheme}
            sfVisible={sfVisible}
            qfVisible={qfFilled}
            showScores={showScores}
          />
        </div>
      </div>
    </div>
  );
}

function PdfDocument({ darkTheme, scanProgress, highlightedIndex }) {
  const sheetBg = darkTheme ? 'linear-gradient(180deg,#FAFAFA,#E5E7EB)' : '#FFFFFF';
  const sheetBorder = darkTheme ? 'rgba(255,255,255,0.18)' : '#9CA3AF';
  const sheetShadow = darkTheme
    ? '0 30px 60px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)'
    : '0 30px 60px -15px rgba(15,23,42,0.25), 0 0 0 1px rgba(15,23,42,0.04)';

  return (
    <div
      className="relative w-full"
      style={{ maxWidth: 280, aspectRatio: '17/22' }}
      aria-label="Documento de bases del torneo"
    >
      <div
        className="relative h-full w-full overflow-hidden font-sans"
        style={{
          background: sheetBg,
          border: `1px solid ${sheetBorder}`,
          boxShadow: sheetShadow,
          color: '#1E293B',
        }}
      >
        <div
          aria-hidden="true"
          className="absolute right-0 top-0"
          style={{
            width: 22,
            height: 22,
            background: 'linear-gradient(135deg, transparent 50%, #D1D5DB 50%)',
            boxShadow: 'inset -1px -1px 0 rgba(15,23,42,0.08)',
          }}
        />

        <div className="flex items-center justify-between px-4 pb-2 pt-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-1.5">
            <FileText size={11} className="text-rose-600" aria-hidden="true" />
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
              PDF · 2 págs.
            </span>
          </div>
          <span className="font-mono text-[8px] tabular-nums text-slate-400">2026·04</span>
        </div>

        <div className="px-4 py-3">
          <p className="m-0 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Bases · Federación Madrid
          </p>
          <h3 className="mb-0 mt-1 text-[14px] font-extrabold leading-tight text-slate-900">Torneo de Reyes 2026</h3>
          <p className="m-0 mt-0.5 text-[10px] font-semibold text-slate-700">Cadete Masculino · Federado</p>
          <p className="m-0 text-[10px] text-slate-500">8 equipos · cuartos BO1 · final BO3</p>
        </div>

        <section className="px-4 py-1">
          <p className="m-0 mb-1.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-700">
            Clubes participantes
          </p>
          <ol className="m-0 list-none space-y-[2px] p-0">
            {TEAMS_IN_ORDER.map((team, idx) => {
              const lineStart = idx / TEAMS_IN_ORDER.length;
              const lineEnd = (idx + 1) / TEAMS_IN_ORDER.length;
              const reached = scanProgress >= lineEnd - 0.04;
              const beam = scanProgress >= lineStart && scanProgress <= lineEnd;
              const captured = highlightedIndex !== null && idx <= highlightedIndex;
              const isMy = team.isMyTeam;
              return (
                <li
                  key={team.name}
                  className="relative flex items-baseline gap-1.5 rounded px-1 py-0.5 transition-colors"
                  style={{
                    background: beam
                      ? 'rgba(249,115,22,0.16)'
                      : captured
                        ? isMy
                          ? 'rgba(251,191,36,0.16)'
                          : 'rgba(248,250,252,1)'
                        : 'transparent',
                    color: captured ? '#0F172A' : '#475569',
                  }}
                >
                  <span className="w-4 shrink-0 font-mono text-[9px] font-bold text-slate-400">{idx + 1}.</span>
                  <span className={`flex-1 truncate text-[10.5px] ${reached ? 'font-semibold' : 'font-medium'}`}>
                    {team.name}
                  </span>
                  {isMy ? (
                    <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-amber-700">
                      tu club
                    </span>
                  ) : null}
                  {beam ? (
                    <span
                      aria-hidden="true"
                      className="absolute right-1 top-1/2 inline-block h-1 w-1 -translate-y-1/2 rounded-full"
                      style={{ background: '#F97316', boxShadow: '0 0 6px rgba(249,115,22,0.7)' }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="border-t border-dashed px-4 py-2" style={{ borderColor: '#E5E7EB' }}>
          <p className="m-0 mb-1 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-700">
            Formato
          </p>
          <ul className="m-0 list-none p-0 text-[10px] text-slate-600">
            <li>· Cuartos · BO1 (sáb 11/05)</li>
            <li>· Semis · BO1 (dom 12/05)</li>
            <li>· Final · BO3 (sáb 18/05 · dom 19/05)</li>
          </ul>
        </section>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 h-1.5"
          style={{
            top: `${scanProgress * 80 + 20}%`,
            background: 'linear-gradient(180deg, transparent, rgba(249,115,22,0.4), transparent)',
            mixBlendMode: 'multiply',
            transition: 'top 80ms linear',
          }}
        />
      </div>
    </div>
  );
}

export default function PlayoffScrollTelling() {
  const { user } = useAuth();
  const { theme } = usePublicTheme();
  const sectionRef = useRef(null);
  const reduced = useReducedMotion();
  const darkTheme = theme === 'dark';
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
      { rootMargin: '200px' },
    );
    observer.observe(section);
    compute();
    return () => {
      observer.disconnect();
      detach();
    };
  }, [reduced]);

  // Three acts mapped to the bracket build sequence:
  //  act1 (0..0.40): Pick scanea el PDF, los nombres se subrayan en orden
  //  act2 (0.40..0.75): los QFs se rellenan con los equipos extraídos + scores
  //  act3 (0.75..1):    SFs se rellenan con los ganadores y la Final corona
  const act1 = clamp01(progress / 0.4);
  const act2 = clamp01((progress - 0.4) / 0.35);
  const act3 = clamp01((progress - 0.75) / 0.25);

  // Scan beam progresses through 0..1 across PDF height.
  const scanProgress = reduced ? 1 : act1;
  // Last team highlighted by the scan: maps act1 to 0..7.
  const highlightedIndex = reduced ? TEAMS_IN_ORDER.length - 1 : Math.floor(act1 * TEAMS_IN_ORDER.length);

  // QF cells fade in as act2 progresses; scores appear in second half of act2.
  const qfFilled = reduced ? true : act2 > 0.05;
  const showScores = reduced ? true : act2 > 0.55;

  // SF cells fill at start of act3.
  const sfVisible = reduced ? true : act3 > 0.05;
  // Final crowns once SFs have had time to fill — narrative climax, not a teleport.
  const finalVisible = reduced ? true : act3 > 0.55;

  const activeStep = reduced ? 2 : Math.min(2, Math.floor(progress * 2.99));
  const sectionBackground = darkTheme
    ? 'linear-gradient(180deg,#0a0a18 0%,#06060f 100%)'
    : 'linear-gradient(180deg,#f8fafc 0%,#ffffff 100%)';

  return (
    <section
      ref={sectionRef}
      className="relative transition-colors"
      style={{ height: '300vh', background: sectionBackground }}
    >
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6">
        <div className="absolute top-12 left-1/2 max-w-2xl -translate-x-1/2 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-400">Playoffs con IA</p>
          <h2
            className="text-3xl font-extrabold text-slate-900 dark:text-white lg:text-4xl"
            style={{
              opacity: lerp(0, 1, easeOut(act1 * 3)),
              transform: `translateY(${lerp(20, 0, easeOut(act1 * 3))}px)`,
            }}
          >
            Un PDF. Un playoff listo.
          </h2>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
            CB Demo Aro · Torneo de Reyes 2026
          </p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Sube las bases. Pick lee, entiende y monta el cuadro con BYE, BO1 y BO3 en segundos.
          </p>
        </div>

        <div className="relative mt-24 flex w-full max-w-5xl items-start justify-center gap-8 lg:gap-14">
          <div
            className="relative w-full max-w-xs flex-shrink-0"
            style={{
              opacity: lerp(1, 0.4, easeOut(act3)),
              transform: `translateX(${lerp(0, -20, easeOut(act3))}px) scale(${lerp(1, 0.96, easeOut(act3))})`,
              transition: 'opacity 200ms ease, transform 200ms ease',
            }}
          >
            <PdfDocument darkTheme={darkTheme} scanProgress={scanProgress} highlightedIndex={highlightedIndex} />
          </div>

          <div className="relative flex-1 max-w-md">
            <BracketDisplay
              darkTheme={darkTheme}
              qfFilled={qfFilled}
              sfVisible={sfVisible}
              finalVisible={finalVisible}
              showScores={showScores}
            />
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[
              { label: 'Pick lee el PDF', short: '01' },
              { label: 'Cuadros y BYE', short: '02' },
              { label: 'Final coronada', short: '03' },
            ].map((step, index) => {
              const active = index === activeStep;
              return (
                <span
                  key={step.short}
                  aria-hidden="true"
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: active ? 28 : 8,
                    background: active ? '#f97316' : darkTheme ? 'rgba(255,255,255,.2)' : 'rgba(148,163,184,.35)',
                  }}
                />
              );
            })}
          </div>
          <span
            aria-live="polite"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
          >
            {`${String(activeStep + 1).padStart(2, '0')} / 03 · ${
              ['Pick lee el PDF', 'Cuadros y BYE', 'Final coronada'][activeStep]
            }`}
          </span>

          {act3 < 0.1 && !reduced ? <p className="m-0 animate-bounce text-xs text-slate-500">Sigue bajando</p> : null}

          <Link
            to={user ? '/area-privada' : '/login'}
            data-testid="playoff-cta"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-orange-400 hover:text-orange-500 dark:text-slate-100"
            style={{
              background: darkTheme ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.82)',
              borderColor: darkTheme ? 'rgba(255,255,255,.08)' : 'rgba(148,163,184,.18)',
            }}
          >
            {user ? 'Abrir tus playoffs' : 'Probar con tus bases'}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
