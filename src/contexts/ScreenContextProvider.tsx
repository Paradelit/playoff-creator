import { createContext, useContext, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Snapshot semántico que un screen registra para que Pick pueda resolver
 * referencias como "este equipo" o "este partido" sin tool calls. Se envía
 * al backend dentro de `screenContext.semantic` y el orchestrator lo
 * renderiza estructuralmente en el system prompt (sub-A.5).
 */
export interface ScreenSemantic {
  /** Código semántico estable (team-detail, calendar, bracket-editor...). */
  surface: string;
  /** Frase legible para el LLM con el resumen de lo visible. */
  label: string;
  /** Map de frases referenciales → entityId. */
  referableIds?: Record<string, string>;
}

export interface ScreenContext {
  screen: string;
  route: string;
  params: Record<string, string>;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  semantic?: ScreenSemantic;
}

interface ScreenContextAPI {
  screenContext: ScreenContext;
  registerScreenData: (data: Record<string, unknown>) => void;
  registerScreenSemantic: (semantic: ScreenSemantic | null) => void;
}

interface DataState {
  path: string;
  data: Record<string, unknown>;
}

interface SemanticState {
  path: string;
  semantic: ScreenSemantic | null;
}

const ScreenCtx = createContext<ScreenContextAPI | null>(null);

function resolveScreen(pathname: string): {
  screen: string;
  params: Record<string, string>;
  entityType?: string;
  entityId?: string;
} {
  const patterns: Array<{
    pattern: RegExp;
    screen: string;
    entityType?: string;
    paramNames?: string[];
  }> = [
    {
      pattern: /^\/teams\/([^/]+)\/trainings\/([^/]+)$/,
      screen: 'training-editor',
      entityType: 'training',
      paramNames: ['teamId', 'trainingId'],
    },
    {
      pattern: /^\/teams\/([^/]+)\/trainings$/,
      screen: 'team-trainings',
      entityType: 'team',
      paramNames: ['teamId'],
    },
    {
      pattern: /^\/teams\/([^/]+)\/cuaderno/,
      screen: 'cuaderno',
      entityType: 'team',
      paramNames: ['teamId'],
    },
    {
      pattern: /^\/teams\/([^/]+)$/,
      screen: 'team-detail',
      entityType: 'team',
      paramNames: ['teamId'],
    },
    { pattern: /^\/teams$/, screen: 'teams' },
    { pattern: /^\/playoffs$/, screen: 'bracket', entityType: 'bracket' },
    {
      pattern: /^\/calendar\/([^/]+)\/scouting$/,
      screen: 'scouting',
      entityType: 'session',
      paramNames: ['sessionId'],
    },
    {
      pattern: /^\/calendar\/([^/]+)\/analysis$/,
      screen: 'analysis',
      entityType: 'session',
      paramNames: ['sessionId'],
    },
    { pattern: /^\/calendar$/, screen: 'calendar' },
    { pattern: /^\/exercises$/, screen: 'exercises' },
    { pattern: /^\/settings$/, screen: 'settings' },
    { pattern: /^\/$/, screen: 'home' },
  ];

  for (const { pattern, screen, entityType, paramNames } of patterns) {
    const match = pathname.match(pattern);
    if (match) {
      const params: Record<string, string> = {};
      paramNames?.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { screen, params, entityType, entityId: params[paramNames?.[0] || ''] };
    }
  }
  return { screen: 'unknown', params: {} };
}

export function ScreenContextProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [dataState, setDataState] = useState<DataState>({ path: location.pathname, data: {} });
  const [semanticState, setSemanticState] = useState<SemanticState>({
    path: location.pathname,
    semantic: null,
  });

  // Auto-clear custom data + semantic on route change.
  const customData = dataState.path === location.pathname ? dataState.data : {};
  const customSemantic = semanticState.path === location.pathname ? semanticState.semantic : null;

  const resolved = resolveScreen(location.pathname);

  const screenContext: ScreenContext = {
    screen: resolved.screen,
    route: location.pathname,
    params: resolved.params,
    entityType: resolved.entityType,
    entityId: resolved.entityId,
    data: customData,
    ...(customSemantic ? { semantic: customSemantic } : {}),
  };

  const registerScreenData = useCallback(
    (data: Record<string, unknown>) => {
      setDataState((prev) => ({
        path: location.pathname,
        data: prev.path === location.pathname ? { ...prev.data, ...data } : { ...data },
      }));
    },
    [location.pathname],
  );

  const registerScreenSemantic = useCallback(
    (semantic: ScreenSemantic | null) => {
      setSemanticState({ path: location.pathname, semantic });
    },
    [location.pathname],
  );

  return (
    <ScreenCtx.Provider value={{ screenContext, registerScreenData, registerScreenSemantic }}>
      {children}
    </ScreenCtx.Provider>
  );
}

export function useScreenContext(): ScreenContextAPI {
  const ctx = useContext(ScreenCtx);
  if (!ctx) throw new Error('useScreenContext must be used within ScreenContextProvider');
  return ctx;
}
