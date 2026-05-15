# Sub-proyecto C — Tool coverage + acción — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el ciclo de acción de Pick (`propose_mark_convocatoria_sent`) y completar CRUD uniforme (update/delete sobre training, calendar session, exercise, bracket).

**Architecture:** Pattern existente: tool declara en `writeTools.ts` → handler valida → orchestrator emite `confirm_write` block → frontend `ConfirmWriteBlock` renderiza → user confirma → `proposalExecutor.ts` ejecuta el write Firestore client-side bajo rules del user. Sub-C añade 9 tools nuevos siguiendo ese pattern.

**Tech Stack:** TypeScript + Firebase Cloud Functions v2 + Firestore client SDK + Vitest + React 19. Sin SDKs nuevos.

**Spec:** `docs/superpowers/specs/2026-05-15-sub-proyecto-C-tool-coverage-design.md`

**PR breakdown (8 PRs):**

| PR  | Sub | Foco                                                                                | Tools nuevos | Risk |
| --- | --- | ----------------------------------------------------------------------------------- | ------------ | ---- |
| 1   | C.0 | Métricas Langfuse `update_proposals_total` / `delete_proposals_total` + dimensiones | 0            | low  |
| 2   | C.1 | `propose_mark_convocatoria_sent` (cierra el ciclo)                                  | 1            | low  |
| 3   | C.2 | `propose_update_training` + `propose_delete_training`                               | 2            | low  |
| 4   | C.3 | `propose_update_calendar_session` + `propose_delete_calendar_session`               | 2            | med  |
| 5   | C.4 | `propose_update_exercise` + `propose_delete_exercise` + `propose_delete_exercises`  | 3            | low  |
| 6   | C.5 | `propose_delete_bracket`                                                            | 1            | med  |
| 7   | C.6 | Eval scores `action-close-loop` + `update-delete-offered`                           | 0            | low  |
| 8   | C.7 | CLAUDE.md update + memoria de cierre                                                | 0            | low  |

---

## Pattern de tool nuevo (referencia común a todos los PRs)

Cada tool nuevo toca **4 sitios** en este orden:

1. **`functions/src/shared/pickContracts.ts`** — añadir el kind al union `WriteProposalKind` (~line 65).
2. **`functions/src/ai/tools/writeTools.ts`** — declarar el tool en `createWriteTools()`.
   Handler valida inputs + returns `{ kind: '<kind>', ...payload, summary }`.
3. **`src/services/proposalExecutor.ts`** — añadir `handleXxx(ctx, payload)` que hace el write Firestore client-side + entry en el record `proposalHandlers`.
4. **Tests** — backend test en `functions/src/ai/tools/__tests__/writeTools.test.ts` (o crear si no existe; readTools.test.ts existe ya como referencia).

**No requiere cambios frontend explícitos** — `ConfirmWriteBlock.tsx` ya renderiza cualquier `confirm_write` block usando `summary` + kind para enrutar a `proposalExecutor.executeProposal()`. Sólo se requiere wiring frontend si el kind necesita render especial (no es el caso de update/delete genéricos).

**No requiere cambios en firestore.rules** — los writes son client-side bajo rules existentes; las entidades target (trainings, calendar sessions, exercises, brackets) ya tienen permisos write para owner/DT.

---

## File Structure

### Backend (`functions/`)

```
functions/src/
  shared/pickContracts.ts                       # MODIFY (cada PR de tool añade 1-3 kinds al union)
  ai/tools/
    writeTools.ts                               # MODIFY (cada PR añade tool declarations)
    __tests__/writeTools.test.ts                # CREATE en PR 2 (no existe; usar readTools.test.ts como template)
  ai/agents/orchestratorAgent.ts                # MODIFY en PR 1 (instrumentación Langfuse)
```

### Frontend (`src/`)

```
src/services/
  proposalExecutor.ts                           # MODIFY (cada PR añade handleXxx + entry en proposalHandlers)
```

### Docs

```
CLAUDE.md                                       # MODIFY en PR 8 (sección sub-C)
docs/superpowers/specs/2026-05-15-sub-proyecto-C-tool-coverage-design.md   # ya existe
```

---

## PR 1 — C.0: Métricas Langfuse para tools nuevos

**Goal:** Instrumentar counters Langfuse para medir adopción de los tools que vamos a añadir. Métricas: `update_proposals_total` (kind dimension), `delete_proposals_total` (kind dimension), `mark_convocatoria_sent_total`.

**Files:**

- Modify: `functions/src/ai/agents/orchestratorAgent.ts` (sitio donde se emiten `tool_calls` métricas a Langfuse hoy)
- Modify (si aplica): `functions/src/ai/tools/writeTools.ts` (counter wrapping en handler returns — opcional, ver task 1.2)

### Task 1.1: Localizar instrumentación existente

- [ ] **Step 1: Identificar dónde se emite `tool_calls` y `tool_errors_total` a Langfuse en orchestratorAgent.ts.**

Run:

```bash
grep -n "tool_calls\|tool_errors_total\|langfuse" functions/src/ai/agents/orchestratorAgent.ts
```

Expected: encontrar el método que loguea métricas por turno. Toma nota del path + función.

### Task 1.2: Añadir counters específicos por kind

