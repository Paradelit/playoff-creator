import { teamDisplayName } from '../../utils/teamUtils';
import { fetchLogoAsDataUrl } from './exportUtils';

const COLUMNS = [
  { key: 'ranking', label: 'Ranking' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'compromiso', label: 'Compromiso' },
  { key: 'actitud', label: 'Actitud' },
  { key: 'aptitudes', label: 'Aptitudes' },
  { key: 'capAprender', label: 'Cap. Aprender' },
  { key: 'calidad', label: 'Calidad' },
  { key: 'tiro', label: 'Tiro' },
];

function asString(v) {
  return v == null ? '' : String(v);
}

export async function buildInformeData({ team, profile, rows, observaciones, temporada }) {
  const clubName = profile?.nombreClub || 'Uros de Rivas';
  const teamName = team ? teamDisplayName(team) : 'Equipo';
  const logoDataUrl = await fetchLogoAsDataUrl(profile?.logoClub);
  const title = `INFORME JUGADORES/AS ${temporada}`;
  const normalizedRows = (rows || []).map((row) => ({
    ranking: asString(row.ranking),
    nombre: asString(row.nombre),
    compromiso: asString(row.compromiso),
    actitud: asString(row.actitud),
    aptitudes: asString(row.aptitudes),
    capAprender: asString(row.capAprender),
    calidad: asString(row.calidad),
    tiro: asString(row.tiro),
  }));

  return {
    clubName,
    teamName,
    temporada,
    logoDataUrl,
    title,
    columns: COLUMNS,
    rows: normalizedRows,
    observaciones: asString(observaciones),
  };
}
