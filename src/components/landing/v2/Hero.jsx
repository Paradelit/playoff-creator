import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Send, MapPin, Plus, Maximize2, X, Pause, Play } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { usePublicTheme } from '../../../hooks/usePublicTheme';

const PROMPT_TEXT = 'Pick, prepara entreno mañana 18h. Cadete A. 60 min. Bloqueo directo y transición.';

const RESPONSE_TOKENS = [
  'Perfecto. ',
  'Te he preparado ',
  'un entreno de ',
  '60 min ',
  'enfocado en ',
  'bloqueo directo ',
  'y transición. ',
  'He añadido ',
  'calentamiento ',
  'específico ',
  'para los exteriores ',
  'y un partido ',
  'de aplicación ',
  'al final.',
];

const TRAINING_BLOCKS = [
  {
    icon: '🔥',
    time: "00'",
    dur: "8'",
    kind: 'Calentamiento',
    detail: 'Activación + manejo a dos balones',
    tone: 'cyan',
  },
  {
    icon: '🎯',
    time: "08'",
    dur: "12'",
    kind: 'Técnica individual',
    detail: 'Tiro tras bloqueo · catch & shoot',
    tone: 'cyan',
  },
  {
    icon: '⚡',
    time: "20'",
    dur: "20'",
    kind: 'Bloqueo directo',
    detail: 'P&R 2×2 · lectura defensa',
    tone: 'orange',
    highlight: true,
  },
  {
    icon: '🏃',
    time: "40'",
    dur: "12'",
    kind: 'Transición',
    detail: '5×0 → 5×5 · finalización',
    tone: 'orange',
  },
  {
    icon: '🏀',
    time: "52'",
    dur: "8'",
    kind: 'Aplicación',
    detail: 'Partido condicionado',
    tone: 'green',
  },
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
  orange: '#c2410c',
  cyan: '#1535A8',
  green: '#047857',
};

