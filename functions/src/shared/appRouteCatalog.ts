/**
 * Catálogo de destinos de navegación in-app para el Copilot.
 * Debe mantenerse alineado con AppRouter.jsx y ScreenContextProvider.
 */

export type NavigationTargetId =
  | "home"
  | "teams"
  | "team_detail"
  | "team_trainings"
  | "training_editor"
  | "calendar"
  | "session_scouting"
  | "session_analysis"
  | "session_planilla"
  | "playoffs"
  | "exercises"
  | "settings"
  | "cuaderno"
  | "cuaderno_info"
  | "cuaderno_pilares"
  | "cuaderno_normas"
  | "cuaderno_test_tiro"
  | "cuaderno_jugadores"
  | "cuaderno_notas"
  | "cuaderno_informe_jugadores"
  | "cuaderno_asistencia"
  | "cuaderno_entrenamientos";

const ALL_TARGETS: NavigationTargetId[] = [
  "home",
  "teams",
  "team_detail",
  "team_trainings",
  "training_editor",
  "calendar",
  "session_scouting",
  "session_analysis",
  "session_planilla",
  "playoffs",
  "exercises",
  "settings",
  "cuaderno",
  "cuaderno_info",
  "cuaderno_pilares",
  "cuaderno_normas",
  "cuaderno_test_tiro",
  "cuaderno_jugadores",
  "cuaderno_notas",
  "cuaderno_informe_jugadores",
  "cuaderno_asistencia",
  "cuaderno_entrenamientos",
];

export function listNavigationTargetIds(): readonly NavigationTargetId[] {
  return ALL_TARGETS;
}

export interface NavigationIds {
  teamId?: string;
  trainingId?: string;
  sessionId?: string;
}

export type NavigationResolveResult =
  | { path: string; label: string }
  | { error: string };

function needTeam(id?: string): string | null {
  if (!id || !id.trim()) return "Falta teamId (o infiérelo desde la pantalla actual).";
  return null;
}

function needSession(id?: string): string | null {
  if (!id || !id.trim()) return "Falta sessionId (id del evento de calendario).";
  return null;
}

function needTraining(teamId?: string, trainingId?: string): string | null {
  const t = needTeam(teamId);
  if (t) return t;
  if (!trainingId?.trim()) return "Falta trainingId.";
  return null;
}

/**
 * Resuelve un destino lógico a path + etiqueta en español para el botón "Ir a…".
 */
export function resolveAppNavigation(
  targetRaw: string,
  ids: NavigationIds
): NavigationResolveResult {
  const target = targetRaw.trim() as NavigationTargetId;
  if (!ALL_TARGETS.includes(target)) {
    return { error: `Destino "${targetRaw}" no válido. Usa uno de los valores permitidos en la tool.` };
  }

  const { teamId, trainingId, sessionId } = ids;

  switch (target) {
    case "home":
      return { path: "/", label: "Ir a inicio" };
    case "teams":
      return { path: "/teams", label: "Ir a mis equipos" };
    case "team_detail": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}`, label: "Ir al equipo" };
    }
    case "team_trainings": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/trainings`, label: "Ir a entrenamientos del equipo" };
    }
    case "training_editor": {
      const err = needTraining(teamId, trainingId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/trainings/${trainingId}`, label: "Abrir editor de entrenamiento" };
    }
    case "calendar":
      return { path: "/calendar", label: "Ir al calendario" };
    case "session_scouting": {
      const err = needSession(sessionId);
      if (err) return { error: err };
      return { path: `/calendar/${sessionId}/scouting`, label: "Ir a scouting del partido" };
    }
    case "session_analysis": {
      const err = needSession(sessionId);
      if (err) return { error: err };
      return { path: `/calendar/${sessionId}/analysis`, label: "Ir al análisis del partido" };
    }
    case "session_planilla": {
      const err = needSession(sessionId);
      if (err) return { error: err };
      return { path: `/calendar/${sessionId}/planilla`, label: "Ir a la planilla de sextos" };
    }
    case "playoffs": {
      if (teamId?.trim()) {
        return { path: `/playoffs?teamId=${encodeURIComponent(teamId)}`, label: "Ir a torneos (playoffs)" };
      }
      return { path: "/playoffs", label: "Ir a torneos (playoffs)" };
    }
    case "exercises":
      return { path: "/exercises", label: "Ir a la biblioteca de ejercicios" };
    case "settings":
      return { path: "/settings", label: "Ir a ajustes" };
    case "cuaderno": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno`, label: "Ir al cuaderno del equipo" };
    }
    case "cuaderno_info": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/info`, label: "Ir a información del cuaderno" };
    }
    case "cuaderno_pilares": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/pilares`, label: "Ir a pilares" };
    }
    case "cuaderno_normas": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/normas`, label: "Ir a normas" };
    }
    case "cuaderno_test_tiro": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/test-tiro`, label: "Ir al test de tiro" };
    }
    case "cuaderno_jugadores": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/jugadores`, label: "Ir a jugadores" };
    }
    case "cuaderno_notas": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/notas`, label: "Ir a notas" };
    }
    case "cuaderno_informe_jugadores": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/informe-jugadores`, label: "Ir a informes de jugadores" };
    }
    case "cuaderno_asistencia": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/asistencia`, label: "Ir a asistencia" };
    }
    case "cuaderno_entrenamientos": {
      const err = needTeam(teamId);
      if (err) return { error: err };
      return { path: `/teams/${teamId}/cuaderno/entrenamientos`, label: "Ir a entrenamientos (cuaderno)" };
    }
    default:
      return { error: "Destino no soportado." };
  }
}
