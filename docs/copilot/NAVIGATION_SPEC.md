# Especificación: navegación guiada in-app (Copilot)

## Objetivo

El agente debe poder **dirigir al usuario a la pantalla concreta** de Pick&Coach donde está la información, donde confirmar una propuesta o donde continúa el flujo conversacional, sin inventar URLs en texto libre.

## Principios

1. **Solo rutas validadas:** el modelo elige un `target` lógico; el servidor construye el `path` con [`appRouteCatalog.ts`](../../functions/src/shared/appRouteCatalog.ts).
2. **Sin mutación de datos:** la tool es de sugerencia; no escribe en Firestore.
3. **IDs explícitos o inferidos:** `teamId`, `trainingId`, `sessionId` pueden venir de argumentos de la tool o de `defaults` en [`functions/src/index.ts`](../../functions/src/index.ts) (derivados de `screenContext`).
4. **UX por defecto:** botón "Ir a…" (`ActionButton`); la **navegación automática** sin clic no está activada (evita saltos sorpresa). Opcional futuro: preferencia de usuario.

## Tool: `suggest_navigation`

- **Definición:** [`navigationTools.ts`](../../functions/src/ai/tools/navigationTools.ts)
- **Registro:** [`functions/src/index.ts`](../../functions/src/index.ts) (`createNavigationTools`)
- **Parámetros:** `target` (enum), `teamId?`, `trainingId?`, `sessionId?`
- **Respuesta al modelo:** `{ ok, path, label, target }` o `{ error }`
- **Efecto en respuesta HTTP:** el [`OrchestratorAgent`](../../functions/src/ai/agents/orchestratorAgent.ts) acumula `actions: [{ type: 'navigate', label, path }]`.

## Contrato API

[`OrchestratorResponse`](../../functions/src/shared/copilotContracts.ts):

```ts
actions?: CopilotAction[]; // hoy solo { type: 'navigate', label, path }
```

El cliente ([`useCopilot.ts`](../../src/hooks/useCopilot.ts)) copia `response.actions` en `ChatMessage.actions`. [`executeAction`](../../src/hooks/useCopilot.ts) llama a `navigate(path)` de React Router.

## Catálogo de `target`

Fuente única: `NavigationTargetId` en [`appRouteCatalog.ts`](../../functions/src/shared/appRouteCatalog.ts).

Incluye: `home`, `teams`, `team_detail`, `team_trainings`, `training_editor`, `calendar`, `session_scouting`, `session_analysis`, `session_planilla`, `playoffs`, `exercises`, `settings`, subrutas `cuaderno_*`.

## Prompt del orquestador

Regla 8 en `orchestrator-system` ([`promptManager.ts`](../../functions/src/ai/promptManager.ts)): usar `suggest_navigation` para enlaces internos; no inventar paths en markdown.

## Markdown interno (futuro)

[`TextBlock.tsx`](../../src/components/copilot/blocks/TextBlock.tsx) abre enlaces con `target="_blank"`. Si se desea que `[texto](/teams/...)` navegue dentro de la SPA, habría que detectar paths relativos y usar `useNavigate` (lista blanca de prefijos).

## Mantenimiento

Al añadir rutas en [`AppRouter.jsx`](../../src/shell/AppRouter.jsx):

1. Añadir entrada en `resolveScreen` si afecta al contexto del Copilot.
2. Añadir `NavigationTargetId` + rama en `resolveAppNavigation`.
3. Ampliar tests en [`appRouteCatalog.test.ts`](../../functions/src/shared/appRouteCatalog.test.ts).

## Tests

- Resolución de rutas: `appRouteCatalog.test.ts`
- Orquestador con tool real: `suggest_navigation` en [`orchestrator.test.ts`](../../functions/src/ai/__tests__/orchestrator.test.ts)