export default function Hero() {
  const { user } = useAuth();
  const { theme } = usePublicTheme();
  const reduced = useReducedMotion();
  const darkTheme = theme === 'dark';

  const [phase, setPhase] = useState(reduced ? 'done' : 'idle');
  const [typed, setTyped] = useState(reduced ? PROMPT_TEXT.length : 0);
  const [streamed, setStreamed] = useState(reduced ? RESPONSE_TOKENS.length : 0);
  const [blocksShown, setBlocksShown] = useState(reduced ? TRAINING_BLOCKS.length : 0);
  const [manualPaused, setManualPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const timerRef = useRef(null);
  const sectionRef = useRef(null);

  const isPaused = manualPaused || offscreen;

  useEffect(() => {
    if (reduced || isPaused) return undefined;
    const schedule = (callback, ms) => {
      timerRef.current = setTimeout(callback, ms);
    };
    if (phase === 'idle') {
      schedule(() => setPhase('typing'), 700);
    } else if (phase === 'typing') {
      if (typed < PROMPT_TEXT.length) {
        schedule(() => setTyped((value) => value + 1), 26);
      } else {
        schedule(() => setPhase('thinking'), 700);
      }
    } else if (phase === 'thinking') {
      schedule(() => setPhase('streaming'), 1300);
    } else if (phase === 'streaming') {
      if (streamed < RESPONSE_TOKENS.length) {
        schedule(() => setStreamed((value) => value + 1), 85);
      } else {
        schedule(() => setPhase('blocks'), 350);
      }
    } else if (phase === 'blocks') {
      if (blocksShown < TRAINING_BLOCKS.length) {
        schedule(() => setBlocksShown((value) => value + 1), 320);
      } else {
        schedule(() => setPhase('done'), 0);
      }
    } else if (phase === 'done') {
      schedule(() => {
        setPhase('idle');
        setTyped(0);
        setStreamed(0);
        setBlocksShown(0);
      }, 5000);
    }
    return () => clearTimeout(timerRef.current);
  }, [phase, reduced, isPaused, typed, streamed, blocksShown]);

  useEffect(() => {
    if (reduced) return undefined;
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  const restartDemo = () => {
    clearTimeout(timerRef.current);
    setPhase('idle');
    setTyped(0);
    setStreamed(0);
    setBlocksShown(0);
    setManualPaused(false);
  };

  const showCursor = phase === 'typing';
  const showThinking = phase === 'thinking';
  const showResponse = phase === 'streaming' || phase === 'blocks' || phase === 'done';
  const showUserMsg = phase !== 'idle';
  const isStreaming = phase === 'streaming';

  const heroBackground = darkTheme
    ? 'linear-gradient(180deg, #06060f 0%, #0a0e27 55%, #06060f 100%)'
    : 'linear-gradient(180deg, #ffffff 0%, #fff7ed 52%, #f8fafc 100%)';
  const gridLineColor = darkTheme ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)';
  const primaryBlob = darkTheme
    ? 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 65%)'
    : 'radial-gradient(circle, rgba(249,115,22,0.16) 0%, transparent 70%)';
  const secondaryBlob = darkTheme
    ? 'radial-gradient(circle, rgba(26,111,212,0.14) 0%, transparent 70%)'
    : 'radial-gradient(circle, rgba(26,111,212,0.12) 0%, transparent 72%)';

  const ctaLabel = user ? 'Ir a tu área' : 'Empezar gratis';
  const ctaTo = user ? '/area-privada' : '/login';

  const responseText = RESPONSE_TOKENS.slice(0, streamed).join('');

  return (
    <section
      ref={sectionRef}
      id="top"
      className="relative overflow-hidden transition-colors"
      style={{ background: heroBackground }}
      aria-label="Hero"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${gridLineColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)`,
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-[640px] w-[640px] rounded-full"
        style={{ background: primaryBlob, filter: 'blur(20px)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-44 right-0 h-[560px] w-[560px] rounded-full"
        style={{ background: secondaryBlob, filter: 'blur(20px)' }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-16 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-16 lg:px-8 lg:pb-32 lg:pt-24">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
            <Sparkles size={13} className="text-orange-400" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-300">
              Copiloto IA · pista cubierta
            </span>
          </div>

          <h1 className="mb-6 text-4xl font-extrabold leading-[1.04] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-[64px]">
            Tu pizarra.
            <br />
            Tu copiloto.
            <br />
            <span className="text-orange-500 dark:text-orange-400">Tu temporada.</span>
          </h1>

          <p className="mb-9 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            Pick reúne en un sitio lo que un entrenador necesita para ganar el lunes: entrenamientos generados con IA,
            cuadros de playoff que se montan solos, calendario y scouting.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to={ctaTo}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#06060f]"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            >
              {ctaLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a
              href="#tour"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300/80 px-7 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5 dark:focus-visible:ring-offset-[#06060f]"
            >
              Ver el tour ↓
            </a>
          </div>

          {user ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Sesión activa como <span className="font-medium text-slate-700 dark:text-slate-200">{user.email}</span>
            </p>
          ) : null}

          <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            {['100% gratuito', 'Sin tarjeta', 'Privado por equipo'].map((label) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                  style={{ boxShadow: '0 0 8px rgba(16,185,129,0.55)' }}
                />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <PickChatPanel
          darkTheme={darkTheme}
          phase={phase}
          typed={typed}
          showCursor={showCursor}
          showUserMsg={showUserMsg}
          showThinking={showThinking}
          showResponse={showResponse}
          isStreaming={isStreaming}
          responseText={responseText}
          blocksShown={blocksShown}
          reduced={reduced}
          isPaused={isPaused}
          manualPaused={manualPaused}
          onTogglePause={() => setManualPaused((value) => !value)}
          onRestart={restartDemo}
        />
      </div>

      {!reduced ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 lg:flex"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            scroll
          </span>
          <span
            className="h-7 w-px bg-gradient-to-b from-slate-400/60 to-transparent dark:from-slate-500/60"
            style={{ animation: 'pc-collapse 2.4s ease-in-out infinite alternate' }}
          />
        </div>
      ) : null}
    </section>
  );
}

function PickAvatar() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
      style={{
        background: 'linear-gradient(135deg, #f97316, #ea580c)',
        boxShadow: '0 4px 12px rgba(249,115,22,0.35)',
      }}
    >
      P
    </span>
  );
}

function PickChatPanel({
  darkTheme,
  phase,
  typed,
  showCursor,
  showUserMsg,
  showThinking,
  showResponse,
  isStreaming,
  responseText,
  blocksShown,
  reduced,
  isPaused,
  manualPaused,
  onTogglePause,
  onRestart,
}) {
  const panelGlow = darkTheme
    ? '0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(249,115,22,0.10), 0 0 60px -15px rgba(249,115,22,0.4)'
    : '0 30px 80px -20px rgba(15,23,42,0.18), 0 0 60px -15px rgba(249,115,22,0.18)';

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-6 -bottom-8 -top-6"
        style={{
          background: 'radial-gradient(60% 50% at 50% 50%, rgba(249,115,22,0.18) 0%, transparent 70%)',
          filter: 'blur(28px)',
        }}
      />

      <div
        className="relative overflow-hidden rounded-2xl border bg-white"
        style={{
          borderColor: '#E2E8F0',
          boxShadow: panelGlow,
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: '#F1F5F9' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-sm font-extrabold text-slate-900">Pick</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
              <MapPin size={10} aria-hidden="true" />
              Entrenamientos
            </span>
          </div>
          <div className="flex gap-1.5">
            {[Plus, Maximize2, X].map((Icon, idx) => (
              <span
                key={idx}
                aria-hidden="true"
                className="inline-flex h-6 w-6 items-center justify-center text-slate-400"
              >
                <Icon size={14} />
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-h-[440px] flex-col gap-3 bg-white px-4 py-4">
          {showUserMsg ? (
            <div className="flex justify-end">
              <div
                data-testid="hero-user-message"
                className="max-w-[85%] px-3.5 py-2.5 text-[13.5px] font-medium leading-snug text-white"
                style={{
                  background: '#1A6FD4',
                  borderRadius: '16px 16px 6px 16px',
                }}
              >
                {PROMPT_TEXT.slice(0, typed)}
                {showCursor ? (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block h-3.5 w-0.5 align-middle"
                    style={{ background: '#ffffff', animation: 'pc-blink 1s step-end infinite' }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {showThinking ? (
            <div className="flex items-end justify-start gap-2">
              <PickAvatar />
              <div
                aria-label="Pick está pensando"
                className="inline-flex items-center gap-1 px-3.5 py-2.5"
                style={{ background: '#F1F5F9', borderRadius: '16px 16px 16px 6px' }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
                  style={{ animation: 'pc-dot 1.2s infinite 0s' }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
                  style={{ animation: 'pc-dot 1.2s infinite 0.16s' }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
                  style={{ animation: 'pc-dot 1.2s infinite 0.32s' }}
                />
              </div>
            </div>
          ) : null}

          {showResponse ? (
            <div className="flex items-start justify-start gap-2">
              <PickAvatar />
              <div className="flex max-w-[calc(100%-44px)] flex-col gap-2">
                <div
                  className="px-3.5 py-2.5 text-[13.5px] leading-relaxed text-slate-800"
                  style={{ background: '#F1F5F9', borderRadius: '16px 16px 16px 6px' }}
                >
                  {responseText}
                  {isStreaming ? (
                    <span
                      aria-hidden="true"
                      className="ml-0.5 inline-block h-3.5 w-0.5 align-middle"
                      style={{ background: '#94A3B8', animation: 'pc-blink 1s step-end infinite' }}
                    />
                  ) : null}
                </div>

                {blocksShown > 0 ? (
                  <section
                    aria-label="Vista previa de entrenamiento generado por Pick"
                    className="rounded-xl border bg-white p-3 shadow-[0_4px_12px_-4px_rgba(15,23,42,0.08)]"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    <div
                      className="mb-1 flex items-center gap-2 border-b pb-2"
                      style={{ borderColor: '#F1F5F9' }}
                    >
                      <span
                        aria-hidden="true"
                        className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px]"
                        style={{ background: 'rgba(249,115,22,0.12)' }}
                      >
                        <span className="text-[11px] leading-none">🏀</span>
                      </span>
                      <span className="flex-1 truncate text-[12px] font-bold text-slate-900">
                        Entrenamiento generado
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                        60'
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        5 bloques
                      </span>
                    </div>

                    <ul className="m-0 flex flex-col gap-1.5 p-0">
                      {TRAINING_BLOCKS.slice(0, blocksShown).map((block) => (
                        <li
                          key={block.kind}
                          data-testid="hero-training-block"
                          className="pc-fsu flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                          style={{
                            background: block.highlight ? TONE_BG[block.tone] : '#F8FAFC',
                            border: `1px solid ${block.highlight ? TONE_BORDER[block.tone] : '#F1F5F9'}`,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="text-[15px] leading-none shrink-0"
                          >
                            {block.icon}
                          </span>
                          <span className="font-mono text-[10px] font-bold w-7 text-slate-500">
                            {block.time}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span
                              className="block text-[12.5px] font-semibold"
                              style={{ color: block.highlight ? TONE_LABEL[block.tone] : '#0F172A' }}
                            >
                              {block.kind}
                            </span>
                            <span className="block text-[11.5px] text-slate-500 mt-0.5 truncate">
                              {block.detail}
                            </span>
                          </span>
                          <span className="font-mono text-[10px] font-bold text-slate-600 shrink-0">
                            {block.dur}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {phase === 'done' ? (
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          className="rounded-lg border-0 px-3 py-1.5 text-[11.5px] font-bold text-white transition-transform hover:scale-[1.02] active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          style={{
                            background: '#1A6FD4',
                            boxShadow: '0 2px 6px -1px rgba(26,111,212,0.42)',
                          }}
                          tabIndex={-1}
                          aria-label="Demo: guardar entreno"
                        >
                          Guardar entreno
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          style={{ borderColor: '#E2E8F0' }}
                          tabIndex={-1}
                          aria-label="Demo: editar bloques"
                        >
                          Editar bloques
                        </button>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="flex items-center gap-1.5 border-t bg-white px-3 py-2.5"
          style={{ borderColor: '#F1F5F9' }}
        >
          <input
            type="text"
            disabled
            placeholder="Pregunta sobre Entrenamientos…"
            className="flex-1 rounded-lg border bg-slate-50 px-3 py-1.5 text-[13px] text-slate-700 placeholder-slate-400 outline-none"
            style={{ borderColor: '#E2E8F0' }}
            tabIndex={-1}
            aria-hidden="true"
          />
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white"
            style={{ background: '#1A6FD4' }}
          >
            <Send size={14} strokeWidth={2.4} />
          </span>
        </div>
      </div>

      {!reduced ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] font-medium">
          <button
            type="button"
            onClick={onRestart}
            className="rounded px-1.5 py-0.5 text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label="Reiniciar la demo"
          >
            Reiniciar
          </button>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
            ·
          </span>
          <button
            type="button"
            onClick={onTogglePause}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label={manualPaused ? 'Reanudar la demo' : 'Pausar la demo'}
            aria-pressed={manualPaused}
          >
            {manualPaused ? <Play size={11} aria-hidden="true" /> : <Pause size={11} aria-hidden="true" />}
            {manualPaused ? 'Reanudar' : 'Pausar'}
          </button>
          <span
            aria-live="polite"
            className="ml-1 inline-flex items-center text-[10px] font-mono uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500"
          >
            {isPaused ? (manualPaused ? 'pausada' : 'en espera') : 'demo en vivo'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
