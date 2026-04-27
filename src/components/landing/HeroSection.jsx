import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePublicTheme } from '../../hooks/usePublicTheme';

export const USER_MSG = 'Pick, crea un entrenamiento para mañana. 45 min, bloqueo directo y transición rápida.';

export const PICK_BLOCKS = [
  { icon: '🏀', text: 'Entrenamiento generado — 45 min', bold: true },
  { icon: '🔥', text: 'Calentamiento activación · 8 min' },
  { icon: '⚡', text: 'Bloqueo directo 2×2 progresivo · 20 min' },
  { icon: '🏃', text: 'Transición rápida 5×0 → 5×5 · 12 min' },
  { icon: '🎯', text: 'Partido de aplicación · 5 min' },
];

export default function HeroSection() {
  const { user } = useAuth();
  const { theme } = usePublicTheme();
  const reduced = useReducedMotion();
  const darkTheme = theme === 'dark';

  const [phase, setPhase] = useState('done');
  const [typedLen, setTypedLen] = useState(USER_MSG.length);
  const [visibleBlocks, setVisibleBlocks] = useState(PICK_BLOCKS.length);
  const timerRef = useRef(null);

  useEffect(() => {
    if (reduced) return undefined;

    const schedule = (callback, delay) => {
      timerRef.current = setTimeout(callback, delay);
    };

    if (phase === 'done') {
      schedule(() => {
        setPhase('idle');
        setTypedLen(0);
        setVisibleBlocks(0);
      }, 4500);
    } else if (phase === 'idle') {
      schedule(() => setPhase('typing'), 600);
    } else if (phase === 'typing') {
      if (typedLen < USER_MSG.length) {
        schedule(() => setTypedLen((value) => value + 1), 28);
      } else {
        schedule(() => setPhase('thinking'), 800);
      }
    } else if (phase === 'thinking') {
      schedule(() => {
        setVisibleBlocks(0);
        setPhase('responding');
      }, 1500);
    } else if (phase === 'responding') {
      if (visibleBlocks < PICK_BLOCKS.length) {
        schedule(() => setVisibleBlocks((value) => value + 1), 380);
      } else {
        schedule(() => setPhase('done'), 0);
      }
    }

    return () => clearTimeout(timerRef.current);
  }, [phase, reduced, typedLen, visibleBlocks]);

  const showCursor = phase === 'typing' || phase === 'idle';
  const showThinking = phase === 'thinking';
  const showUserMsg = phase !== 'idle' || typedLen > 0;
  const heroBackground = darkTheme
    ? 'linear-gradient(135deg, #06060f 0%, #0d0d1f 50%, #0a0816 100%)'
    : 'linear-gradient(180deg, #ffffff 0%, #fff7ed 52%, #f8fafc 100%)';
  const patternOpacity = darkTheme ? '0.04' : '0.06';
  const primaryBlob = darkTheme
    ? 'radial-gradient(circle, rgba(59,130,246,.12) 0%, transparent 70%)'
    : 'radial-gradient(circle, rgba(249,115,22,.12) 0%, transparent 72%)';
  const secondaryBlob = darkTheme
    ? 'radial-gradient(circle, rgba(249,115,22,.10) 0%, transparent 70%)'
    : 'radial-gradient(circle, rgba(59,130,246,.08) 0%, transparent 72%)';
  const chatBoxBackground = darkTheme ? 'linear-gradient(145deg, #111128, #0e0e20)' : 'rgba(255,255,255,.92)';
  const chatBoxBorder = darkTheme ? 'rgba(249,115,22,.25)' : 'rgba(249,115,22,.18)';
  const chromeBackground = darkTheme ? 'rgba(255,255,255,.03)' : 'rgba(248,250,252,.95)';
  const chromeBorder = darkTheme ? 'rgba(255,255,255,.06)' : 'rgba(148,163,184,.16)';
  const userBubbleBackground = darkTheme ? 'rgba(59,130,246,.25)' : 'rgba(219,234,254,.92)';
  const userBubbleBorder = darkTheme ? 'rgba(59,130,246,.2)' : 'rgba(96,165,250,.35)';
  const userBubbleText = darkTheme ? '#cbd5e1' : '#1e3a8a';
  const responseAccent = darkTheme ? 'rgba(249,115,22,.12)' : 'rgba(255,237,213,.95)';
  const responseNeutral = darkTheme ? 'rgba(255,255,255,.04)' : 'rgba(248,250,252,.95)';
  const responseNeutralBorder = darkTheme ? 'rgba(255,255,255,.07)' : 'rgba(148,163,184,.16)';
  const glowClass = darkTheme ? 'pc-chat-box' : '';

  return (
    <section className="relative overflow-hidden transition-colors" style={{ background: heroBackground }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: patternOpacity,
          backgroundImage:
            'radial-gradient(circle at 50% 50%, #f97316 1px, transparent 1px), radial-gradient(circle at 50% 50%, #3b82f6 1px, transparent 1px)',
          backgroundSize: '80px 80px, 160px 160px',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full"
        style={{ background: primaryBlob }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-0 h-[500px] w-[500px] rounded-full"
        style={{ background: secondaryBlob }}
      />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-14 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
              <Sparkles size={13} className="text-orange-400" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-500 dark:text-orange-300">
                Copiloto IA para entrenadores
              </span>
            </div>

            <h1 className="mb-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              Entrena{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #f97316, #fb923c, #fbbf24)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                más inteligente.
              </span>
              <br />
              Con IA.
            </h1>

            <p className="mb-8 max-w-lg text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Pick analiza tus equipos, genera entrenamientos, crea cuadros de playoffs y te avisa de lo que importa. Tú
              entrenas. Pick trabaja.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to={user ? '/area-privada' : '/login'}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-100"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
              >
                {user ? 'Ir a tu área' : 'Empezar gratis'}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                to="/ayuda"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300/80 px-7 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Ver guías
              </Link>
            </div>

            {user ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Sesión activa como <span className="font-medium text-slate-700 dark:text-slate-200">{user.email}</span>
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-4">
              {['100% gratuito', 'Sin tarjeta', 'Privado por equipo'].map((label) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className={`${glowClass} relative overflow-hidden rounded-2xl border`}
              style={{
                background: chatBoxBackground,
                borderColor: chatBoxBorder,
              }}
            >
              <div
                className="flex items-center gap-2 border-b px-4 py-3"
                style={{ borderColor: chromeBorder, background: chromeBackground }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                <span className="ml-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                  Pick&amp;Coach · copiloto IA
                </span>
              </div>

              <div className="flex min-h-[280px] flex-col gap-4 p-5">
                {showUserMsg ? (
                  <div className="flex justify-end">
                    <div
                      data-testid="hero-user-message"
                      className="max-w-[85%] rounded-2xl rounded-tr-sm border px-4 py-2.5 text-sm leading-snug"
                      style={{
                        background: userBubbleBackground,
                        borderColor: userBubbleBorder,
                        color: userBubbleText,
                      }}
                    >
                      {USER_MSG.slice(0, typedLen)}
                      {showCursor ? (
                        <span className="pc-cursor ml-0.5 inline-block h-3.5 w-0.5 bg-blue-400 align-middle" />
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {showThinking ? (
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
                      aria-hidden="true"
                    >
                      P
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="pc-d1 inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
                      <span className="pc-d2 inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
                      <span className="pc-d3 inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
                    </div>
                  </div>
                ) : null}

                {visibleBlocks > 0 ? (
                  <div className="flex gap-2.5">
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
                      aria-hidden="true"
                    >
                      P
                    </span>
                    <div className="flex-1 space-y-2">
                      {PICK_BLOCKS.slice(0, visibleBlocks).map((block, index) => (
                        <div
                          key={block.text}
                          data-testid="hero-pick-block"
                          className="pc-fsu flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm"
                          style={{
                            background: index === 0 ? responseAccent : responseNeutral,
                            borderColor: index === 0 ? 'rgba(249,115,22,.25)' : responseNeutralBorder,
                          }}
                        >
                          <span className="shrink-0 text-base leading-none" aria-hidden="true">
                            {block.icon}
                          </span>
                          <span
                            className={
                              block.bold
                                ? 'font-semibold text-orange-600 dark:text-orange-300'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {block.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              aria-hidden="true"
              className="absolute -bottom-6 left-1/2 h-12 w-2/3 -translate-x-1/2 rounded-full blur-2xl"
              style={{ background: darkTheme ? 'rgba(249,115,22,.25)' : 'rgba(249,115,22,.14)' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
