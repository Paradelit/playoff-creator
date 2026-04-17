import { useState, useEffect, useRef, useCallback } from 'react';

export type ProactivityMode = 'off' | 'suggestions' | 'nudges';

interface ScreenContext {
  screen: string;
  data?: Record<string, unknown>;
}

interface TipsOptions {
  proactivityMode?: ProactivityMode;
}

const TIPS_BY_SCREEN: Record<string, (data?: Record<string, unknown>) => string[]> = {
  home: (data) => {
    const tips: string[] = [];
    const events = (data?.todayEventsCount as number) || 0;
    if (events > 0) tips.push(`Tienes ${events} evento${events > 1 ? 's' : ''} hoy`);
    tips.push('¿Generar un entrenamiento?');
    tips.push('Pregúntame lo que necesites');
    return tips;
  },
  calendar: () => ['¿Importar cuadrante desde Excel?', '¿Crear una sesión?'],
  bracket: () => ['¿Subir acta de resultados?', '¿Crear cuadro de torneo?'],
  'training-editor': () => ['¿Necesitas ejercicios de tiro?', '¿Añadir calentamiento?'],
  'team-detail': (data) => {
    const name = (data?.teamName as string) || 'tu equipo';
    return [`¿Generar entrenamiento para ${name}?`, '¿Ver el calendario?'];
  },
  exercises: () => ['¿Buscar ejercicios?', '¿Generar un entrenamiento?'],
  teams: () => ['¿Crear un nuevo equipo?'],
  settings: () => ['¿Necesitas ayuda con los ajustes?'],
};

const NUDGES_BY_SCREEN: Record<string, (data?: Record<string, unknown>) => string[]> = {
  calendar: () => ['Veo que estás en el calendario. ¿Quieres que prepare el entrenamiento de la próxima sesión?'],
  bracket: () => ['Estás viendo el cuadro. ¿Quieres que actualice los resultados del último partido?'],
  'team-detail': (data) => {
    const name = (data?.teamName as string) || 'tu equipo';
    return [`Veo que estás organizando a ${name}. ¿Actualizamos el informe de jugadores o la asistencia?`];
  },
  'training-editor': () => ['Veo que estás editando un entrenamiento. ¿Necesitas ejercicios específicos?'],
};

export function useCopilotTips(screenContext: ScreenContext, options: TipsOptions = {}) {
  const mode = options.proactivityMode ?? 'suggestions';
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const [dismissedForKey, setDismissedForKey] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const tipIndexRef = useRef(0);
  const screenDataKey = JSON.stringify({ s: screenContext.screen, d: screenContext.data });

  // When screen changes, dismiss state resets automatically since dismissedForKey won't match
  const isDismissed = dismissedForKey === screenDataKey;

  useEffect(() => {
    tipIndexRef.current = 0;

    if (mode === 'off') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentTip(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return undefined;
    }

    const getTips = TIPS_BY_SCREEN[screenContext.screen] || (() => ['¿En qué puedo ayudarte?']);
    let tips = getTips(screenContext.data);

    if (mode === 'nudges') {
      const getNudges = NUDGES_BY_SCREEN[screenContext.screen];
      if (getNudges) {
        const nudgeKey = `nudge_${screenContext.screen}`;
        if (!sessionStorage.getItem(nudgeKey)) {
          const nudges = getNudges(screenContext.data);
          if (nudges.length > 0) {
            tips = [...nudges, ...tips];
            sessionStorage.setItem(nudgeKey, 'true');
          }
        }
      }
    }

    if (tips.length === 0) return undefined;

    // Start with a delay so the first tip appears after 2s (also resets tip on screen change)
    const timeout = setTimeout(() => {
      setCurrentTip(tips[0]);
      if (tips.length > 1) {
        intervalRef.current = setInterval(() => {
          tipIndexRef.current = (tipIndexRef.current + 1) % tips.length;
          setCurrentTip(tips[tipIndexRef.current]);
        }, 8000);
      }
    }, 2000);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCurrentTip(null);
    };
  }, [screenDataKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissTip = useCallback(() => {
    setDismissedForKey(screenDataKey);
    setCurrentTip(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [screenDataKey]);

  return { currentTip: mode === 'off' || isDismissed ? null : currentTip, dismissTip };
}
