/**
 * Convocatorias pendientes on-demand (sub-A.4a, sin cache).
 *
 * Lógica portada de `src/utils/convocatoriaPendientes.js` con dos
 * diferencias para el backend:
 *
 * 1. Trabaja sobre raw session docs (con `convocatoriaSentAt`, `esLocal`,
 *    etc.) ya leídos por el orquestador del digest.
 * 2. Devuelve una shape plana (sessionId, teamId, severity, hoursUntil)
 *    en vez de embeber session+team — el LLM no necesita el detalle.
 *
 * Cache de cómputo (sub-A.4b) será un follow-up. Hoy esto se computa
 * cada turno; coste marginal porque los sessions ya están leídos.
 */

export interface PendingConvocatoria {
  sessionId: string;
  fecha: string;
  horaInicio?: string;
  teamId?: string;
  teamName?: string;
  rival?: string;
  /** "high" cuando faltan <24h, "normal" si dentro de la ventana del team. */
  severity: "high" | "normal";
  /** Horas hasta el partido (snapshot al momento del compute). */
  hoursUntil: number;
}

const DEFAULT_REMINDER_HOURS = 72;

/**
 * Sessions que califican: tipo ∈ {partido, playoff}, fecha futura,
 * convocatoriaSentAt todavía no marcado, y dentro de la ventana
 * `convocatoriaReminderHours` del team (default 72h).
 */
export function buildPendingConvocatorias(deps: {
  sessions: Array<{
    id: string;
    fecha?: string;
    horaInicio?: string;
    tipo?: string;
    teamId?: string;
    teamName?: string;
    rival?: string;
    convocatoriaSentAt?: unknown;
  }>;
  reminderHoursByTeam: Map<string, number>;
  now: Date;
}): PendingConvocatoria[] {
  const result: PendingConvocatoria[] = [];
  const nowMs = deps.now.getTime();

  for (const s of deps.sessions) {
    if (!s.fecha) continue;
    if (s.tipo !== "partido" && s.tipo !== "playoff") continue;
    if (s.convocatoriaSentAt) continue;

    const startMs = parseSessionStart(s.fecha, s.horaInicio);
    if (startMs === null || startMs <= nowMs) continue;

    const hoursUntil = (startMs - nowMs) / 3600000;
    const window = (s.teamId && deps.reminderHoursByTeam.get(s.teamId)) || DEFAULT_REMINDER_HOURS;
    if (hoursUntil > window) continue;

    result.push({
      sessionId: s.id,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      teamId: s.teamId,
      teamName: s.teamName,
      rival: s.rival,
      severity: hoursUntil < 24 ? "high" : "normal",
      hoursUntil: Math.round(hoursUntil * 10) / 10,
    });
  }

  return result.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return a.hoursUntil - b.hoursUntil;
  });
}

function parseSessionStart(fecha: string, horaInicio?: string): number | null {
  const [Y, M, D] = fecha.split("-").map(Number);
  if (!Y || !M || !D) return null;
  const [h, m] = (horaInicio || "00:00").split(":").map(Number);
  return new Date(Y, M - 1, D, h || 0, m || 0).getTime();
}
