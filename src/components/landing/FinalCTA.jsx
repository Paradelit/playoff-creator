// src/components/landing/FinalCTA.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function FinalCTA() {
  const { user } = useAuth();
  return (
    <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-20 lg:py-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Empieza a entrenar con tu copiloto hoy</h2>
        <p className="text-lg text-blue-100 mb-8">Gratis para entrenadores. Sin tarjeta. Sin compromiso.</p>
        <Link
          to={user ? '/area-privada' : '/login'}
          className="inline-flex items-center justify-center px-8 py-4 bg-amber-400 text-blue-950 font-semibold rounded-xl hover:bg-amber-300 transition-colors shadow-lg text-lg"
        >
          {user ? 'Ir a tu área privada' : 'Empezar gratis'}
        </Link>
      </div>
    </section>
  );
}