- [ ] **Step 1: Donde se ejecuta cada tool call resolved, añadir un dimension-tagged counter.**

Pattern (en pseudocode — adaptar al tipo real del logger):

```typescript
// Tras ejecutar tool.handler, antes de seguir el loop:
if (toolName.startsWith('propose_')) {
  const kind = (result as { kind?: string })?.kind;
  if (kind?.startsWith('update_')) {
    langfuse.score('update_proposals_total', 1, { dimension: kind });
  } else if (kind?.startsWith('delete_')) {
    langfuse.score('delete_proposals_total', 1, { dimension: kind });
  } else if (kind === 'mark_convocatoria_sent') {
    langfuse.score('mark_convocatoria_sent_total', 1);
  }
}
```

- [ ] **Step 2: Si los counters ya existen como `tool_calls` con dimension, alternativa = añadir filtro grafana en lugar de nuevos counters.** Decidir según código real; si los counters granulares son trivial, preferir step 1.

- [ ] **Step 3: Run tests.**

```bash
npx vitest run functions/src/ai/__tests__/orchestrator.test.ts
```

Expected: PASS. Las métricas no rompen tests existentes.

- [ ] **Step 4: Commit.**

```bash
git add functions/src/ai/agents/orchestratorAgent.ts
git commit -m "feat(ai): instrumentar counters para update/delete proposals (sub-C.0)"
```

---

## PR 2 — C.1: `propose_mark_convocatoria_sent`

**Goal:** Pick puede marcar la convocatoria de un partido como enviada. Tras confirmación, `calendarSessions/{id}.convocatoriaSentAt` se actualiza, el digest deja de incluirlo en `pendingConvocatorias`, y Pick no vuelve a sugerirlo.

**Files:**

- Modify: `functions/src/shared/pickContracts.ts` (añadir `'mark_convocatoria_sent'` al union)
- Modify: `functions/src/ai/tools/writeTools.ts` (declarar tool)
- Modify: `src/services/proposalExecutor.ts` (handler)
- Create: `functions/src/ai/tools/__tests__/writeTools.test.ts` (template basado en readTools.test.ts)

### Task 2.1: Añadir kind al union

- [ ] **Step 1: Modificar `functions/src/shared/pickContracts.ts:65-77`. Añadir `'mark_convocatoria_sent'` al final del union.**

```typescript
export type WriteProposalKind =
  | 'create_training'
  | 'create_calendar_session'
  | 'update_bracket_scores'
  | 'save_note'
  | 'create_bracket'
  | 'save_attendance'
  | 'save_player_report'
  | 'save_shooting_test'
  | 'save_scouting'
  | 'save_analysis'
  | 'create_exercise'
  | 'create_exercises'
  | 'mark_convocatoria_sent';
```

### Task 2.2: Test failing primero

- [ ] **Step 1: Crear `functions/src/ai/tools/__tests__/writeTools.test.ts` (template del existente readTools.test.ts).**

Usar el setup de mock Firestore + ToolContext como en readTools.test.ts. El esqueleto:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createWriteTools } from '../writeTools';
import type { ToolContext } from '../registry';
// Reusar buildMockDb del readTools.test.ts:
import { buildMockDb } from './readTools.test'; // o copiar el helper aquí si no es exportable

const APP_ID = 'test-app';
const WS_ID = 'ws-1';
const USER_ID = 'user-1';

function buildCtx(db: unknown, defaults: ToolContext['defaults'] = {}): ToolContext {
  return {
    db: db as never,
    appId: APP_ID,
    wsId: WS_ID,
    userId: USER_ID,
    defaults,
  };
}

