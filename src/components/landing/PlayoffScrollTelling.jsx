import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePublicTheme } from '../../hooks/usePublicTheme';

export const PLAYOFF_BRACKET = {
  qf: [
    { a: 'Cadete A', b: 'Junior A' },
    { a: 'Infantil A', b: 'Mini Mixto', bye: true },
    { a: 'Cadete B', b: 'Junior B' },
    { a: 'Sénior', b: 'Infantil B' },
  ],
  sf: [
    { a: 'Ganador QF 1', b: 'Ganador QF 2' },
    { a: 'Ganador QF 3', b: 'Ganador QF 4' },
  ],
  final: { a: 'Ganador SF 1', b: 'Ganador SF 2', format: 'BO3' },
};

const PARTICLES = [
  { label: 'Cadete A', x: -55, y: -70 },
  { label: 'Junior A', x: 55, y: -80 },
  { label: 'Cadete B', x: -80, y: -10 },
  { label: 'Junior B', x: 80, y: -20 },
  { label: 'Infantil A', x: -65, y: 50 },
  { label: 'Mini Mixto', x: 65, y: 60 },
  { label: 'Infantil B', x: -45, y: 80 },
  { label: 'Sénior', x: 45, y: 90 },
  { label: 'BO3', x: 90, y: 30, accent: true },
  { label: 'BYE', x: -90, y: 20, accent: true },
  { label: '8 equipos', x: 0, y: -95, accent: true },
  { label: 'Cuartos · Semis · Final', x: 0, y: 95, accent: true },
];

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * clamp01(amount);
}

