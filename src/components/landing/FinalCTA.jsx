import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePublicTheme } from '../../hooks/usePublicTheme';

export default function FinalCTA() {
  const { user } = useAuth();
  const { theme } = usePublicTheme();
  const darkTheme = theme === 'dark';

  return (
    <section
      className="relative overflow-hidden py-24 transition-colors lg:py-32"
      style={{
        background: darkTheme
          ? 'linear-gradient(135deg, #0e0e20 0%, #111128 100%)'
          : 'linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%)',
      }}
    >
      {darkTheme ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="h-[400px] w-[700px] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(ellipse, rgba(249,115,22,.18) 0%, transparent 70%)' }}
          />
        </div>
      ) : null}

      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
          <Sparkles size={13} className="text-orange-400" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-300">
            100% gratuito
          </span>
        </div>

        <h2 className="mb-5 text-3xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
          Empieza a entrenar
          <br />
          con tu copiloto hoy
        </h2>
        <p className="mb-10 text-lg text-slate-600 dark:text-slate-400">
          Sin tarjeta. Sin compromiso. Gratis para entrenadores.
        </p>

        <Link
          to={user ? '/area-privada' : '/login'}
          className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-bold text-white shadow-xl transition-all hover:scale-[1.03] active:scale-100"
          style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
        >
          {user ? 'Ir a tu área privada' : 'Empezar gratis'}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
