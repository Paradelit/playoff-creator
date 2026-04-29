import { generarEncabezado } from './convocatoriaEncabezado';
import { saludoFromHour, fechaRelativa } from './convocatoriaDates';

export const DEFAULT_TEMPLATE = [
  '{saludo}.',
  '',
  '{ENCABEZADO}',
  '',
  'Jugamos {fechaRelativa} a las {horaInicio} en {lugar}{lugarUrlSiVisitante}.',
  '',
  'Quedamos {citaSiVisitante} a las {horaCita}.',
  '',
  '{notaExtra}',
  '',
  'Nos vemos {fechaRelativaNosVemos}!',
  '🏀💪🏻',
].join('\n');

const VAR_NAMES = [
  'saludo',
  'ENCABEZADO',
  'rival',
  'fechaRelativa',
  'horaInicio',
  'horaCita',
  'lugar',
  'lugarUrlSiVisitante',
  'citaSiVisitante',
  'notaExtra',
  'fechaRelativaNosVemos',
];

function computeHoraCita(horaInicio, offsetMin) {
  if (!horaInicio || !Number.isFinite(offsetMin)) return '';
  const [h, m] = horaInicio.split(':').map(Number);
  const total = h * 60 + m - offsetMin;
  if (total < 0) return '';
  const fh = String(Math.floor(total / 60)).padStart(2, '0');
  const fm = String(total % 60).padStart(2, '0');
  return `${fh}:${fm}`;
}

function buildVariables({ session, team, competition, now }) {
  const offset = team?.citaOffsetMinutos ?? 45;
  const horaCita = session.horaCita || computeHoraCita(session.horaInicio, offset);
  const isLocal = !!session.esLocal;
  const fechaRel = fechaRelativa(session.fecha, now);

  return {
    saludo: saludoFromHour(now.getHours()),
    ENCABEZADO: generarEncabezado({ session, competition }),
    rival: session.rival || '',
    fechaRelativa: fechaRel,
    horaInicio: session.horaInicio || '',
    horaCita,
    lugar: session.lugar || '',
    lugarUrlSiVisitante: !isLocal && session.lugarMapsUrl ? ` ${session.lugarMapsUrl}` : '',
    citaSiVisitante: isLocal ? 'en el pabellón' : 'allí',
    notaExtra: session.notaExtra || '',
    fechaRelativaNosVemos: fechaRel,
  };
}

function lineHasOnlyEmptyVars(line, variables) {
  const vars = line.match(/\{([A-Za-z]+)\}/g) || [];
  if (vars.length === 0) return false;
  return vars.every((v) => {
    const name = v.slice(1, -1);
    return !variables[name];
  });
}

function applyVars(line, variables) {
  return line.replace(/\{([A-Za-z]+)\}/g, (_m, name) => variables[name] ?? '');
}

export function renderConvocatoria({ session, team, competition, now }) {
  const variables = buildVariables({ session, team, competition, now: now || new Date() });
  const template = (team?.plantillaConvocatoria && team.plantillaConvocatoria.trim()) || DEFAULT_TEMPLATE;

  const lines = template.split('\n').filter((line) => !lineHasOnlyEmptyVars(line, variables));
  const mensaje = lines
    .map((l) => applyVars(l, variables))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { mensaje, encabezado: variables.ENCABEZADO, variables, variableNames: VAR_NAMES };
}

export const VARIABLE_LABELS = {
  saludo: 'Saludo del momento del día',
  ENCABEZADO: 'Cabecera (Liga / Playoff / Amistoso)',
  rival: 'Nombre del rival',
  fechaRelativa: 'Fecha relativa del partido',
  horaInicio: 'Hora de inicio del partido',
  horaCita: 'Hora de cita',
  lugar: 'Lugar (nombre del pabellón)',
  lugarUrlSiVisitante: 'URL de Maps (solo si visitante)',
  citaSiVisitante: '"allí" / "en el pabellón"',
  notaExtra: 'Nota extra del partido',
  fechaRelativaNosVemos: 'Fecha relativa (cierre)',
};
