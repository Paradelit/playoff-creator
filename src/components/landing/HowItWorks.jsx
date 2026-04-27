import React from 'react';

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

export default function HowItWorks() {
  return (
    <section
      className="py-20 lg:py-28 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a0a18 0%, #06060f 100%)' }}
    >
      {/* Divider line */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-20 opacity-30"
        style={{ background: 'linear-gradient(to bottom, transparent, #f97316)' }}
      />

      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-widest text-orange-400 uppercase mb-3">Cómo funciona</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white">Empieza en 3 pasos</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line between steps (desktop) */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px opacity-20"
            style={{ background: 'linear-gradient(90deg, #f97316, #3b82f6, #8b5cf6)' }}
          />

          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col items-center text-center relative">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black mb-5 shrink-0"
                style={{ background: `${s.color}20`, border: `1px solid ${s.color}40`, color: s.color }}
              >
                {s.n}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
