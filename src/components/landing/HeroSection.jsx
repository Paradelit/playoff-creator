import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/* ─── Chat simulation data ──────────────────────────────────────── */
const USER_MSG =
  'Pick, crea un entrenamiento para mañana. 45 min, bloqueo directo y transición rápida.';

const PICK_BLOCKS = [
  { icon: '🏀', text: 'Entrenamiento generado — 45 min', bold: true },
  { icon: '🔥', text: 'Calentamiento activación · 8 min' },
  { icon: '⚡', text: 'Bloqueo directo 2×2 progresivo · 20 min' },
  { icon: '🏃', text: 'Transición rápida 5×0 → 5×5 · 12 min' },
  { icon: '🎯', text: 'Partido de aplicación · 5 min' },
];

/* ─── Keyframe styles injected once ─────────────────────────────── */
const STYLES = `
  @keyframes pc-blink    { 0%,100%{opacity:1}  50%{opacity:0} }
  @keyframes pc-slide-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pc-dot      { 0%,80%,100%{opacity:.25;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
  @keyframes pc-glow     { 0%,100%{box-shadow:0 0 24px 0 rgba(249,115,22,.15)} 50%{box-shadow:0 0 48px 8px rgba(249,115,22,.35)} }
  @keyframes pc-scan     { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
  .pc-cursor   { animation: pc-blink 1s step-end infinite; }
  .pc-chat-box { animation: pc-glow  3s ease-in-out infinite; }
  .pc-fsu      { animation: pc-slide-up .38s ease forwards; }
  .pc-d1       { animation: pc-dot 1.2s infinite 0s; }
  .pc-d2       { animation: pc-dot 1.2s infinite .22s; }
  .pc-d3       { animation: pc-dot 1.2s infinite .44s; }
`;

export default function HeroSection() {
  const { user } = useAuth();

  /* Simulation state machine */
  const [phase, setPhase] = useState('idle'); // idle | typing | thinking | responding | done
  const [typedLen, setTypedLen] = useState(0);
  const [visibleBlocks, setVisibleBlocks] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const schedule = (fn, ms) => {
      timerRef.current = setTimeout(fn, ms);
    };

    if (phase === 'idle') {
      schedule(() => setPhase('typing'), 600);
    } else if (phase === 'typing') {
      if (typedLen < USER_MSG.length) {
        schedule(() => setTypedLen((n) => n + 1), 28);
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
        schedule(() => setVisibleBlocks((n) => n + 1), 380);
      } else {
        schedule(() => {
          setPhase('idle');
          setTypedLen(0);
          setVisibleBlocks(0);
        }, 4500);
      }
    }

    return () => clearTimeout(timerRef.current);
  }, [phase, typedLen, visibleBlocks]);

  const showCursor = phase === 'typing' || phase === 'idle';
  const showThinking = phase === 'thinking';
  const showUserMsg = phase !== 'idle' || typedLen > 0;

  return (
    <>
      {/* Inject keyframes once */}
      <style>{STYLES}</style>

      <section
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #06060f 0%, #0d0d1f 50%, #0a0816 100%)' }}
      >
        {/* Subtle court-line background pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, #f97316 1px, transparent 1px), radial-gradient(circle at 50% 50%, #3b82f6 1px, transparent 1px)',
            backgroundSize: '80px 80px, 160px 160px',
          }}
        />
        {/* Glow blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,.12) 0%, transparent 70%)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,.10) 0%, transparent 70%)' }}
        />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-14 pb-20 lg:pt-20 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* ── Left: copy ── */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10">
                <Sparkles size={13} className="text-orange-400" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-widest text-orange-300 uppercase">
                  Copiloto IA para entrenadores
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] mb-6 tracking-tight">
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

              <p className="text-lg text-slate-300 mb-8 leading-relaxed max-w-lg">
                Pick analiza tus equipos, genera entrenamientos, crea cuadros de playoffs y te avisa de lo que importa.
                Tú entrenas. Pick trabaja.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to={user ? '/area-privada' : '/login'}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-base transition-all shadow-lg hover:scale-[1.02] active:scale-100"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff' }}
                >
                  {user ? 'Ir a tu área' : 'Empezar gratis'}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  to="/ayuda"
                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl font-semibold text-base border border-white/20 text-slate-200 hover:bg-white/10 transition-colors"
                >
                  Ver guías
                </Link>
              </div>

              {user && (
                <p className="mt-4 text-sm text-slate-400">
                  Sesión activa como <span className="text-slate-200 font-medium">{user.email}</span>
                </p>
              )}

              {/* Trust badges */}
              <div className="mt-8 flex flex-wrap gap-4">
                {['100% gratuito', 'Sin tarjeta', 'Privado por equipo'].map((label) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Right: Pick chat simulation ── */}
            <div className="relative">
              {/* Chat window */}
              <div
                className="pc-chat-box relative rounded-2xl border overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #111128, #0e0e20)',
                  borderColor: 'rgba(249,115,22,.25)',
                }}
              >
                {/* Window chrome */}
                <div
                  className="flex items-center gap-2 px-4 py-3 border-b"
                  style={{ borderColor: 'rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  <span className="ml-3 text-xs font-mono text-slate-400">Pick&Coach · copiloto IA</span>
                </div>

                {/* Chat area */}
                <div className="p-5 min-h-[280px] flex flex-col gap-4">
                  {/* User message */}
                  {showUserMsg && (
                    <div className="flex justify-end">
                      <div
                        className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-snug"
                        style={{ background: 'rgba(59,130,246,.25)', color: '#cbd5e1', border: '1px solid rgba(59,130,246,.2)' }}
                      >
                        {USER_MSG.slice(0, typedLen)}
                        {showCursor && (
                          <span className="pc-cursor ml-0.5 inline-block w-0.5 h-3.5 bg-blue-300 align-middle" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Thinking indicator */}
                  {showThinking && (
                    <div className="flex items-center gap-2 px-4 py-2.5">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
                        aria-hidden="true"
                      >
                        P
                      </span>
                      <div className="flex gap-1 items-center">
                        <span className="pc-d1 w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                        <span className="pc-d2 w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                        <span className="pc-d3 w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                      </div>
                    </div>
                  )}

                  {/* Pick response blocks */}
                  {visibleBlocks > 0 && (
                    <div className="flex gap-2.5">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                        style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
                        aria-hidden="true"
                      >
                        P
                      </span>
                      <div className="flex-1 space-y-2">
                        {PICK_BLOCKS.slice(0, visibleBlocks).map((block, i) => (
                          <div
                            key={i}
                            className="pc-fsu flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm"
                            style={{
                              background: i === 0 ? 'rgba(249,115,22,.12)' : 'rgba(255,255,255,.04)',
                              border: `1px solid ${i === 0 ? 'rgba(249,115,22,.25)' : 'rgba(255,255,255,.07)'}`,
                            }}
                          >
                            <span className="shrink-0 text-base leading-none" aria-hidden="true">{block.icon}</span>
                            <span
                              className={block.bold ? 'font-semibold text-orange-300' : 'text-slate-300'}
                            >
                              {block.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Decorative glow under the card */}
              <div
                aria-hidden="true"
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-2/3 h-12 blur-2xl rounded-full"
                style={{ background: 'rgba(249,115,22,.25)' }}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
