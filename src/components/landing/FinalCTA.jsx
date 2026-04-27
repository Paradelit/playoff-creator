// src/components/landing/FinalCTA.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function FinalCTA() {
  const { user } = useAuth();
  return (
    <section
      className="relative overflow-hidden py-24 lg:py-32"
      style={{ background: 'linear-gradient(135deg, #0e0e20 0%, #111128 100%)' }}
    >
      {/* Radial glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="w-[700px] h-[400px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(ellipse, rgba(249,115,22,.18) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10">
          <Sparkles size={13} className="text-orange-400" aria-hidden="true" />
          <span className="text-xs font-bold tracking-widest text-orange-300 uppercase">100% gratuito</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-5 leading-tight">
          Empieza a entrenar
          <br />
          con tu copiloto hoy
        </h2>
        <p className="text-lg text-slate-400 mb-10">Sin tarjeta. Sin compromiso. Gratis para entrenadores.</p>

        <Link
          to={user ? '/area-privada' : '/login'}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-[1.03] active:scale-100 shadow-xl"
          style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff' }}
        >
          {user ? 'Ir a tu área privada' : 'Empezar gratis'}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
