# Inventario: Copilot (chat web) + backend `aiChat`

Última revisión alineada con el código del repo. Sirve como línea base para el benchmark y las mejoras.

## Arquitectura

| Capa                 | Componentes                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI                   | [`CopilotRoot`](../../src/components/copilot/CopilotRoot.tsx), [`CopilotCompact`](../../src/components/copilot/CopilotCompact.tsx), [`CopilotPanel`](../../src/components/copilot/CopilotPanel.tsx), [`CopilotColumn`](../../src/components/copilot/CopilotColumn.tsx), [`ConversationList`](../../src/components/copilot/ConversationList.tsx), [`CopilotFeedback`](../../src/components/copilot/CopilotFeedback.tsx) |
| Estado               | [`useCopilot`](../../src/hooks/useCopilot.ts) vía [`CopilotProvider`](../../src/contexts/CopilotProvider.tsx)                                                                                                                                                                                                                                                                                                          |
| Contexto de pantalla | [`ScreenContextProvider`](../../src/contexts/ScreenContextProvider.tsx) → `screen`, `route`, `params`, `entityType`, `entityId`, `data`                                                                                                                                                                                                                                                                                |
| Cliente IA           | [`aiClient.ts`](../../src/services/aiClient.ts) → callable Firebase `aiChat`                                                                                                                                                                                                                                                                                                                                           |
| Contrato tipos       | [`copilotContracts.ts`](../../functions/src/shared/copilotContracts.ts) (reexport en [`contentBlocks.ts`](../../src/services/contentBlocks.ts))                                                                                                                                                                                                                                                                        |
| Backend              | [`functions/src/index.ts`](../../functions/src/index.ts) → [`OrchestratorAgent`](../../functions/src/ai/agents/orchestratorAgent.ts)                                                                                                                                                                                                                                                                                   |
| Tools                | [`readTools.ts`](../../functions/src/ai/tools/readTools.ts), [`writeTools.ts`](../../functions/src/ai/tools/writeTools.ts), [`agentTools.ts`](../../functions/src/ai/tools/agentTools.ts), [`memoryTools.ts`](../../functions/src/ai/tools/memoryTools.ts), [`navigationTools.ts`](../../functions/src/ai/tools/navigationTools.ts)                                                                                    |
| Prompt sistema       | `orchestrator-system` en [`promptManager.ts`](../../functions/src/ai/promptManager.ts) (Langfuse + fallback local)                                                                                                                                                                                                                                                                                                     |
| Bloques UI           | [`BlockRenderer.tsx`](../../src/components/copilot/blocks/BlockRenderer.tsx) + bloques en `blocks/`                                                                                                                                                                                                                                                                                                                    |

## Tools registradas (resumen)

- **Lectura:** `list_teams`, `get_team`, `list_exercises`, `get_exercise`, `list_trainings`, `get_training`, `list_calendar_sessions`, `list_brackets`, `get_bracket`, `get_bracket_share_config`, `get_cuaderno_section`, `read_attendance`, `list_recurring_sessions`, `read_player_report`, `read_shooting_test`, `read_scouting`, `read_analysis`, …
- **Escritura (propuestas):** `propose_create_training`, `propose_create_calendar_session`, `propose_update_bracket_scores`, `propose_save_note`, `propose_create_bracket`, `propose_save_attendance`, `propose_save_player_report`, `propose_save_shooting_test`, `propose_save_scouting`, `propose_save_analysis`, `propose_create_exercise`, `propose_create_exercises`
- **Agentes legacy empaquetados:** `run_training_generator`, `run_bracket_agent`, `run_calendar_import_agent`, `run_results_agent`
- **Memoria:** `save_memory`, `list_memories`, `forget_memory`
- **Navegación SPA:** `suggest_navigation` → rellena `OrchestratorResponse.actions` (ver [NAVIGATION_SPEC.md](./NAVIGATION_SPEC.md))

## Tipos de `ContentBlock`

`text`, `status`, `team_list`, `training_preview`, `bracket_preview`, `session_preview`, `score_update`, `exercise_preview`, `confirm_write`

## Persistencia de conversaciones

[`useConversationPersistence.ts`](../../src/hooks/useConversationPersistence.ts): Firestore `artifacts/{appId}/users/{uid}/conversations/{id}/messages`, máx. 30 mensajes / 15 conversaciones. Los mensajes incluyen `blocks`, `actions`, `traceId` cuando aplica.

## Gaps resueltos en esta iteración

| Gap                                                                                               | Estado                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChatMessage.actions` / `executeAction('navigate')` existían pero el backend no enviaba `actions` | **Resuelto:** `OrchestratorResponse.actions` + tool `suggest_navigation` + [`useCopilot`](../../src/hooks/useCopilot.ts) asigna `actions` desde la respuesta                                                     |
| Fallback "He terminado." con solo bloques ricos o sin texto útil                                  | **Mejorado** en orquestador ([`orchestratorAgent.ts`](../../functions/src/ai/agents/orchestratorAgent.ts)) y en [`useCopilot`](../../src/hooks/useCopilot.ts) para texto resumido cuando hay tarjetas o acciones |
| Catálogo de rutas centralizado para no inventar URLs                                              | **Añadido:** [`appRouteCatalog.ts`](../../functions/src/shared/appRouteCatalog.ts)                                                                                                                               |

## Gaps pendientes (no implementados aquí)

| Gap                                                            | Notas                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Streaming de tokens                                            | Respuesta única por vuelta `generateWithTools`                                                                |
| Adjuntos en chat libre                                         | PDF/imagen siguen en flujos específicos (bracket/calendario), no en el panel genérico                         |
| Historial enviado al modelo                                    | Solo últimos 10 mensajes de texto (`slice(-10)` en `useCopilot`); mismatch con hasta 30 guardados             |
| `ScreenContextProvider` y ruta `/calendar/:sessionId/planilla` | El patrón de `planilla` no aparece en `resolveScreen`; la pantalla puede resolverse como `unknown` en esa URL |
| `CopilotCompact`                                               | No muestra historial ni acciones; solo burbuja de tips + botón flotante (por diseño)                          |

## Orquestador

- Máx. 8 iteraciones tool+modelo (`MAX_TOOL_ITERATIONS`)
- Estados previos a tools lentas (`SLOW_TOOL_STATUS`)
- Reintento único en errores de red transitorios
- Puntuaciones Langfuse: `tool_calls`, `iteration_count`, `tool_errors_total`, feedback usuario

## Rutas SPA de referencia

Ver [`AppRouter.jsx`](../../src/shell/AppRouter.jsx). El catálogo de navegación del Copilot debe mantenerse sincronizado manualmente con este archivo y con `ScreenContextProvider`.
