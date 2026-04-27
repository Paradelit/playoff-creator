import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function HeroSection() {
  const { user } = useAuth();

  return (
    <section className="relative bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Trophy size={32} className="text-amber-400" aria-hidden="true" />
              <span className="text-amber-400 font-semibold tracking-wide">Pick&amp;Coach</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Tu copiloto IA para entrenar baloncesto
            </h1>
            <p className="text-lg lg:text-xl text-blue-100 mb-8 leading-relaxed">
              Playoffs, entrenamientos, calendario y scouting. Todo en un sitio, con un copiloto IA que hace el trabajo
              contigo.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {user ? (
                <Link
                  to="/area-privada"
                  className="inline-flex items-center justify-center px-6 py-3 bg-amber-400 text-blue-950 font-semibold rounded-xl hover:bg-amber-300 transition-colors shadow-lg"
                >
                  Ir a tu área privada
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-6 py-3 bg-amber-400 text-blue-950 font-semibold rounded-xl hover:bg-amber-300 transition-colors shadow-lg"
                >
                  Empezar gratis
                </Link>
              )}
              <Link
                to="/ayuda"
                className="inline-flex items-center justify-center px-6 py-3 bg-white/10 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors"
              >
                Ver centro de ayuda
              </Link>
            </div>

            {user && (
              <p className="mt-4 text-sm text-blue-200">
                Sesión activa como <span className="font-medium">{user.email}</span>
              </p>
            )}
          </div>

          <div className="relative">
            {/* Placeholder hero visual — to be replaced with real screenshot of Pick chat. */}
            <div
              className="aspect-[4/3] bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-blue-200 text-sm"
              role="img"
              aria-label="Captura del copiloto Pick (pendiente)"
            >
              [Captura de Pick — pendiente]
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