function easeOut(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function BracketDisplay({ visible, darkTheme }) {
  const cellBackground = darkTheme ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.96)';
  const cellBorder = darkTheme ? 'rgba(255,255,255,.1)' : 'rgba(148,163,184,.22)';

  return (
    <div
      className="mx-auto w-full max-w-lg"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity .3s ease' }}
      aria-label="Cuadro de playoffs generado"
    >
      <div className="mb-3 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>Cuartos</span>
        <span className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
        <span>Semis</span>
        <span className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
        <span>Final</span>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 flex-col justify-around gap-2">
          {PLAYOFF_BRACKET.qf.map((match, index) => (
            <div
              key={`${match.a}-${match.b}`}
              data-testid="playoff-bracket-cell"
              className="pt-bracket-cell overflow-hidden rounded-lg text-xs"
              style={{
                animationDelay: `${index * 120}ms`,
                opacity: 0,
                background: cellBackground,
                border: `1px solid ${cellBorder}`,
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-2.5 py-1.5 dark:border-white/10">
                <span className="truncate font-medium text-slate-800 dark:text-slate-200">{match.a}</span>
                {match.bye ? (
                  <span className="ml-1 shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
                    BYE
                  </span>
                ) : null}
              </div>
              <div className="px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200">{match.b}</div>
            </div>
          ))}
        </div>

        <div className="flex w-4 flex-col justify-around" aria-hidden="true">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-1 flex-col justify-around">
              <div className="h-1/4" />
              <div className="flex-1 border-r border-slate-300 dark:border-slate-600" />
              <div className="h-1/4" />
            </div>
          ))}
        </div>

        <div className="flex flex-1 flex-col justify-around gap-6">
          {PLAYOFF_BRACKET.sf.map((match, index) => (
            <div
              key={match.a}
              data-testid="playoff-bracket-cell"
              className="pt-bracket-cell overflow-hidden rounded-lg text-xs"
              style={{
                animationDelay: `${(4 + index) * 120}ms`,
                opacity: 0,
                background: cellBackground,
                border: `1px solid ${cellBorder}`,
              }}
            >
              <div className="border-b border-slate-200 px-2.5 py-1.5 text-slate-500 dark:border-white/10 dark:text-slate-400">
                {match.a}
              </div>
              <div className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400">{match.b}</div>
            </div>
          ))}
        </div>

        <div className="flex w-4 flex-col justify-around" aria-hidden="true">
          <div className="flex flex-1 flex-col justify-around">
            <div className="h-1/4" />
            <div className="flex-1 border-r border-orange-500/40" />
            <div className="h-1/4" />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div
            data-testid="playoff-bracket-cell"
            className="pt-bracket-cell overflow-hidden rounded-lg text-xs"
            style={{
              animationDelay: '720ms',
              opacity: 0,
              background: darkTheme ? 'rgba(249,115,22,.08)' : 'rgba(255,237,213,.92)',
              border: '1px solid rgba(249,115,22,.3)',
            }}
          >
            <div className="border-b border-orange-500/20 px-2.5 py-2 font-semibold text-orange-600 dark:text-orange-300">
              {PLAYOFF_BRACKET.final.a}
            </div>
            <div className="px-2.5 py-2 font-semibold text-orange-600 dark:text-orange-300">
              {PLAYOFF_BRACKET.final.b}
            </div>
            <div className="bg-orange-500/10 px-2.5 py-1 text-center text-[10px] font-bold text-orange-500">
              FINAL · {PLAYOFF_BRACKET.final.format}
            </div>
          </div>
        </div>
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
      { rootMargin: '200px' },
    );

    observer.observe(section);
    compute();

    return () => {
      observer.disconnect();
      detach();
    };
  }, [reduced]);

  const act1 = Math.min(1, progress / 0.33);
  const act2 = Math.max(0, Math.min(1, (progress - 0.33) / 0.33));
  const act3 = Math.max(0, Math.min(1, (progress - 0.66) / 0.34));

  const pdfOpacity = lerp(1, 0, easeOut(act2));
  const pdfScale = lerp(1, 0.4, easeOut(act2));
  const particleSpread = easeInOut(act2);
  const bracketVisible = act3 > 0.3;
  const activeStep = Math.min(2, Math.floor(progress * 2.99));
  const sectionBackground = darkTheme
    ? 'linear-gradient(180deg,#0a0a18 0%,#06060f 100%)'
    : 'linear-gradient(180deg,#f8fafc 0%,#ffffff 100%)';
  const pdfCardBackground = darkTheme ? 'linear-gradient(145deg,#1a1a30,#14142a)' : 'rgba(255,255,255,.96)';
  const pdfCardBorder = darkTheme ? 'rgba(249,115,22,.4)' : 'rgba(249,115,22,.22)';

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
            Un PDF. Un cuadro perfecto.
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">CB Demo Aro · Torneo de Reyes 2026</p>
        </div>

        <div className="relative flex w-full max-w-2xl items-center justify-center" style={{ minHeight: 320 }}>
          <div
            className={pdfOpacity > 0.05 && darkTheme ? 'pt-pdf-idle' : ''}
            style={{
              opacity: pdfOpacity,
              transform: `scale(${pdfScale})`,
              transition: 'none',
              position: 'absolute',
            }}
          >
            <div
              className="flex w-52 flex-col items-center gap-3 rounded-2xl p-6 text-center"
              style={{
                background: pdfCardBackground,
                border: `1px solid ${pdfCardBorder}`,
              }}
            >
              <div
                className="relative flex h-20 w-16 items-end justify-center rounded-xl pb-2"
                style={{ background: 'linear-gradient(145deg,#ef4444,#dc2626)' }}
              >
                <span className="text-xs font-black text-white">PDF</span>
                <div
                  className="absolute right-0 top-0 h-5 w-5"
                  style={{
                    background: 'rgba(0,0,0,.3)',
                    clipPath: 'polygon(100% 0,100% 100%,0 100%)',
                  }}
                />
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Bases_TorneoReyes2026.pdf</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                CB Demo Aro · 8 equipos · BO3 final · BYE automático
              </div>
            </div>
          </div>

          {PARTICLES.map((particle) => {
            const angle = Math.atan2(particle.y, particle.x);
            const tx = particleSpread * particle.x * 2.2;
            const ty = particleSpread * particle.y * 1.8;
            const opacity = particleSpread * (1 - act3 * 2);
            return (
              <div
                key={particle.label}
                className="pointer-events-none absolute rounded-lg px-2 py-1 text-xs font-semibold"
                style={{
                  opacity: Math.max(0, opacity),
                  transform: `translate(${tx}px,${ty}px) rotate(${angle * 30}deg)`,
                  background: particle.accent
                    ? darkTheme
                      ? 'rgba(249,115,22,.15)'
                      : 'rgba(255,237,213,.92)'
                    : darkTheme
                      ? 'rgba(255,255,255,.06)'
                      : 'rgba(255,255,255,.86)',
                  border: particle.accent
                    ? '1px solid rgba(249,115,22,.3)'
                    : darkTheme
                      ? '1px solid rgba(255,255,255,.1)'
                      : '1px solid rgba(148,163,184,.2)',
                  color: particle.accent ? '#f97316' : darkTheme ? '#cbd5e1' : '#475569',
                  whiteSpace: 'nowrap',
                }}
                aria-hidden="true"
              >
                {particle.label}
              </div>
            );
          })}

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: act3,
              transform: `scale(${lerp(0.85, 1, easeOut(act3))})`,
              pointerEvents: bracketVisible ? 'auto' : 'none',
            }}
          >
            <BracketDisplay visible={bracketVisible} darkTheme={darkTheme} />
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: index === activeStep ? 24 : 8,
                  background:
                    index === activeStep ? '#f97316' : darkTheme ? 'rgba(255,255,255,.2)' : 'rgba(148,163,184,.35)',
                }}
              />
            ))}
          </div>

          {act3 < 0.1 && !reduced ? <p className="mt-1 animate-bounce text-xs text-slate-500">Sigue bajando</p> : null}

          <Link
            to={user ? '/area-privada' : '/login'}
            data-testid="playoff-cta"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-orange-400 hover:text-orange-500 dark:text-slate-100"
            style={{
              background: darkTheme ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.82)',
              borderColor: darkTheme ? 'rgba(255,255,255,.08)' : 'rgba(148,163,184,.18)',
            }}
          >
            {user ? 'Abrir tus cuadros' : 'Probar con tus bases'}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