describe('writeTools', () => {
  describe('propose_mark_convocatoria_sent', () => {
    it('returns mark_convocatoria_sent kind with sessionId + summary', async () => {
      const tools = createWriteTools();
      const tool = tools.find((t) => t.name === 'propose_mark_convocatoria_sent');
      expect(tool).toBeDefined();
      const result = await tool!.handler(
        { sessionId: 'cal_123', summary: 'Marcada convocatoria de sábado' },
        buildCtx(buildMockDb([])),
      );
      expect(result).toEqual({
        kind: 'mark_convocatoria_sent',
        sessionId: 'cal_123',
        summary: 'Marcada convocatoria de sábado',
      });
    });

    it('returns error if sessionId is missing', async () => {
      const tools = createWriteTools();
      const tool = tools.find((t) => t.name === 'propose_mark_convocatoria_sent');
      const result = await tool!.handler({ summary: 'x' }, buildCtx(buildMockDb([])));
      expect(result).toEqual({ error: expect.stringContaining('sessionId') });
    });
  });
});
```

- [ ] **Step 2: Run test → debe fallar (tool no existe).**

```bash
npx vitest run functions/src/ai/tools/__tests__/writeTools.test.ts
```

Expected: FAIL — "Cannot find property 'name' of undefined" o similar.

### Task 2.3: Implementar tool

- [ ] **Step 1: Añadir el tool al return array de `createWriteTools()` en `functions/src/ai/tools/writeTools.ts` (después de `propose_create_exercises`).**

```typescript
{
  name: "propose_mark_convocatoria_sent",
  description:
    "Propone marcar la convocatoria de un partido como enviada. Después de confirmar, el partido deja de aparecer en pendientes. Úsalo cuando el coach diga 'ya la mandé' / 'la envié' o tras el flujo mandar_convocatoria + share.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "ID de la sesión (calendarSession o virtual de playoff)" },
      summary: { type: "string", description: "Resumen humano de 1 línea" },
    },
    required: ["sessionId", "summary"],
  },
  handler: async (args) => {
    const sessionId = typeof args.sessionId === "string" ? args.sessionId : "";
    if (!sessionId) return { error: "Falta sessionId." };
    return {
      kind: "mark_convocatoria_sent",
      sessionId,
      summary: typeof args.summary === "string" ? args.summary : "",
    };
  },
},
```

- [ ] **Step 2: Run tests → PASS.**

```bash
npx vitest run functions/src/ai/tools/__tests__/writeTools.test.ts
```

### Task 2.4: Frontend executor

- [ ] **Step 1: Añadir handler en `src/services/proposalExecutor.ts` antes del record `proposalHandlers` (~line 316).**

Pattern para playoff virtual + calendar real:

```typescript
async function handleMarkConvocatoriaSent(ctx: ExecuteContext, payload: ProposalPayload) {
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
  if (!sessionId) throw invalidProposal('falta sessionId');

  if (sessionId.startsWith('playoff-')) {
    // Virtual playoff session: store flag in workspace settings.
    const ref = workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'settings', 'playoffConvocatorias');
    const snap = await getDoc(ref);
    const data = snap.exists() ? asRecord(snap.data()) || {} : {};
    const sent = (asRecord(data.sent) as Record<string, unknown>) || {};
    sent[sessionId] = true;
    await setDoc(ref, { sent, updatedAt: serverTimestamp() }, { merge: true });
    return;
  }

  await setDoc(
    workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'calendarSessions', sessionId),
    { convocatoriaSentAt: serverTimestamp() },
    { merge: true },
  );
}
```

- [ ] **Step 2: Añadir entry al record `proposalHandlers` (line 316-329).**

```typescript
const proposalHandlers: Record<WriteProposalKind, ProposalHandler> = {
  // ... existing ...
  mark_convocatoria_sent: handleMarkConvocatoriaSent,
};
```

- [ ] **Step 3: Verificar TypeScript compila — el union cambió y el record tiene que ser exhaustivo.**

```bash
npm run lint
```

Expected: PASS (sin errores TS).

### Task 2.5: Smoke local

- [ ] **Step 1: `npm run dev`, abrir Pick, escribir "ya mandé la convocatoria del próximo partido". Verificar que Pick emite `confirm_write` con kind `mark_convocatoria_sent`, confirmar, verificar en Firestore que `convocatoriaSentAt` aparece en el doc.**

### Task 2.6: Commit + PR

- [ ] **Step 1: Commit.**

```bash
git add functions/src/shared/pickContracts.ts \
  functions/src/ai/tools/writeTools.ts \
  functions/src/ai/tools/__tests__/writeTools.test.ts \
  src/services/proposalExecutor.ts
git commit -m "feat(ai): propose_mark_convocatoria_sent (sub-C.1) — cierra el ciclo de convocatoria"
```

- [ ] **Step 2: Push + PR.**

---

## PR 3 — C.2: `propose_update_training` + `propose_delete_training`

**Goal:** Pick puede editar y borrar entrenamientos creados (o que el coach ya tenía).

**Files:**

- Modify: `functions/src/shared/pickContracts.ts` (añadir `'update_training'`, `'delete_training'`)
- Modify: `functions/src/ai/tools/writeTools.ts`
- Modify: `src/services/proposalExecutor.ts`
- Modify: `functions/src/ai/tools/__tests__/writeTools.test.ts`

### Task 3.1: Añadir kinds al union

- [ ] **Step 1: Modificar `functions/src/shared/pickContracts.ts:65` añadiendo:**

```typescript
  | 'update_training'
  | 'delete_training'
```

### Task 3.2: Tests failing

- [ ] **Step 1: Añadir describe blocks en `writeTools.test.ts`.**

```typescript
describe('propose_update_training', () => {
  it('returns update_training kind with teamId, trainingId, updates', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_update_training');
    expect(tool).toBeDefined();
    const result = await tool!.handler(
      { teamId: 't1', trainingId: 'tr_1', updates: { titulo: 'Nuevo título' }, summary: 'Renombrar' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toEqual({
      kind: 'update_training',
      teamId: 't1',
      trainingId: 'tr_1',
      updates: { titulo: 'Nuevo título' },
      summary: 'Renombrar',
    });
  });

  it('uses screen context teamId when args.teamId missing', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_update_training');
    const result = await tool!.handler(
      { trainingId: 'tr_1', updates: { titulo: 'X' }, summary: 's' },
      buildCtx(buildMockDb([]), { teamId: 't-ctx' }),
    );
    expect((result as { teamId: string }).teamId).toBe('t-ctx');
  });

  it('returns error if trainingId missing', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_update_training');
    const result = await tool!.handler({ teamId: 't1', updates: {}, summary: 's' }, buildCtx(buildMockDb([])));
    expect(result).toEqual({ error: expect.stringContaining('trainingId') });
  });

  it('returns error if updates is empty', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_update_training');
    const result = await tool!.handler(
      { teamId: 't1', trainingId: 'tr_1', updates: {}, summary: 's' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toEqual({ error: expect.stringContaining('updates') });
  });
});

