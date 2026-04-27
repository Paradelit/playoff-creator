import React, { useEffect, useRef } from 'react';
import { Bot, Trophy, Calendar, NotebookPen, BookOpen, Search } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePublicTheme } from '../../hooks/usePublicTheme';
import PickChatScene from './featureMicroscenes/PickChatScene';
import PlayoffsBracketScene from './featureMicroscenes/PlayoffsBracketScene';
import CalendarBlocksScene from './featureMicroscenes/CalendarBlocksScene';
import NotebookNotesScene from './featureMicroscenes/NotebookNotesScene';
import ExerciseLibraryScene from './featureMicroscenes/ExerciseLibraryScene';
import ScoutingHeatmapScene from './featureMicroscenes/ScoutingHeatmapScene';

export const FEATURES = [
  {
    id: 'pick',
    icon: Bot,
    title: 'Pick, tu copiloto IA',
    description:
      'Pide cualquier cosa y la hace: crea un entrenamiento, importa el cuadrante, sugiere ejercicios. Tiene contexto completo de tu equipo y tu calendario.',
    accent: '#f97316',
    iconBg: 'rgba(249,115,22,.15)',
    iconColor: '#f97316',
    featured: true,
    Scene: PickChatScene,
  },
  {
    id: 'playoffs',
    icon: Trophy,
    title: 'Cuadros de playoffs',
    description: 'Sube las bases y la clasificacion. El cuadro se genera solo, con BYE y series BO1/BO3.',
    accent: '#f59e0b',
    iconBg: 'rgba(245,158,11,.15)',
    iconColor: '#f59e0b',
    Scene: PlayoffsBracketScene,
  },
  {
    id: 'calendar',
    icon: Calendar,
    title: 'Calendario IA',
    description: 'Importa tu cuadrante desde Excel. Genera entrenamientos completos con IA. Ajusta al vuelo.',
    accent: '#3b82f6',
    iconBg: 'rgba(59,130,246,.15)',
    iconColor: '#60a5fa',
    Scene: CalendarBlocksScene,
  },
  {
    id: 'notebook',
    icon: NotebookPen,
    title: 'Cuaderno del entrenador',
    description: 'Informes de jugadores, notas, pilares, normas, test de tiro. Privado por equipo.',
    accent: '#8b5cf6',
    iconBg: 'rgba(139,92,246,.15)',
    iconColor: '#a78bfa',
    Scene: NotebookNotesScene,
  },
  {
    id: 'library',
    icon: BookOpen,
    title: 'Biblioteca de ejercicios',
    description: 'Crea, etiqueta, reutiliza. Compartible con otros entrenadores.',
    accent: '#10b981',
    iconBg: 'rgba(16,185,129,.15)',
    iconColor: '#34d399',
    Scene: ExerciseLibraryScene,
  },
  {
    id: 'scouting',
    icon: Search,
    title: 'Scouting y analisis',
    description: 'Prepara partido, analiza el jugado. La IA extrae lo que importa.',
    accent: '#06b6d4',
    iconBg: 'rgba(6,182,212,.15)',
    iconColor: '#22d3ee',
    Scene: ScoutingHeatmapScene,
  },
];

function FeatureCard({ f, delay, reduced, theme }) {
  const ref = useRef(null);
  const Scene = f.Scene;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reduced) {
      el.classList.add('fg-visible');
      el.style.animation = 'none';
      el.style.opacity = '1';
      return undefined;
    }
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
  }, [delay, reduced]);

  const darkTheme = theme === 'dark';
  const baseBorder = darkTheme ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(148,163,184,.22)';
  const cardBackground = darkTheme
    ? 'linear-gradient(145deg, #111128, #0e0e1e)'
    : 'linear-gradient(180deg, #f8fafc, #ffffff)';
  const sceneBackground = darkTheme ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.72)';

  return (
    <div
      ref={ref}
      className="fg-card group relative cursor-default rounded-2xl p-6 transition-transform duration-300 hover:scale-[1.02] lg:p-7"
      style={{
        background: cardBackground,
        border: baseBorder,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = '1px solid ' + f.accent + '55';
        e.currentTarget.style.boxShadow = '0 0 32px 0 ' + f.accent + '22';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = baseBorder;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {f.featured && (
        <span
          className="absolute top-4 right-4 text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: darkTheme ? 'rgba(249,115,22,.2)' : 'rgba(249,115,22,.12)', color: '#f97316' }}
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
      <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">{f.title}</h3>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.description}</p>
      <div
        className="mt-5 overflow-hidden rounded-2xl border px-4 py-3"
        style={{
          background: sceneBackground,
          borderColor: darkTheme ? 'rgba(255,255,255,.08)' : 'rgba(148,163,184,.18)',
        }}
      >
        <Scene reduced={reduced} />
      </div>
    </div>
  );
}

export default function FeaturesGrid() {
  const reduced = useReducedMotion();
  const { theme } = usePublicTheme();

  return (
    <section className="bg-white py-20 transition-colors dark:bg-[#06060f] lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-14">
          <p className="text-xs font-bold tracking-widest text-orange-400 uppercase mb-3">Funcionalidades</p>
          <h2 className="mb-4 text-3xl font-extrabold leading-tight text-slate-900 dark:text-white lg:text-4xl">
            Todo lo que necesitas para entrenar mejor
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Pensado para entrenadores de baloncesto federado, de minibasket a senior.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.id} f={f} delay={i * 80} reduced={reduced} theme={theme} />
          ))}
        </div>
      </div>
    </section>
  );
}
