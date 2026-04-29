import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet, Send } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAuth } from '../../contexts/AuthContext';

const STEPS = [
  {
    n: '01',
    title: 'Crea tu cuenta',
    description: 'Regístrate gratis en segundos con Google, Apple o correo. Sin tarjeta.',
    color: '#f97316',
    Scene: SceneSignup,
  },
  {
    n: '02',
    title: 'Importa tu temporada',
    description: 'Sube el cuadrante en Excel. Pick coloca cada partido y entreno en su semana, sin solapes.',
    color: '#3b82f6',
    Scene: SceneImport,
  },
  {
    n: '03',
    title: 'Pídele lo que quieras',
    description: 'Pick conoce tu equipo y tu calendario. Le hablas en español y te genera entrenos, cuadros, scouting.',
    color: '#8b5cf6',
    Scene: ScenePick,
  },
];

function Step({ s, delay, reduced }) {
  const ref = useRef(null);
  const Scene = s.Scene;

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    if (reduced) {
      element.classList.add('hi-visible');
      element.style.animation = 'none';
      element.style.opacity = '1';
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.style.animationDelay = `${delay}ms`;
        element.classList.add('hi-visible');
        observer.disconnect();
      },
      { threshold: 0.2 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [delay, reduced]);

  return (
    <div ref={ref} className="hi-step relative flex flex-col items-stretch text-center">
      <div
        className="mx-auto mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
        style={{ background: `${s.color}20`, border: `1px solid ${s.color}40`, color: s.color }}
      >
        {s.n}
      </div>
      <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
      <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.description}</p>
      <div
        className="rounded-2xl border bg-white px-3 py-3 shadow-sm dark:bg-[#11132a]"
        style={{
          borderColor: 'rgba(148,163,184,.22)',
          minHeight: 110,
        }}
      >
        <Scene reduced={reduced} accent={s.color} />
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const reduced = useReducedMotion();
  const { user } = useAuth();
  const ctaTo = user ? '/area-privada' : '/login';
  const ctaLabel = user ? 'Ir a tu área' : 'Empezar gratis';

  return (
    <section className="relative overflow-hidden bg-slate-50 py-20 transition-colors dark:bg-[#0a0a18] lg:py-28">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-20 w-px -translate-x-1/2 opacity-30"
        style={{ background: 'linear-gradient(to bottom, transparent, #f97316)' }}
      />

      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-400">Cómo funciona</p>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white lg:text-4xl">
            Tres movimientos. Y entrenas.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-400">
            De cero a la primera sesión generada por Pick en menos de cinco minutos.
          </p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          <div
            aria-hidden="true"
            className="absolute left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] top-7 hidden h-px opacity-20 md:block"
            style={{ background: 'linear-gradient(90deg, #f97316, #3b82f6, #8b5cf6)' }}
          />

          {STEPS.map((step, index) => (
            <Step key={step.n} s={step} delay={index * 140} reduced={reduced} />
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <Link
            to={ctaTo}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-[#0a0a18]"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
          >
            {ctaLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-500">100% gratuito · Sin tarjeta · Privado por equipo</p>
        </div>
      </div>
    </section>
  );
}

function SceneSignup({ reduced }) {
  const providers = [
    { label: 'Google', bg: '#FFFFFF', color: '#0F172A', border: 'rgba(148,163,184,0.4)', glyph: 'G' },
    { label: 'Apple', bg: '#0F172A', color: '#FFFFFF', border: 'rgba(15,23,42,0.4)', glyph: '' },
    { label: 'Email', bg: 'rgba(249,115,22,0.10)', color: '#C2410C', border: 'rgba(249,115,22,0.32)', glyph: '@' },
  ];
  return (
    <div className="flex flex-col gap-2 px-1">
      {providers.map((provider, idx) => (
        <div
          key={provider.label}
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            background: provider.bg,
            color: provider.color,
            border: `1px solid ${provider.border}`,
            animation: reduced ? 'none' : `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${idx * 120}ms backwards`,
          }}
        >
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[12px] font-extrabold"
            style={{ background: 'rgba(15,23,42,0.06)' }}
            aria-hidden="true"
          >
            {provider.glyph}
          </span>
          <span className="text-[12px] font-semibold">Continuar con {provider.label}</span>
        </div>
      ))}
    </div>
  );
}

function SceneImport({ reduced }) {
  return (
    <div className="relative flex h-full flex-col gap-2 px-1">
      <div
        className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 dark:bg-[#0e0e20]"
        style={{
          borderColor: 'rgba(34,197,94,0.32)',
          animation: reduced ? 'none' : 'fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0ms backwards',
        }}
      >
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#15803D' }}
        >
          <FileSpreadsheet size={13} />
        </span>
        <span className="flex-1 truncate text-[11.5px] font-semibold text-slate-800 dark:text-slate-200">
          Cuadrante_Cadete_2025-26.xlsx
        </span>
        <span className="font-mono text-[10px] font-bold text-emerald-600">128 filas</span>
      </div>
      <div
        className="grid grid-cols-7 gap-0.5 rounded-lg p-1"
        style={{
          background: 'rgba(148,163,184,0.08)',
          border: '1px solid rgba(148,163,184,0.18)',
          animation: reduced ? 'none' : 'fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 240ms backwards',
        }}
      >
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((dayLabel, idx) => {
          const colored = idx === 5 ? '#F43F5E' : idx === 4 ? '#1A6FD4' : idx === 1 || idx === 3 ? '#1A6FD4' : null;
          return (
            <div key={dayLabel} className="flex flex-col items-center gap-0.5">
              <span className="text-[8px] font-semibold uppercase text-slate-500 dark:text-slate-400">{dayLabel}</span>
              <span
                className="h-3 w-full rounded"
                style={{ background: colored || 'rgba(148,163,184,0.18)' }}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScenePick({ reduced }) {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex justify-end">
        <span
          className="max-w-[88%] truncate rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium text-white"
          style={{
            background: '#1A6FD4',
            borderRadius: '10px 10px 2px 10px',
            animation: reduced ? 'none' : 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0ms backwards',
          }}
        >
          Pick, scoutea al rival del sábado
        </span>
      </div>
      <div className="flex items-end gap-1.5">
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
        >
          P
        </span>
        <span
          className="inline-flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium"
          style={{
            background: '#F1F5F9',
            color: '#0F172A',
            borderRadius: '10px 10px 10px 2px',
            animation: reduced ? 'none' : 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 220ms backwards',
          }}
        >
          <Send size={10} className="shrink-0 text-slate-400" aria-hidden="true" />
          Buscando partidos del rival…
        </span>
      </div>
    </div>
  );
}