describe('propose_delete_training', () => {
  it('returns delete_training kind', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_training');
    expect(tool).toBeDefined();
    const result = await tool!.handler(
      { teamId: 't1', trainingId: 'tr_1', summary: 'Borrar X' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toEqual({
      kind: 'delete_training',
      teamId: 't1',
      trainingId: 'tr_1',
      summary: 'Borrar X',
    });
  });

  it('requires summary explicit (destructive)', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_training');
    const result = await tool!.handler({ teamId: 't1', trainingId: 'tr_1' }, buildCtx(buildMockDb([])));
    expect(result).toEqual({ error: expect.stringContaining('summary') });
  });
});
```

- [ ] **Step 2: Run → FAIL.**

```bash
npx vitest run functions/src/ai/tools/__tests__/writeTools.test.ts
```

### Task 3.3: Implementar tools

- [ ] **Step 1: Añadir al return array de `createWriteTools()`:**

```typescript
{
  name: "propose_update_training",
  description:
    "Propone actualizar campos puntuales de un entrenamiento existente (patch parcial — solo los campos pasados se cambian, el resto se mantiene). teamId se infiere de la pantalla si no se pasa.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      teamId: { type: "string", description: "Equipo dueño del entrenamiento (opcional si screen context)" },
      trainingId: { type: "string", description: "ID del entrenamiento a actualizar" },
      updates: { type: "object", description: "Campos a cambiar (parcial)" },
      summary: { type: "string", description: "Resumen humano" },
    },
    required: ["trainingId", "updates", "summary"],
  },
  handler: async (args, ctx) => {
    const teamId = resolveId(args, ctx, "teamId");
    if (!teamId) return { error: "Falta teamId." };
    const trainingId = typeof args.trainingId === "string" ? args.trainingId : "";
    if (!trainingId) return { error: "Falta trainingId." };
    const updates = (args.updates as Record<string, unknown>) || {};
    if (Object.keys(updates).length === 0) return { error: "El campo updates está vacío." };
    return {
      kind: "update_training",
      teamId,
      trainingId,
      updates,
      summary: typeof args.summary === "string" ? args.summary : "",
    };
  },
},
{
  name: "propose_delete_training",
  description:
    "Propone borrar un entrenamiento. Acción destructiva — el summary debe explicar claramente qué se borra para que el coach lo vea antes de confirmar. teamId se infiere de la pantalla.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      teamId: { type: "string" },
      trainingId: { type: "string" },
      summary: { type: "string", description: "Obligatorio — explica qué entrenamiento se borra" },
    },
    required: ["trainingId", "summary"],
  },
  handler: async (args, ctx) => {
    const teamId = resolveId(args, ctx, "teamId");
    if (!teamId) return { error: "Falta teamId." };
    const trainingId = typeof args.trainingId === "string" ? args.trainingId : "";
    if (!trainingId) return { error: "Falta trainingId." };
    const summary = typeof args.summary === "string" ? args.summary : "";
    if (!summary) return { error: "Falta summary (obligatorio para acción destructiva)." };
    return { kind: "delete_training", teamId, trainingId, summary };
  },
},
```

- [ ] **Step 2: Run tests → PASS.**

### Task 3.4: Frontend executors

- [ ] **Step 1: Añadir en `src/services/proposalExecutor.ts`:**

```typescript
async function handleUpdateTraining(ctx: ExecuteContext, payload: ProposalPayload) {
  const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
  const trainingId = typeof payload.trainingId === 'string' ? payload.trainingId : undefined;
  const updates = asRecord(payload.updates);
  if (!teamId || !trainingId || !updates) throw invalidProposal('falta teamId, trainingId o updates');

  await setDoc(
    doc(workspaceColRef(ctx.db, ctx.appId, ctx.wsId, 'teams'), teamId, 'trainings', trainingId),
    { ...updates, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

async function handleDeleteTraining(ctx: ExecuteContext, payload: ProposalPayload) {
  const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
  const trainingId = typeof payload.trainingId === 'string' ? payload.trainingId : undefined;
  if (!teamId || !trainingId) throw invalidProposal('falta teamId o trainingId');

  const { deleteDoc } = await import('firebase/firestore'); // dynamic import; o moverlo a static al top
  await deleteDoc(doc(workspaceColRef(ctx.db, ctx.appId, ctx.wsId, 'teams'), teamId, 'trainings', trainingId));
}
```

- [ ] **Step 2: Mover `deleteDoc` al import estático en line 2.**

```typescript
import { setDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';
```

- [ ] **Step 3: Entries en `proposalHandlers`:**

```typescript
  update_training: handleUpdateTraining,
  delete_training: handleDeleteTraining,
```

### Task 3.5: Smoke + commit

- [ ] **Step 1: Smoke: `npm run dev`, pedir "cambia el título del entrenamiento de mañana a 'Tiro y defensa'". Verificar proposal correcto + write. Idem "borra ese entrenamiento".**

- [ ] **Step 2: Commit.**

```bash
git add functions/src/shared/pickContracts.ts \
  functions/src/ai/tools/writeTools.ts \
  functions/src/ai/tools/__tests__/writeTools.test.ts \
  src/services/proposalExecutor.ts
git commit -m "feat(ai): propose_update_training + propose_delete_training (sub-C.2)"
```

---

## PR 4 — C.3: `propose_update_calendar_session` + `propose_delete_calendar_session`

**Goal:** Pick puede editar y borrar sesiones de calendario (entrenamientos + partidos). Rechazo explícito para sessionIds virtuales `playoff-*` (no editables — son derivados del bracket).

**Files:** mismo pattern que PR 3.

### Task 4.1: Union

- [ ] **Step 1: Añadir `'update_calendar_session'` y `'delete_calendar_session'` al union.**

### Task 4.2: Tests failing

- [ ] **Step 1: Añadir tests análogos a PR 3 + edge case playoff.**

```typescript
describe('propose_update_calendar_session', () => {
  it('returns update_calendar_session kind', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_update_calendar_session');
    const result = await tool!.handler(
      { sessionId: 'cal_1', updates: { horaInicio: '19:30' }, summary: 'Cambio hora' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toEqual({
      kind: 'update_calendar_session',
      sessionId: 'cal_1',
      updates: { horaInicio: '19:30' },
      summary: 'Cambio hora',
    });
  });

  it('rejects playoff virtual sessionIds (not editable)', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_update_calendar_session');
    const result = await tool!.handler(
      { sessionId: 'playoff-br1-R1-M0-0', updates: { horaInicio: '20:00' }, summary: 's' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toEqual({ error: expect.stringContaining('playoff') });
  });
});

describe('propose_delete_calendar_session', () => {
  it('returns delete_calendar_session kind', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_calendar_session');
    const result = await tool!.handler(
      { sessionId: 'cal_1', summary: 'Borrar entreno duplicado' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toEqual({
      kind: 'delete_calendar_session',
      sessionId: 'cal_1',
      summary: 'Borrar entreno duplicado',
    });
  });

  it('rejects playoff virtual sessionIds', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_calendar_session');
    const result = await tool!.handler({ sessionId: 'playoff-br1-R1-M0-0', summary: 's' }, buildCtx(buildMockDb([])));
    expect(result).toEqual({ error: expect.stringContaining('playoff') });
  });
});
```

- [ ] **Step 2: Run → FAIL.**

### Task 4.3: Implementar tools

- [ ] **Step 1: Añadir tools:**

```typescript
{
  name: "propose_update_calendar_session",
  description:
    "Propone actualizar campos puntuales de una sesión de calendario (entrenamiento o partido). Patch parcial. NO acepta sessionIds virtuales 'playoff-*' (no son editables). sessionId se infiere si screen context lo aporta.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      sessionId: { type: "string" },
      updates: { type: "object", description: "Campos a cambiar (fecha, horaInicio, horaFin, lugar, rival, etc.)" },
      summary: { type: "string" },
    },
    required: ["sessionId", "updates", "summary"],
  },
  handler: async (args, ctx) => {
    const sessionId = resolveId(args, ctx, "sessionId");
    if (!sessionId) return { error: "Falta sessionId." };
    if (sessionId.startsWith("playoff-")) {
      return { error: "Las sesiones de playoff no son editables (derivan del bracket)." };
    }
    const updates = (args.updates as Record<string, unknown>) || {};
    if (Object.keys(updates).length === 0) return { error: "El campo updates está vacío." };
    return {
      kind: "update_calendar_session",
      sessionId,
      updates,
      summary: typeof args.summary === "string" ? args.summary : "",
    };
  },
},
{
  name: "propose_delete_calendar_session",
  description:
    "Propone borrar una sesión de calendario. Acción destructiva. NO acepta playoff-*. summary obligatorio explícito.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      sessionId: { type: "string" },
      summary: { type: "string" },
    },
    required: ["sessionId", "summary"],
  },
  handler: async (args, ctx) => {
    const sessionId = resolveId(args, ctx, "sessionId");
    if (!sessionId) return { error: "Falta sessionId." };
    if (sessionId.startsWith("playoff-")) {
      return { error: "Las sesiones de playoff no son borrables (derivan del bracket)." };
    }
    const summary = typeof args.summary === "string" ? args.summary : "";
    if (!summary) return { error: "Falta summary (obligatorio para acción destructiva)." };
    return { kind: "delete_calendar_session", sessionId, summary };
  },
},
```

- [ ] **Step 2: Run tests → PASS.**

### Task 4.4: Frontend executors

- [ ] **Step 1: Añadir handlers:**

```typescript
async function handleUpdateCalendarSession(ctx: ExecuteContext, payload: ProposalPayload) {
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined;
  const updates = asRecord(payload.updates);
  if (!sessionId || !updates) throw invalidProposal('falta sessionId o updates');

  await setDoc(
    workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'calendarSessions', sessionId),
    { ...updates, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

async function handleDeleteCalendarSession(ctx: ExecuteContext, payload: ProposalPayload) {
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined;
  if (!sessionId) throw invalidProposal('falta sessionId');
  await deleteDoc(workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'calendarSessions', sessionId));
}
```

- [ ] **Step 2: Entries en `proposalHandlers`:**

```typescript
  update_calendar_session: handleUpdateCalendarSession,
  delete_calendar_session: handleDeleteCalendarSession,
```

### Task 4.5: Smoke + commit

- [ ] **Step 1: Smoke: pedir "mueve el entrenamiento de mañana a las 19h", "borra ese entreno duplicado". Verificar writes.**

- [ ] **Step 2: Commit.**

```bash
git add functions/src/shared/pickContracts.ts \
  functions/src/ai/tools/writeTools.ts \
  functions/src/ai/tools/__tests__/writeTools.test.ts \
  src/services/proposalExecutor.ts
git commit -m "feat(ai): propose_update_calendar_session + propose_delete_calendar_session (sub-C.3)"
```

---

## PR 5 — C.4: `propose_update_exercise` + `propose_delete_exercise` + `propose_delete_exercises`

**Goal:** Editar + borrar ejercicios. Bulk delete acotado a IDs explícitos.

**Files:** mismo pattern.

### Task 5.1: Union

- [ ] **Step 1: Añadir `'update_exercise'`, `'delete_exercise'`, `'delete_exercises'`.**

### Task 5.2: Tests failing

- [ ] **Step 1: Añadir tests análogos.** El bulk acepta `exerciseIds: string[]`, falla si vacío.

```typescript
describe('propose_update_exercise', () => {
  it('returns update_exercise kind', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_update_exercise');
    const result = await tool!.handler(
      { exerciseId: 'ex_1', updates: { nivel: 'avanzado' }, summary: 'Subir nivel' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toEqual({
      kind: 'update_exercise',
      exerciseId: 'ex_1',
      updates: { nivel: 'avanzado' },
      summary: 'Subir nivel',
    });
  });
});

describe('propose_delete_exercise', () => {
  it('returns delete_exercise kind', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_exercise');
    const result = await tool!.handler({ exerciseId: 'ex_1', summary: 'Borrar duplicado' }, buildCtx(buildMockDb([])));
    expect(result).toMatchObject({ kind: 'delete_exercise', exerciseId: 'ex_1' });
  });
});

describe('propose_delete_exercises', () => {
  it('returns delete_exercises kind with array of IDs', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_exercises');
    const result = await tool!.handler(
      { exerciseIds: ['ex_1', 'ex_2'], summary: 'Borrar batería duplicada' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toMatchObject({ kind: 'delete_exercises', exerciseIds: ['ex_1', 'ex_2'] });
  });

  it('rejects empty array', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_exercises');
    const result = await tool!.handler({ exerciseIds: [], summary: 's' }, buildCtx(buildMockDb([])));
    expect(result).toEqual({ error: expect.stringContaining('vacío') });
  });
});
```

### Task 5.3: Implementar tools

- [ ] **Step 1: Añadir tools:**

```typescript
{
  name: "propose_update_exercise",
  description: "Propone actualizar un ejercicio existente (patch parcial). exerciseId obligatorio.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      exerciseId: { type: "string" },
      updates: { type: "object" },
      summary: { type: "string" },
    },
    required: ["exerciseId", "updates", "summary"],
  },
  handler: async (args) => {
    const exerciseId = typeof args.exerciseId === "string" ? args.exerciseId : "";
    if (!exerciseId) return { error: "Falta exerciseId." };
    const updates = (args.updates as Record<string, unknown>) || {};
    if (Object.keys(updates).length === 0) return { error: "El campo updates está vacío." };
    return {
      kind: "update_exercise",
      exerciseId,
      updates,
      summary: typeof args.summary === "string" ? args.summary : "",
    };
  },
},
{
  name: "propose_delete_exercise",
  description: "Propone borrar un ejercicio. summary obligatorio.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      exerciseId: { type: "string" },
      summary: { type: "string" },
    },
    required: ["exerciseId", "summary"],
  },
  handler: async (args) => {
    const exerciseId = typeof args.exerciseId === "string" ? args.exerciseId : "";
    if (!exerciseId) return { error: "Falta exerciseId." };
    const summary = typeof args.summary === "string" ? args.summary : "";
    if (!summary) return { error: "Falta summary." };
    return { kind: "delete_exercise", exerciseId, summary };
  },
},
{
  name: "propose_delete_exercises",
  description:
    "Propone borrar varios ejercicios de golpe. Recibe array de IDs explícitos. NO acepta filtros tipo 'todos los de X categoría' — usar el tool de listar primero y pasar IDs concretos.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      exerciseIds: { type: "array", items: { type: "string" }, description: "IDs de ejercicios a borrar" },
      summary: { type: "string" },
    },
    required: ["exerciseIds", "summary"],
  },
  handler: async (args) => {
    const exerciseIds = Array.isArray(args.exerciseIds)
      ? args.exerciseIds.filter((id): id is string => typeof id === "string" && !!id)
      : [];
    if (exerciseIds.length === 0) return { error: "El array exerciseIds está vacío." };
    const summary = typeof args.summary === "string" ? args.summary : "";
    if (!summary) return { error: "Falta summary." };
    return { kind: "delete_exercises", exerciseIds, summary };
  },
},
```

### Task 5.4: Frontend executors

- [ ] **Step 1: Añadir handlers:**

```typescript
async function handleUpdateExercise(ctx: ExecuteContext, payload: ProposalPayload) {
  const exerciseId = typeof payload.exerciseId === 'string' ? payload.exerciseId : undefined;
  const updates = asRecord(payload.updates);
  if (!exerciseId || !updates) throw invalidProposal('falta exerciseId o updates');

  await setDoc(
    workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'exercises', exerciseId),
    { ...updates, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

async function handleDeleteExercise(ctx: ExecuteContext, payload: ProposalPayload) {
  const exerciseId = typeof payload.exerciseId === 'string' ? payload.exerciseId : undefined;
  if (!exerciseId) throw invalidProposal('falta exerciseId');
  await deleteDoc(workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'exercises', exerciseId));
}

async function handleDeleteExercises(ctx: ExecuteContext, payload: ProposalPayload) {
  const exerciseIds = Array.isArray(payload.exerciseIds) ? payload.exerciseIds : [];
  if (exerciseIds.length === 0) throw invalidProposal('exerciseIds vacío');
  for (const raw of exerciseIds) {
    const id = typeof raw === 'string' ? raw : '';
    if (!id) continue;
    await deleteDoc(workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'exercises', id));
  }
}
```

- [ ] **Step 2: Entries en `proposalHandlers`:**

```typescript
  update_exercise: handleUpdateExercise,
  delete_exercise: handleDeleteExercise,
  delete_exercises: handleDeleteExercises,
