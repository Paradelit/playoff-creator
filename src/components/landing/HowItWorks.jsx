import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const STEPS = [
  {
    n: '01',
    title: 'Crea tu cuenta',
    description: 'Regístrate gratis en segundos con Google, Apple o correo. Sin tarjeta.',
    color: '#f97316',
  },
  {
    n: '02',
    title: 'Añade tu equipo',
    description: 'Configura categoría, jugadores y calendario en minutos. Importa el cuadrante desde Excel.',
    color: '#3b82f6',
  },
  {
    n: '03',
    title: 'Deja que Pick te ayude',
    description: 'Pídele entrenamientos, cuadros, análisis, avisos. Lo hace contigo en lenguaje natural.',
    color: '#8b5cf6',
  },
];

function Step({ s, delay, reduced }) {
  const ref = useRef(null);

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
    <div ref={ref} className="hi-step relative flex flex-col items-center text-center">
      <div
        className="mb-5 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black"
        style={{ background: `${s.color}20`, border: `1px solid ${s.color}40`, color: s.color }}
      >
        {s.n}
      </div>
      <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.description}</p>
    </div>
  );
}

export default function HowItWorks() {
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-slate-50 py-20 transition-colors dark:bg-[#0a0a18] lg:py-28">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-20 w-px -translate-x-1/2 opacity-30"
        style={{ background: 'linear-gradient(to bottom, transparent, #f97316)' }}
      />

      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-400">Cómo funciona</p>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white lg:text-4xl">Empieza en 3 pasos</h2>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          <div
            aria-hidden="true"
            className="absolute left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] top-8 hidden h-px opacity-20 md:block"
            style={{ background: 'linear-gradient(90deg, #f97316, #3b82f6, #8b5cf6)' }}
          />

          {STEPS.map((step, index) => (
            <Step key={step.n} s={step} delay={index * 120} reduced={reduced} />
          ))}
        </div>
      </div>
    </section>
  );
}
