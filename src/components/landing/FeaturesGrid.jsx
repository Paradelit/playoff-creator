import React from 'react';
import { Bot, Trophy, Calendar, NotebookPen, BookOpen, Search } from 'lucide-react';

const FEATURES = [
  {
    icon: Bot,
    title: 'Pick, tu copiloto IA',
    description:
      'Pide cualquier cosa y la hace: crea un entrenamiento, importa el cuadrante, sugiere ejercicios. Con contexto de tu equipo y tu calendario.',
  },
  {
    icon: Trophy,
    title: 'Cuadros de playoffs con IA',
    description: 'Sube las bases y la clasificación. El cuadro se genera solo, incluyendo BYE y series BO1/BO3.',
  },
  {
    icon: Calendar,
    title: 'Calendario y entrenamientos',
    description: 'Importa tu cuadrante desde Excel. Genera entrenamientos completos con IA. Ajusta al vuelo.',
  },
  {
    icon: NotebookPen,
    title: 'Cuaderno del entrenador',
    description: 'Informes de jugadores, notas, pilares, normas, test de tiro. Privado por equipo.',
  },
  {
    icon: BookOpen,
    title: 'Biblioteca de ejercicios',
    description: 'Crea, etiqueta, reutiliza. Compartible con otros entrenadores.',
  },
  {
    icon: Search,
    title: 'Scouting y análisis',
    description: 'Prepara partido, analiza el jugado, con la IA ayudando a extraer lo que importa.',
  },
];

export default function FeaturesGrid() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Todo lo que necesitas para entrenar mejor
          </h2>
          <p className="text-lg text-slate-600">
            Pensado para entrenadores de baloncesto federado, de minibasket a sénior. Pronto, también para clubes.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-6 lg:p-8 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-white hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-4">
                  <Icon size={24} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