```

### Task 5.5: Smoke + commit

- [ ] **Step 1: Smoke: editar un ejercicio + borrar uno + borrar 2 a la vez.**

- [ ] **Step 2: Commit.**

```bash
git add functions/src/shared/pickContracts.ts \
  functions/src/ai/tools/writeTools.ts \
  functions/src/ai/tools/__tests__/writeTools.test.ts \
  src/services/proposalExecutor.ts
git commit -m "feat(ai): propose_update_exercise + delete_exercise(s) (sub-C.4)"
```

---

## PR 6 — C.5: `propose_delete_bracket`

**Goal:** Pick puede borrar un cuadro de playoffs. Operación destructiva fuerte (borra toda la estructura del bracket).

**Files:** mismo pattern.

### Task 6.1: Union + test

- [ ] **Step 1: Añadir `'delete_bracket'` al union.**

- [ ] **Step 2: Test:**

```typescript
describe('propose_delete_bracket', () => {
  it('returns delete_bracket kind', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_bracket');
    const result = await tool!.handler(
      { bracketId: 'br_1', summary: 'Borrar bracket cerrado' },
      buildCtx(buildMockDb([])),
    );
    expect(result).toMatchObject({ kind: 'delete_bracket', bracketId: 'br_1' });
  });

  it('uses screen context bracketId', async () => {
    const tools = createWriteTools();
    const tool = tools.find((t) => t.name === 'propose_delete_bracket');
    const result = await tool!.handler({ summary: 's' }, buildCtx(buildMockDb([]), { bracketId: 'br-ctx' }));
    expect((result as { bracketId: string }).bracketId).toBe('br-ctx');
  });
});
```

### Task 6.2: Implementar

- [ ] **Step 1: Añadir tool:**

```typescript
{
  name: "propose_delete_bracket",
  description:
    "Propone borrar un cuadro de playoffs completo. Acción muy destructiva — borra estructura, scores y referencias. bracketId se infiere de la pantalla si el coach está viendo un cuadro. summary debe ser explícito.",
  isWrite: true,
  parameters: {
    type: "object",
    properties: {
      bracketId: { type: "string" },
      summary: { type: "string" },
    },
    required: ["summary"],
  },
  handler: async (args, ctx) => {
    const bracketId = resolveId(args, ctx, "bracketId");
    if (!bracketId) return { error: "Falta bracketId." };
    const summary = typeof args.summary === "string" ? args.summary : "";
    if (!summary) return { error: "Falta summary." };
    return { kind: "delete_bracket", bracketId, summary };
  },
},
```

- [ ] **Step 2: Run tests → PASS.**

### Task 6.3: Frontend executor

- [ ] **Step 1: Añadir handler:**

```typescript
async function handleDeleteBracket(ctx: ExecuteContext, payload: ProposalPayload) {
  const bracketId = typeof payload.bracketId === 'string' ? payload.bracketId : undefined;
  if (!bracketId) throw invalidProposal('falta bracketId');
  await deleteDoc(workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'brackets', bracketId));
}
```

- [ ] **Step 2: Entry en `proposalHandlers`:**

```typescript
  delete_bracket: handleDeleteBracket,
