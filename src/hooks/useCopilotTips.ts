import { useState, useEffect, useRef, useCallback } from 'react';

interface ScreenContext {
  screen: string;
  data?: Record<string, unknown>;
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
  bracket: () => ['¿Subir acta de resultados?', '¿Crear cuadro de playoffs?'],
  'training-editor': () => ['¿Necesitas ejercicios de tiro?', '¿Añadir calentamiento?'],
  'team-detail': (data) => {
    const name = (data?.teamName as string) || 'tu equipo';
    return [`¿Generar entrenamiento para ${name}?`, '¿Ver el calendario?'];
  },
  exercises: () => ['¿Buscar ejercicios?', '¿Generar un entrenamiento?'],
  teams: () => ['¿Crear un nuevo equipo?'],
  settings: () => ['¿Necesitas ayuda con los ajustes?'],
};

export function useCopilotTips(screenContext: ScreenContext) {
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const [dismissedForKey, setDismissedForKey] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const tipIndexRef = useRef(0);
  const screenDataKey = JSON.stringify({ s: screenContext.screen, d: screenContext.data });

  // When screen changes, dismiss state resets automatically since dismissedForKey won't match
  const isDismissed = dismissedForKey === screenDataKey;

  useEffect(() => {
    tipIndexRef.current = 0;

    const getTips = TIPS_BY_SCREEN[screenContext.screen] || (() => ['¿En qué puedo ayudarte?']);
    const tips = getTips(screenContext.data);
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
  }, [screenDataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissTip = useCallback(() => {
    setDismissedForKey(screenDataKey);
    setCurrentTip(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [screenDataKey]);

  return { currentTip: isDismissed ? null : currentTip, dismissTip };
}
