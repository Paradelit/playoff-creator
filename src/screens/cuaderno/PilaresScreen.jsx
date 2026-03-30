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

const PAGINAS_VALORES = [
  ['ACTITUD', 'DISCIPLINA', 'EQUIPO'],
  ['TIRO-MECÁNICA', 'REBOTE DEF-of', 'POSICIÓN BÁSICA'],
  ['INTENSIDAD', 'DEFENSA', 'CORRER'],
  ['VISIÓN MARGINAL', 'DECISIÓN', 'ANTICIPACIÓN'],
];

export default function PilaresScreen() {
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
    <div className="min-h-screen bg-gray-200 py-8 px-4 font-serif text-black print:bg-white print:p-0 flex flex-col items-center gap-8 print:block">

      {/* Toolbar */}
      <div className="w-full max-w-[800px] flex items-center justify-between print:hidden font-sans">
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
          <Printer className="w-4 h-4 mr-2" /> Imprimir 4 Páginas
        </button>
      </div>

      {/* 4 páginas A4 */}
      {PAGINAS_VALORES.map((pagina, index) => (
        <div
          key={index}
          className="w-full max-w-[800px] bg-white border border-gray-400 p-8 sm:p-12 shadow-xl print:shadow-none print:border-none print:m-0 print:p-8 min-h-[297mm] flex flex-col relative overflow-hidden print:break-after-page break-inside-avoid"
        >
          {/* Cabecera */}
          <div className="flex justify-between items-start mb-12 flex-shrink-0">
            <div className="w-1/4">
              <ClubLogo logoUrl={profile.logoClub} />
            </div>
            <div className="w-1/2 text-center pt-2">
              <h1 className="font-bold text-xl tracking-wider uppercase underline decoration-2 underline-offset-4">
                {clubName}
              </h1>
            </div>
            <div className="w-1/4 text-right text-sm text-gray-600 flex flex-col items-end pt-2">
              <p>Temporada {temporada}</p>
            </div>
          </div>

          {/* Tres pilares */}
          <div className="flex-1 flex flex-col justify-between pt-4 pb-12">
            {pagina.map((pilar, i) => (
              <React.Fragment key={i}>
                <div className="flex-1 flex items-center justify-center w-full">
                  <h2
                    className="text-6xl sm:text-[100px] font-black font-sans uppercase tracking-tighter text-center leading-none text-gray-800"
                    style={{ transform: 'scaleY(1.5)', transformOrigin: 'center' }}
                  >
                    {pilar}
                  </h2>
                </div>
                {i < 2 && <hr className="border-t border-gray-300 w-[90%] mx-auto" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