```

### Task 6.4: Smoke + commit

- [ ] **Step 1: Smoke: pedir "borra el cuadro de copa", confirmar.**

- [ ] **Step 2: Commit.**

```bash
git add functions/src/shared/pickContracts.ts \
  functions/src/ai/tools/writeTools.ts \
  functions/src/ai/tools/__tests__/writeTools.test.ts \
  src/services/proposalExecutor.ts
git commit -m "feat(ai): propose_delete_bracket (sub-C.5)"
```

---

## PR 7 — C.6: Eval scores agregados

**Goal:** Añadir 2 scores nuevos al `AutoEvaluator` para medir cobertura de los tools de sub-C.

**Files:**

- Modify: `functions/src/ai/evaluators.ts`
- Modify: `functions/src/ai/__tests__/evaluators.test.ts`

### Task 7.1: Identificar AutoEvaluator existente

- [ ] **Step 1: Leer `functions/src/ai/evaluators.ts` para ver el shape actual de scores.** Pattern típico: cada score es `{ name, value, comment? }`.

### Task 7.2: Score `action-close-loop`

- [ ] **Step 1: Añadir cómputo: para cada turno donde el orchestrator emitió un block `convocatoria_preview`, verificar si en los siguientes 2 turnos del coach (input) hay un trigger que sugiere "ya mandé" y Pick propuso `mark_convocatoria_sent`. Score = 1 si sí, 0 si no.**

```typescript
function computeActionCloseLoopScore(turns: Turn[]): EvaluatorScore {
  let opportunities = 0;
  let closed = 0;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (!turnHasBlockType(turn, 'convocatoria_preview')) continue;
    opportunities++;
    for (let j = i + 1; j < Math.min(i + 3, turns.length); j++) {
      if (turnHasProposalKind(turns[j], 'mark_convocatoria_sent')) {
        closed++;
        break;
      }
    }
  }
  return {
    name: 'action-close-loop',
    value: opportunities === 0 ? null : closed / opportunities,
    comment: `${closed}/${opportunities} convocatoria→sent closures`,
  };
}
```

### Task 7.3: Score `update-delete-offered`

- [ ] **Step 1: Detectar turnos donde el coach pide editar/borrar (regex sobre intent: `\b(cambia|edita|modifica|borra|elimina|quita)\b`). Si Pick respondió con un `propose_update_*` o `propose_delete_*` → 1. Si dijo "no puedo" → 0.**

```typescript
function computeUpdateDeleteOfferedScore(turns: Turn[]): EvaluatorScore {
  const editIntent = /\b(cambia|edita|modifica|borra|elimina|quita)\b/i;
  let opportunities = 0;
  let offered = 0;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role !== 'user') continue;
    if (!editIntent.test(t.text || '')) continue;
    opportunities++;
    const reply = turns[i + 1];
    if (!reply) continue;
    const kind = extractProposalKind(reply);
    if (kind && (kind.startsWith('update_') || kind.startsWith('delete_'))) {
      offered++;
    }
  }
  return {
    name: 'update-delete-offered',
    value: opportunities === 0 ? null : offered / opportunities,
    comment: `${offered}/${opportunities} edit/delete intents met with proposal`,
  };
}
```

### Task 7.4: Tests + commit

- [ ] **Step 1: Añadir tests con fixtures concretos (turnos sintéticos) que cubren ambos scores.**

- [ ] **Step 2: Run tests → PASS.**

```bash
npx vitest run functions/src/ai/__tests__/evaluators.test.ts
```

- [ ] **Step 3: Commit.**

```bash
git add functions/src/ai/evaluators.ts functions/src/ai/__tests__/evaluators.test.ts
git commit -m "feat(ai): eval scores action-close-loop + update-delete-offered (sub-C.6)"
```

---

## PR 8 — C.7: Docs + memoria de cierre

**Goal:** Documentar sub-C en CLAUDE.md y cerrar el ciclo de memoria.

**Files:**

- Modify: `CLAUDE.md`
- Memoria: archivo nuevo `project_subproyecto_C_status.md`
- Memoria: actualizar `MEMORY.md` index

### Task 8.1: CLAUDE.md update

- [ ] **Step 1: Añadir bloque dentro de la sección "Pick conversational layer" (después del bloque de sub-B) — sub-C completion description.**

Pattern del bloque (mirar sub-B en CLAUDE.md como template). Cubrir:

- 9 tools nuevos por sub-fase
- Pattern uniforme (4 sitios)
- Layer 3 deferido + criterios cuantitativos

### Task 8.2: Memoria de cierre

- [ ] **Step 1: Crear `~/.claude/projects/.../memory/project_subproyecto_C_status.md`** siguiendo el template de `project_subproyecto_B_status.md`.

Cubrir: PRs cerrados, decisiones autónomas, deferred items, criterios de re-evaluación.

- [ ] **Step 2: Añadir entrada en `MEMORY.md` index.**

### Task 8.3: Commit

```bash
git add CLAUDE.md
git commit -m "docs(ai): sub-C cerrado funcionalmente (C.7)"
```

---

## Self-review checklist (a ejecutar tras escribir el plan)

- [ ] Cada PR tiene tools nuevos declarados ↔ entries en union ↔ entries en proposalHandlers ↔ tests
- [ ] No quedan TODOs / TBDs en el plan
- [ ] Pattern de "4 sitios" documentado una vez al principio, no repetido en cada PR
- [ ] Type names consistentes (WriteProposalKind, ProposalPayload, etc.)
- [ ] Commit messages siguen formato `feat(ai): ... (sub-C.N)`
- [ ] PR 1 (C.0) entra antes que cualquier feature para tener métricas baseline
- [ ] PR 7 (C.6) requiere PRs 2-6 mergeados (los scores miden los kinds añadidos)
- [ ] PR 8 (C.7) es último (docs reflejan el resultado final)
