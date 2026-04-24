# Benchmark: Copilot CoachApp vs referencias

Objetivo: puntuar (1–5) y anotar brechas para priorizar P0/P1/P2. Las puntuaciones de **CoachApp** reflejan el estado tras la revisión documentada en [INVENTORY.md](./INVENTORY.md).

## Productos de referencia

1. **ChatGPT (web)** — chat generalista, streaming, adjuntos, historial largo
2. **Claude (web)** — markdown, artefactos, citas
3. **Microsoft Copilot en M365** — contexto de documento/pantalla, acciones sugeridas
4. **Notion AI** — inserción en página, tono breve, scope del doc
5. **Linear (Asistente)** — comandos, enlaces a issues, poco ruido

## Matriz de criterios

Leyenda: **C** = CoachApp. Puntuación 1 = muy débil, 5 = al nivel o mejor que la referencia típica en ese criterio.

| Criterio                                   | ChatGPT | Claude | M365 Copilot | Notion AI | Linear | **C** |
| ------------------------------------------ | ------- | ------ | ------------ | --------- | ------ | ----- |
| Jerarquía visual / legibilidad             | 5       | 5      | 4            | 4         | 4      | **3** |
| Estados de carga y errores claros          | 4       | 4      | 4            | 3         | 4      | **3** |
| Markdown / contenido enriquecido           | 5       | 5      | 4            | 4         | 3      | **4** |
| Tarjetas / bloques de dominio              | 2       | 3      | 4            | 4         | 4      | **4** |
| Integración con “dónde estoy” (pantalla)   | 2       | 2      | 5            | 5         | 5      | **4** |
| Acciones / CTAs (confirmar, navegar)       | 3       | 3      | 4            | 3         | 5      | **4** |
| Streaming de respuesta                     | 5       | 5      | 4            | 3         | 2      | **2** |
| Historial / memoria de conversación        | 5       | 5      | 3            | 4         | 4      | **3** |
| Adjuntos (archivos en el chat)             | 5       | 5      | 3            | 3         | 2      | **2** |
| Guardarraíles en escrituras                | 3       | 3      | 4            | 3         | 4      | **5** |
| Observabilidad / feedback (thumbs, trazas) | 2       | 2      | 2            | 2         | 3      | **4** |
| Proactividad (tips fuera del panel)        | 2       | 2      | 3            | 2         | 3      | **3** |

### Fortalezas relativas de CoachApp

- **Guardarraíles:** solo escrituras vía `propose_*` + confirmación en UI (`confirm_write`).
- **Dominio baloncesto:** bloques `training_preview`, `bracket_preview`, `session_preview`, etc.
- **Contexto:** `screenContext` + digest de usuario en backend.
- **Navegación in-app:** tool `suggest_navigation` + botones en panel/columna.
- **Langfuse:** trazas y feedback enlazado a `traceId`.

### Debilidades relativas

- Sin **streaming** de tokens en el panel.
- **Adjuntos** en el chat libre no equiparables a ChatGPT/Claude.
- **Historial al modelo** truncado (10) vs persistencia (30).
- **Accesibilidad** no auditada formalmente (foco, ARIA, teclado en lista de mensajes).

## Sesiones de prueba sugeridas (checklist manual)

Ejecutar en build local o staging, anotar captura + nota breve.

| ID  | Pantalla (`screen`) | Prompt de prueba                               | Qué observar                                                      |
| --- | ------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| T1  | `home`              | "¿Qué equipos tengo?"                          | `list_teams` + `team_list`, tono breve                            |
| T2  | `team-detail`       | "Prepara un entrenamiento de 60 min defensivo" | `run_training_generator` + preview + propuesta si aplica          |
| T3  | `calendar`          | "Resume mis próximos eventos"                  | `list_calendar_sessions`, datos reales                            |
| T4  | `bracket`           | "Explícame cómo va mi playoff"                 | `get_bracket` / `list_brackets`, bloques                          |
| T5  | `training-editor`   | "Llévame al calendario"                        | `suggest_navigation` → botón Ir al calendario                     |
| T6  | `cuaderno`          | "Abre el test de tiro de este equipo"          | `suggest_navigation` con `cuaderno_test_tiro` + `teamId` inferido |
| T7  | Cualquiera          | Mensaje vacío / error de red                   | Mensaje de error en cliente; saturación IA en orquestador         |

## Priorización sugerida

| Prioridad | Tema                                                                       |
| --------- | -------------------------------------------------------------------------- |
| P0        | Coherencia texto + bloques (hechos en parte en orquestador + `useCopilot`) |
| P0        | Navegación in-app (`suggest_navigation` + acciones)                        |
| P1        | Ampliar o resumir historial enviado al modelo                              |
| P1        | Streaming o “typing” simulado por estados                                  |
| P2        | Adjuntos en chat                                                           |
| P2        | Alinear `resolveScreen` con todas las rutas (p. ej. planilla)              |
