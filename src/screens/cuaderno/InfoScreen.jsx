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

export default function InfoScreen() {
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
          <div className="flex justify-between items-start mb-6">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-xl tracking-wider uppercase underline decoration-2 underline-offset-4 mb-2">
                {clubName}
              </h1>
              <h2 className="font-bold text-3xl tracking-wide">El cuaderno.</h2>
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2">
              <p>Temporada {temporada}</p>
            </div>
          </div>

          {/* Cuerpo del Texto */}
          <div className="text-[14.5px] leading-relaxed text-justify text-gray-900 space-y-4 pr-4">
            <p>El cuaderno es de uso obligatorio para las sesiones.</p>

            <p>Tenemos escrito bien grande en qué queremos que se apoye nuestra idea de baloncesto:</p>

            <ul className="pl-6 space-y-4">
              <li className="flex">
                <span className="mr-3">-</span>
                <div>
                  <span className="font-bold">Actitud, Disciplina y Equipo</span> son los 3 pilares de nuestra
                  filosofía.
                  <ul className="pl-6 mt-1 space-y-1">
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span>Actitud.- Premiaremos esta frente a la aptitud de algunos que no se esfuerzan.</span>
                    </li>
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span>Disciplina.- El entrenador debe conseguir que se funcione como él quiere.</span>
                    </li>
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span>Equipo.- Siempre pensando en el equipo antes que en lo individual.</span>
                    </li>
                  </ul>
                </div>
              </li>

              <li className="flex">
                <span className="mr-3">-</span>
                <div>
                  <span className="font-bold">Tiro-Mecánica, Rebote Def-of y Posición Básica</span> son los 3 detalles
                  técnicos en los que tenemos que incidir y no podemos hacer mal.
                  <ul className="pl-6 mt-1 space-y-1">
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span>Tiro.- Especialmente trabajo de asimilar buena mecánica. La eficacia viene sola.</span>
                    </li>
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span>Rebote.- Especialmente defensivo, pero si no trabajamos el ofensivo...</span>
                    </li>
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span>Posición básica.- En todas las situaciones de recepción, de ayuda, etc...</span>
                    </li>
                  </ul>
                </div>
              </li>

              <li className="flex">
                <span className="mr-3">-</span>
                <div>
                  <span className="font-bold">Intensidad, Defensa y Correr</span> son las señas de identidad de nuestra
                  forma de juego.
                  <ul className="pl-6 mt-1 space-y-1">
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span className="font-bold">
                        Intensidad.- Física y Mental. No se puede estar en pista si no es al 100%.
                      </span>
                    </li>
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span>Defensa.- Agresividad y colocación. Defender para correr. Defensa más de equipo.</span>
                    </li>
                    <li className="flex">
                      <span className="mr-2">o</span>
                      <span>Correr.- Si defendemos y Cerramos bien el rebote, aseguramos poder correr.</span>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>

            <p>La hoja de normas para que lo tengamos presente.</p>

            <p>Una hoja de equipo para tener a mano los datos más importantes de vuestros/as jugadores/as.</p>

            <p>
              Un plan anual en A3 por si a alguno le sirve para organizarse la distribución de tareas o los objetivos de
              las sesiones.
            </p>

            <p>
              Las tablas de Test de tiro o de Dominio de balón van encaminadas a hacer un test mensual. Hasta infantil,
              Test de dominio. De cadete para arriba, Test de tiro.
            </p>

            <ul className="pl-12 space-y-1">
              <li className="flex">
                <span className="mr-3">-</span>
                <span>
                  El test de Dominio se hará sobre 4 ejercicios siempre iguales y sobre 30 segundos de ejecución.
                </span>
              </li>
              <li className="flex">
                <span className="mr-3">-</span>
                <span>
                  El test de tiro se hará sobre 4 ejercicios de tiro siempre los mismos. La anotación puede ser del
                  Resultado (metidas) o de la ejecución (si mecánicamente están bien realizados) o Mixto (anotados con
                  buena mecánica, si no, no cuenta).
                </span>
              </li>
            </ul>

            <p>
              Los campos son para poder llevar un registro de ciertos ejercicios o en mayores llevar los movimientos que
              se van introduciendo en el juego a nivel táctico.
            </p>

            <p>Una hoja para anotar los jugadores y jugadoras interesantes de equipos de nuestro entorno.</p>

            <p>2 hojas para anotaciones.</p>

            <p>Las hojas de entrenamientos. Importante:</p>

            <ul className="pl-12 space-y-1">
              <li className="flex">
                <span className="mr-3">-</span>
                <span>
                  Anotad las faltas y retrasos para luego pasarlo a la hoja de asistencia de Excel que os enviaré.
                </span>
              </li>
              <li className="flex">
                <span className="mr-3">-</span>
                <span>Anotad el número de entrenamiento.</span>
              </li>
              <li className="flex">
                <span className="mr-3">-</span>
                <span>
                  El apartado Observaciones es para poder escribir aquellas cosas de relevancia que se hablen entre
                  entrenador y Director Técnico.
                </span>
              </li>
            </ul>

            <p>
              Habrá que llevar preparados los entrenamientos para que se puedan observar por parte del Director Técnico.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
