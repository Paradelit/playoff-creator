import React from 'react';

const STEPS = [
  { n: '1', title: 'Crea tu cuenta', description: 'Regístrate gratis con Google, Apple o correo.' },
  { n: '2', title: 'Añade tu equipo', description: 'Configura categoría, jugadores y calendario en minutos.' },
  {
    n: '3',
    title: 'Deja que Pick te ayude',
    description: 'Pídele entrenamientos, cuadros, análisis. Lo hace contigo.',
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-slate-50 py-20 lg:py-28">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-16">Empieza en 3 pasos</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 text-white text-2xl font-bold rounded-full flex items-center justify-center">
                {s.n}
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{s.title}</h3>
              <p className="text-slate-600">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
