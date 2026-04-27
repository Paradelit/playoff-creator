import React, { useEffect, useRef } from 'react';
import { Bot, Trophy, Calendar, NotebookPen, BookOpen, Search } from 'lucide-react';

const STYLES = `
  @keyframes fg-slide { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  .fg-card { opacity:0; }
  .fg-card.fg-visible { animation: fg-slide .55s ease forwards; }
`;

const FEATURES = [
  {
    icon: Bot,
    title: 'Pick, tu copiloto IA',
    description:
      'Pide cualquier cosa y la hace: crea un entrenamiento, importa el cuadrante, sugiere ejercicios. Tiene contexto completo de tu equipo y tu calendario.',
    accent: '#f97316',
    iconBg: 'rgba(249,115,22,.15)',
    iconColor: '#f97316',
    featured: true,
  },
  {
    icon: Trophy,
    title: 'Cuadros de playoffs',
    description: 'Sube las bases y la clasificacion. El cuadro se genera solo, con BYE y series BO1/BO3.',
    accent: '#f59e0b',
    iconBg: 'rgba(245,158,11,.15)',
    iconColor: '#f59e0b',
  },
  {
    icon: Calendar,
    title: 'Calendario IA',
    description: 'Importa tu cuadrante desde Excel. Genera entrenamientos completos con IA. Ajusta al vuelo.',
    accent: '#3b82f6',
    iconBg: 'rgba(59,130,246,.15)',
    iconColor: '#60a5fa',
  },
  {
    icon: NotebookPen,
    title: 'Cuaderno del entrenador',
    description: 'Informes de jugadores, notas, pilares, normas, test de tiro. Privado por equipo.',
    accent: '#8b5cf6',
    iconBg: 'rgba(139,92,246,.15)',
    iconColor: '#a78bfa',
  },
  {
    icon: BookOpen,
    title: 'Biblioteca de ejercicios',
    description: 'Crea, etiqueta, reutiliza. Compartible con otros entrenadores.',
    accent: '#10b981',
    iconBg: 'rgba(16,185,129,.15)',
    iconColor: '#34d399',
  },
  {
    icon: Search,
    title: 'Scouting y analisis',
    description: 'Prepara partido, analiza el jugado. La IA extrae lo que importa.',
    accent: '#06b6d4',
    iconBg: 'rgba(6,182,212,.15)',
    iconColor: '#22d3ee',
  },
];

function FeatureCard({ f, delay }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.style.animationDelay = delay + 'ms';
        el.classList.add('fg-visible');
        obs.disconnect();
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className="fg-card group relative rounded-2xl p-6 lg:p-7 cursor-default transition-transform duration-300 hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(145deg, #111128, #0e0e1e)',
        border: '1px solid rgba(255,255,255,.07)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = '1px solid ' + f.accent + '55';
        e.currentTarget.style.boxShadow = '0 0 32px 0 ' + f.accent + '22';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = '1px solid rgba(255,255,255,.07)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {f.featured && (
        <span
          className="absolute top-4 right-4 text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(249,115,22,.2)', color: '#f97316' }}
        >
          IA
        </span>
      )}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 shrink-0"
        style={{ background: f.iconBg }}
      >
        <f.icon size={22} style={{ color: f.iconColor }} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
    </div>
  );
}

export default function FeaturesGrid() {
  return (
    <>
      <style>{STYLES}</style>
      <section
        className="py-20 lg:py-28"
        style={{ background: 'linear-gradient(180deg, #06060f 0%, #0a0a18 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-bold tracking-widest text-orange-400 uppercase mb-3">Funcionalidades</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4 leading-tight">
              Todo lo que necesitas para entrenar mejor
            </h2>
            <p className="text-slate-400 text-lg">
              Pensado para entrenadores de baloncesto federado, de minibasket a senior.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} f={f} delay={i * 80} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
