const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export interface CompetitionShape {
  id: string;
  nombre: string;
  fases: Array<{ id: string; nombre: string; jornadas: number }>;
}

export interface SessionShape {
  tipo: 'partido' | 'playoff' | 'entrenamiento';
  fecha?: string;
  horaInicio?: string;
  horaCita?: string;
  rival?: string;
  lugar?: string;
  lugarMapsUrl?: string;
  esLocal?: boolean;
  competitionId?: string | null;
  faseId?: string | null;
  jornadaNumero?: number | null;
  notaExtra?: string;
  matchTitle?: string;
  gameIndex?: number;
}

export interface TeamShape {
  id: string;
  citaOffsetMinutos?: number;
  plantillaConvocatoria?: string;
  categoria?: string;
}

function ymdToLocalDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(target: Date, now: Date) {
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t.getTime() - n.getTime()) / 86400000);
}

function fechaRelativa(ymd: string, now: Date) {
  const t = ymdToLocalDate(ymd);
  const d = diffDays(t, now);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d >= 2 && d <= 6) return `el ${DIAS_SEMANA[t.getDay()]}`;
  return `el ${t.getDate()} de ${MESES[t.getMonth()]}`;
}

function saludoFromHour(h: number) {
  if (h >= 18) return 'Buenas noches';
  if (h >= 14) return 'Buenas tardes';
  return 'Buenos días';
}

function vueltaSuffix(fase: CompetitionShape['fases'][number] | undefined, jornadaNumero: number) {
  if (!fase || !Number.isFinite(fase.jornadas)) return '';
  if (fase.jornadas % 2 !== 0) return '';
  const half = Math.floor(fase.jornadas / 2);
  return jornadaNumero <= half ? ' (1ª vuelta)' : ' (2ª vuelta)';
}

function generarEncabezado(session: SessionShape, competition: CompetitionShape | null) {
  const rival = session?.rival || 'Rival';
  if (session?.tipo === 'playoff') {
    const matchTitle = session.matchTitle || 'Eliminatoria';
    const game = (session.gameIndex || 0) + 1;
    return `*Playoffs ${matchTitle}*\n_Jornada ${game} vs ${rival}_`;
  }
  if (!session?.competitionId || !competition) return `*Amistoso*\n_vs ${rival}_`;
  const fase = competition.fases.find((f) => f.id === session.faseId);
  if (!fase) return `*${competition.nombre}*\n_vs ${rival}_`;
  const vuelta = vueltaSuffix(fase, session.jornadaNumero || 0);
  return `*${competition.nombre} — ${fase.nombre}${vuelta}*\n_Jornada ${session.jornadaNumero} vs ${rival}_`;
}

function computeHoraCita(horaInicio: string | undefined, offsetMin: number) {
  if (!horaInicio) return '';
  const [h, m] = horaInicio.split(':').map(Number);
  const total = h * 60 + m - offsetMin;
  if (total < 0) return '';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

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
].join('\n');

export interface RenderInput {
  session: SessionShape;
  team: TeamShape | null;
  competition: CompetitionShape | null;
  now?: Date;
}

export interface RenderOutput {
  mensaje: string;
  encabezado: string;
}

export function renderConvocatoria({ session, team, competition, now }: RenderInput): RenderOutput {
  const N = now || new Date();
  const offset = team?.citaOffsetMinutos ?? 45;
  const horaCita = session.horaCita || computeHoraCita(session.horaInicio, offset);
  const isLocal = !!session.esLocal;
  const fechaRel = session.fecha ? fechaRelativa(session.fecha, N) : '';
  const variables: Record<string, string> = {
    saludo: saludoFromHour(N.getHours()),
    ENCABEZADO: generarEncabezado(session, competition),
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
  const template = (team?.plantillaConvocatoria && team.plantillaConvocatoria.trim()) || DEFAULT_TEMPLATE;
  const lines = template.split('\n').filter((line) => {
    const vars = line.match(/\{([A-Za-z]+)\}/g) || [];
    if (vars.length === 0) return true;
    return !vars.every((v) => !variables[v.slice(1, -1)]);
  });
  const mensaje = lines
    .map((l) => l.replace(/\{([A-Za-z]+)\}/g, (_m, n) => variables[n] ?? ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { mensaje, encabezado: variables.ENCABEZADO };
}
