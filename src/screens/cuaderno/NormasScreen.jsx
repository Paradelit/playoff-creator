import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import ClubLogo from '../../components/ClubLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { subscribeToProfile } from '../../services/settingsService';

function getTemporada() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export default function NormasScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [profile, setProfile] = useState({});

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToProfile(user.uid, db, appId, setProfile);
  }, [user, db, appId]);

  const clubName = profile.nombreClub || 'Uros de Rivas';
  const temporada = getTemporada();

  return (
    <div className="min-h-screen bg-gray-200 py-8 px-4 font-serif text-black print:bg-white print:p-0">

      {/* Toolbar */}
      <div className="max-w-[800px] mx-auto mb-4 flex items-center justify-between print:hidden font-sans">
        <button
          onClick={() => navigate(`/teams/${teamId}/cuaderno`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Cuaderno
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg shadow transition text-sm"
        >
          <Printer className="w-4 h-4 mr-2" /> Imprimir A4
        </button>
      </div>

      {/* Documento A4 */}
      <div className="max-w-[800px] mx-auto bg-white border border-gray-400 p-12 shadow-xl print:shadow-none print:border-none print:m-0 print:p-8 min-h-[297mm] relative overflow-hidden">

        {/* Marca de agua */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
          <span className="text-[250px] font-black text-gray-100 uppercase tracking-tighter transform -rotate-12 opacity-50 select-none font-sans">
            {clubName.split(' ')[0]}
          </span>
        </div>

        <div className="relative z-10">

          {/* Cabecera */}
          <div className="flex justify-between items-start mb-8">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-xl tracking-wider uppercase underline decoration-2 underline-offset-4 mb-4">
                {clubName}
              </h1>
              <h2 className="font-bold text-2xl tracking-widest uppercase">
                NORMAS
              </h2>
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2">
              <p>Temporada {temporada}</p>
            </div>
          </div>

          {/* Lista de normas */}
          <div className="text-[14px] leading-[1.8] text-gray-900 pr-4">
            <ul className="space-y-1">
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Llegar 15' antes del entreno, para preparar el material.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Control del material. Balones controlados (utilizad los carros).</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Sed puntuales con los comienzos y finales de los entrenamientos.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Sed rigurosos con aquellos/as que llegan tarde o faltan a entrenar.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0"></span><span>Anotad la asistencia todos los días.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>No permitáis que boten cuando se explica.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>No hablar, ni permitir que los jugadores/as lo hagan, sobre todo con gente ajena al entrenamiento.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>La mejor aliada para hacer un equipo es la "DISCIPLINA".</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>No usar, ni permitir usar teléfonos móviles.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Los entrenamientos duros, gustan a los jugadores/as. <span className="font-bold">INTENSIDAD.</span></span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Exigid también concentración. No dispersión.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Máximo tiempo de trabajo. Que no estén parados en largas filas.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Buscad equilibrio entre esfuerzo y tiempo de juego en partido. Premiad la Actitud.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Cuando falten o vayan a llegar tarde, que os llamen los jugadores/as.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span className="font-bold">CUIDAD EL MATERIAL Y LAS INSTALACIONES.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>A partir de Infantil, animad a ducharse después de entrenar y sobretodo de partidos.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Preparad los entrenos con tiempo. No improvisar.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>El entrenador es la autoridad en la pista.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Preocuparse de las personas que hay tras los jugadores/as.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span className="underline decoration-1 underline-offset-2">Venir a ver partidos de otros equipos con vuestros jugadores/as.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Venimos en chándal a los entrenamientos y de calle a los partidos.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Realizad estiramientos antes y después de los entrenos y partidos.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>No se permiten las protestas arbitrales. Banquillo automático (según reglamento).</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Respeto al rival, a los compañeros y al público.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Pedid una fotocopia de las notas en cada evaluación.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Haced muchos ejercicios de tiro. Primero conseguir buena mecánica.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span className="font-bold">NUESTRO INTERES MAYOR ES QUE MEJOREN. CORREGID.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Sed exigentes con las pautas de imagen y de ausencias para ser justos en los partidos.</span></li>
              <li className="flex items-start"><span className="w-12 text-center flex-shrink-0">•</span><span>Llevad siempre (entrenos también) las licencias por si hubiera algún accidente.</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
