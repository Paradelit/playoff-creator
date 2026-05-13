# Sub-proyecto B — Paridad conversacional + proactividad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el contexto rico de sub-A en conversación real: multi-turn coherente (compresión topic-aware), desambiguación activa pre-LLM, voz consistente (system prompt redesign ya shipped en B.1), proactividad medible (engine que emite mensajes basados en `pendingActions` + `anomalies`), y fallbacks útiles.

**Architecture:** 4 capas paralelas a las 4 de sub-A. Layer 1 (system prompt) ya shipped en B.1 (PR #57). Layer 2 = `compressHistoryV2` (topic chunks + summarización LLM-asistida con cache Firestore). Layer 3 = `AmbiguityClassifier` pre-orchestrator (regex primero, LLM fallback) que emite `confirm_choice` block si detecta >1 candidato. Layer 4 = `ProactiveEngine` que decide qué emitir al abrir Pick basándose en digest pendings.

**Tech Stack:** TypeScript + Firebase Cloud Functions v2 + Firestore Admin + Vitest + Gemini fast/capable chain + React 19. Sin SDKs nuevos.

**Spec:** `docs/superpowers/specs/2026-05-13-sub-proyecto-B-paridad-conversacional-design.md`

**Estado actual:**

- ✅ B.1 — system prompt redesign (PR #57) ya live.
- ⏳ B.0 — instrumentación específica de B: se folda en las features (no PR independiente).
- ⏳ B.2 — compressHistory v2.
- ⏳ B.3 — AmbiguityClassifier heurístico (regex).
- ⏳ B.4 — AmbiguityClassifier LLM-assisted.
- ⏳ B.5 — ProactiveEngine.
- ⏳ B.6 — Frontend blocks (`confirm_choice` + `proactive_card`).
- ⏳ B.7 — Eval cases multi-turn + ambiguity + proactive.
- ⏳ B.8 — Docs CLAUDE.md.

**PR breakdown (7 PRs restantes):**

| PR  | Fases     | Foco                                                  | Risk |
| --- | --------- | ----------------------------------------------------- | ---- |
| 1   | B.2       | compressHistoryV2 (topic-aware + LLM summary + cache) | med  |
| 2   | B.3       | AmbiguityClassifier regex + confirm_choice block      | med  |
| 3   | B.4       | AmbiguityClassifier LLM fallback                      | med  |
| 4   | B.5 (a)   | ProactiveEngine backend (priorización + scoring)      | high |
| 5   | B.5 (b)   | ProactiveEngine onOpen integration + dismissals       | high |
| 6   | B.6       | Frontend: ConfirmChoice + ProactiveCard render        | med  |
| 7   | B.7 + B.8 | Multi-turn evals + docs                               | low  |

---

## File Structure

### Backend (`functions/`)

```
functions/src/ai/
  history/
    compressHistoryV2.ts          # NEW — topic-aware compression
    summarizer.ts                 # NEW — LLM-asistido para resúmenes de chunks
    cache.ts                      # NEW — Firestore-backed cache por (conversationId, turnIndex)
    __tests__/
      compressHistoryV2.test.ts
      summarizer.test.ts
      cache.test.ts
  ambiguity/
    types.ts                      # NEW — AmbiguityResult, AmbiguityCandidate
    classifier.ts                 # NEW — entrypoint (regex first, LLM fallback)
    heuristics.ts                 # NEW — regex rules + scoping checks
    llmClassifier.ts              # NEW — fast-model classification
    __tests__/
      heuristics.test.ts
      llmClassifier.test.ts
      classifier.test.ts
  proactive/
    types.ts                      # NEW — ProactiveMessage, ProactiveTrigger
    priorizer.ts                  # NEW — ranks pendings + anomalies
    engine.ts                     # NEW — decide() entry; consulta dismissals
    dismissals.ts                 # NEW — read/write users/{uid}/.../proactive
    __tests__/
      priorizer.test.ts
      engine.test.ts
      dismissals.test.ts
  agents/
    orchestratorAgent.ts          # MODIFY — usa compressHistoryV2 + checks ambiguity
  contentBlocks.ts                # MODIFY — añade ConfirmChoiceBlock + ProactiveCardBlock
  __tests__/
    orchestrator.test.ts          # MODIFY — cubre rama ambiguity + nueva compresión
```

### Frontend (`src/`)

```
src/
  components/pick/blocks/
    ConfirmChoice.jsx             # NEW — render de confirm_choice
    ProactiveCard.jsx             # NEW — render de proactive_card
  components/pick/
    PickPanel.jsx                 # MODIFY — case branches para los 2 blocks
    PickColumn.jsx                # MODIFY — idem
  hooks/
    usePick.js                    # MODIFY — handle proactive_card al abrir
    usePickTips.js                # MODIFY — backoff-aware, consume backend proactive
```

### Firestore

```
firestore.rules                   # MODIFY — reglas para historySummaries/{conversationId} + proactiveDismissals
```

---

## PR 1 — B.2: compressHistoryV2 (topic-aware compression con caché)

**Goal:** Reemplazar `compressConversationHistory` flat (líneas truncadas a 130 chars) por compresión topic-aware: agrupa turnos antiguos por chunks de tema/entidad, resume cada chunk en 1-2 frases vía LLM fast, cachea por `(conversationId, turn-end-index)` para no re-resumir.

**Spec ref:** Layer 2 del sub-B design.

**Files:**

- Create: `functions/src/ai/history/compressHistoryV2.ts`
- Create: `functions/src/ai/history/summarizer.ts`
- Create: `functions/src/ai/history/cache.ts`
- Create: `functions/src/ai/history/__tests__/compressHistoryV2.test.ts`
- Create: `functions/src/ai/history/__tests__/summarizer.test.ts`
- Create: `functions/src/ai/history/__tests__/cache.test.ts`
- Modify: `functions/src/ai/agents/orchestratorAgent.ts` (sustituye compressConversationHistory)
- Modify: `firestore.rules` (regla para `historySummaries`)

### Task 1.1: Cache get/set para resúmenes

**Goal:** Capa de persistencia simple. `getCachedSummary(deps, key)` devuelve string o null; `setCachedSummary(deps, key, summary)` persiste. Llave = `${conversationId}:${turnEndIndex}`.

- [ ] **Step 1: Write failing test**

```ts
// functions/src/ai/history/__tests__/cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getCachedSummary, setCachedSummary } from '../cache';

function makeMockDb() {
  const store = new Map<string, Record<string, unknown>>();
  const doc = (path: string) => ({
    get: vi.fn(async () => ({ exists: store.has(path), data: () => store.get(path) })),
    set: vi.fn(async (data: Record<string, unknown>) => {
      store.set(path, data);
    }),
  });
  return {
    doc,
    collection: () => ({
      doc: (id: string) => doc(`collection/${id}`),
    }),
  };
}

describe('history cache', () => {
  it('returns null when summary not cached', async () => {
    const db: any = {
      collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
    };
    const result = await getCachedSummary({ db, appId: 'a', wsId: 'w', userId: 'u' }, 'conv1:5');
    expect(result).toBeNull();
  });

  it('returns cached summary text when present', async () => {
    const db: any = {
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ summary: 'resumen previo' }) }),
        }),
      }),
    };
    const result = await getCachedSummary({ db, appId: 'a', wsId: 'w', userId: 'u' }, 'conv1:5');
    expect(result).toBe('resumen previo');
  });

  it('setCachedSummary persists with TTL field', async () => {
    const setSpy = vi.fn(async () => undefined);
    const db: any = {
      collection: () => ({
        doc: () => ({ set: setSpy }),
      }),
    };
    await setCachedSummary({ db, appId: 'a', wsId: 'w', userId: 'u' }, 'conv1:5', 'nuevo');
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ summary: 'nuevo', createdAt: expect.anything() }));
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```powershell
cd functions; npm test -- history/cache --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// functions/src/ai/history/cache.ts
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

export interface CacheDeps {
  db: Firestore;
  appId: string;
  wsId: string;
  userId: string;
}

interface HistorySummaryDoc {
  summary: string;
  createdAt: Timestamp;
}

function summaryRef(deps: CacheDeps, key: string) {
  return deps.db
    .collection('artifacts')
    .doc(deps.appId)
    .collection('users')
    .doc(deps.userId)
    .collection('historySummaries')
    .doc(`${deps.wsId}__${key.replace(/:/g, '__')}`);
}

export async function getCachedSummary(deps: CacheDeps, key: string): Promise<string | null> {
  const snap = await summaryRef(deps, key).get();
  if (!snap.exists) return null;
  const data = snap.data() as HistorySummaryDoc | undefined;
  return data?.summary ?? null;
}

export async function setCachedSummary(deps: CacheDeps, key: string, summary: string): Promise<void> {
  await summaryRef(deps, key).set({ summary, createdAt: Timestamp.now() });
}
```

- [ ] **Step 4: Run test, expect pass**

```powershell
cd functions; npm test -- history/cache --run
```

- [ ] **Step 5: Commit**

```powershell
git add functions/src/ai/history/cache.ts functions/src/ai/history/__tests__/cache.test.ts
git commit -m "feat(ai): Firestore-backed cache for history summaries (sub-B.2)"
```

### Task 1.2: Summarizer LLM-asistido

**Goal:** `summarizeChunk(deps, turns)` toma un array de turnos consecutivos sobre un mismo topic y devuelve 1-2 frases. Usa LLM fast model. Devuelve `null` si la llamada falla (caller decide fallback flat).

- [ ] **Step 1: Write failing test**

```ts
// functions/src/ai/history/__tests__/summarizer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { summarizeChunk } from '../summarizer';

const mkLlm = (text: string) => ({
  generateContent: vi.fn(async () => ({ text })),
});

describe('summarizeChunk', () => {
  it('returns trimmed text from LLM response', async () => {
    const llm: any = mkLlm('  Coach pidió convocatoria de Cadete A; enviada.  ');
    const out = await summarizeChunk({ llm }, [
      { role: 'user', content: 'haz la convocatoria del Cadete A' },
      { role: 'assistant', content: 'Hecho.' },
    ]);
    expect(out).toBe('Coach pidió convocatoria de Cadete A; enviada.');
  });

  it('returns null when LLM throws', async () => {
    const llm: any = {
      generateContent: vi.fn(async () => {
        throw new Error('503');
      }),
    };
    const out = await summarizeChunk({ llm }, [{ role: 'user', content: 'hola' }]);
    expect(out).toBeNull();
  });

  it('returns null when LLM returns empty', async () => {
    const llm: any = mkLlm('   ');
    const out = await summarizeChunk({ llm }, [{ role: 'user', content: 'hola' }]);
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect fail**

- [ ] **Step 3: Implement**

```ts
// functions/src/ai/history/summarizer.ts
import type { LLMProvider } from '../llmProvider';

export interface SummarizerDeps {
  llm: Pick<LLMProvider, 'generateContent'>;
}

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM = `Resume esta porción de conversación entre un entrenador de baloncesto y su copiloto Pick.
- 1-2 frases máximo.
- Preserva entidades (equipos, jugadores, fechas, partidos) explícitamente.
- Tiempo pasado: lo que ya se hizo / mencionó.
- No añadas detalles que no estén en la conversación.`;

export async function summarizeChunk(deps: SummarizerDeps, turns: HistoryTurn[]): Promise<string | null> {
  if (turns.length === 0) return null;
  const userText = turns.map((t) => `${t.role === 'user' ? 'U' : 'A'}: ${t.content}`).join('\n');
  try {
    const resp = await deps.llm.generateContent({
      model: 'fast',
      systemInstruction: SYSTEM,
      contents: [{ role: 'user', parts: [{ text: userText }] }],
    });
    const trimmed = (resp.text || '').trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
```

> Nota: si la firma de `LLMProvider.generateContent` no acepta `model: "fast"` literalmente, ajustar a la API real del proveedor (probablemente `pickModel({ complexity: "fast" })` o equivalente). Resolver durante implementación inspeccionando `functions/src/ai/llmProvider.ts`.

- [ ] **Step 4: Run test, expect pass**

- [ ] **Step 5: Commit**

```powershell
git add functions/src/ai/history/summarizer.ts functions/src/ai/history/__tests__/summarizer.test.ts
git commit -m "feat(ai): LLM-assisted chunk summarizer for history (sub-B.2)"
```

### Task 1.3: Topic-chunking + flat fallback

**Goal:** `compressHistoryV2(deps, history)` toma toda la historia, deja los últimos 6 verbatim, agrupa los anteriores en chunks por overlapping de entidades (jugador/equipo/sesión mencionada), resume cada chunk via summarizer, junta resúmenes en un solo bracketed context turn. Si el summarizer devuelve null para un chunk, fallback a la línea flat (130 chars).

- [ ] **Step 1: Write failing test**

```ts
// functions/src/ai/history/__tests__/compressHistoryV2.test.ts
import { describe, it, expect, vi } from 'vitest';
import { compressHistoryV2 } from '../compressHistoryV2';

const noopCache = {
  getCachedSummary: async () => null,
  setCachedSummary: async () => undefined,
};

describe('compressHistoryV2', () => {
  it('returns history verbatim when length <= 6', async () => {
    const history = Array.from({ length: 4 }, (_, i) => ({
      role: 'user' as const,
      content: `msg ${i}`,
    }));
    const out = await compressHistoryV2(
      {
        llm: {} as any,
        cache: noopCache as any,
        conversationId: 'c1',
        cacheDeps: {} as any,
      },
      history,
    );
    expect(out).toEqual(history);
  });

  it('keeps last 6 verbatim + 1 summary turn when > 6', async () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
    }));
    const llm = { generateContent: vi.fn(async () => ({ text: 'chunk resumen' })) };
    const out = await compressHistoryV2(
      {
        llm: llm as any,
        cache: noopCache as any,
        conversationId: 'c1',
        cacheDeps: {} as any,
      },
      history,
    );
    expect(out.length).toBeLessThanOrEqual(7); // 1 contexto + 6 recientes
    expect(out[0].content).toContain('[Contexto previo]');
    expect(out[0].content).toContain('chunk resumen');
    expect(out.slice(1)).toEqual(history.slice(-6));
  });

  it('uses cached summary if available (no LLM call)', async () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
    }));
    const llm = { generateContent: vi.fn() };
    const cache = {
      getCachedSummary: vi.fn(async () => 'resumen cached'),
      setCachedSummary: vi.fn(),
    };
    const out = await compressHistoryV2(
      {
        llm: llm as any,
        cache: cache as any,
        conversationId: 'c1',
        cacheDeps: {} as any,
      },
      history,
    );
    expect(llm.generateContent).not.toHaveBeenCalled();
    expect(out[0].content).toContain('resumen cached');
  });

  it('falls back to flat line when summarizer returns null', async () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
    }));
    const llm = {
      generateContent: vi.fn(async () => {
        throw new Error('503');
      }),
    };
    const out = await compressHistoryV2(
      {
        llm: llm as any,
        cache: noopCache as any,
        conversationId: 'c1',
        cacheDeps: {} as any,
      },
      history,
    );
    // Debe contener "U: msg 0" tipo flat fallback
    expect(out[0].content).toMatch(/U: msg 0/);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

- [ ] **Step 3: Implement**

```ts
// functions/src/ai/history/compressHistoryV2.ts
import type { LLMProvider } from '../llmProvider';
import type { CacheDeps } from './cache';
import { getCachedSummary, setCachedSummary } from './cache';
import { summarizeChunk, HistoryTurn } from './summarizer';

const RECENT_KEEP = 6;
const CHUNK_TARGET_SIZE = 4; // hasta 4 turnos por chunk antes de cortar

export interface CompressDeps {
  llm: Pick<LLMProvider, 'generateContent'>;
  cache: {
    getCachedSummary: typeof getCachedSummary;
    setCachedSummary: typeof setCachedSummary;
  };
  cacheDeps: CacheDeps;
  conversationId: string;
}

/**
 * Heurística simple de chunking: agrupa turnos consecutivos hasta CHUNK_TARGET_SIZE.
 * En el futuro: detectar cambios de entidad mediante simple regex sobre nombres
 * propios. Por ahora, sliding window es suficiente.
 */
function chunkifyOlder(older: HistoryTurn[]): HistoryTurn[][] {
  const chunks: HistoryTurn[][] = [];
  for (let i = 0; i < older.length; i += CHUNK_TARGET_SIZE) {
    chunks.push(older.slice(i, i + CHUNK_TARGET_SIZE));
  }
  return chunks;
}

function flatLine(turn: HistoryTurn): string {
  const label = turn.role === 'user' ? 'U' : 'A';
  const excerpt = turn.content.replace(/\n/g, ' ').substring(0, 130);
  return `${label}: ${excerpt}${turn.content.length > 130 ? '…' : ''}`;
}

export async function compressHistoryV2(deps: CompressDeps, history: HistoryTurn[]): Promise<HistoryTurn[]> {
  if (history.length <= RECENT_KEEP) return history;

  const older = history.slice(0, history.length - RECENT_KEEP);
  const recent = history.slice(history.length - RECENT_KEEP);
  const chunks = chunkifyOlder(older);

  const summaries: string[] = [];
  let chunkStartIdx = 0;
  for (const chunk of chunks) {
    const chunkEndIdx = chunkStartIdx + chunk.length;
    const cacheKey = `${deps.conversationId}:${chunkEndIdx}`;
    let summary = await deps.cache.getCachedSummary(deps.cacheDeps, cacheKey);
    if (summary === null) {
      summary = await summarizeChunk({ llm: deps.llm }, chunk);
      if (summary !== null) {
        await deps.cache.setCachedSummary(deps.cacheDeps, cacheKey, summary);
      }
    }
    if (summary === null) {
      // Fallback flat
      summaries.push(chunk.map(flatLine).join('\n'));
    } else {
      summaries.push(summary);
    }
    chunkStartIdx = chunkEndIdx;
  }

  const contextTurn: HistoryTurn = {
    role: 'user',
    content: `[Contexto previo]\n${summaries.map((s, i) => `${i + 1}) ${s}`).join('\n')}`,
  };

  return [contextTurn, ...recent];
}
```

- [ ] **Step 4: Run test, expect pass**

- [ ] **Step 5: Commit**

```powershell
git add functions/src/ai/history/compressHistoryV2.ts functions/src/ai/history/__tests__/compressHistoryV2.test.ts
git commit -m "feat(ai): topic-aware history compression v2 with cache + flat fallback (sub-B.2)"
```

### Task 1.4: Wire en orchestratorAgent

**Goal:** Sustituir la llamada a `compressConversationHistory` por `compressHistoryV2` con sus dependencias inyectadas.

- [ ] **Step 1: Localizar la llamada y firmar dependencia**

```ts
// functions/src/ai/agents/orchestratorAgent.ts
// Añadir al top:
import { compressHistoryV2 } from '../history/compressHistoryV2';
import * as historyCache from '../history/cache';
```

- [ ] **Step 2: Modificar `run()` para usar la v2**

En la línea ~158 donde está:

```ts
const compressedHistory = compressConversationHistory(input.conversationHistory || []);
```

Sustituir por:

```ts
const compressedHistory = await compressHistoryV2(
  {
    llm: this.deps.llm,
    cache: historyCache,
    cacheDeps: {
      db: this.deps.db,
      appId: input.appId,
      wsId: input.wsId,
      userId: input.userId,
    },
    conversationId: input.conversationId || 'default',
  },
  input.conversationHistory || [],
);
```

> Nota: si `input` no expone `appId`/`wsId`/`userId`/`conversationId`, propagarlos vía el tipo `AgentExecutionOptions` o desde un campo equivalente. Verificar durante impl.

- [ ] **Step 3: Tests de regresión de orchestrator pasan**

```powershell
cd functions; npm test -- orchestrator --run
```

- [ ] **Step 4: Borrar la antigua `compressConversationHistory`** si ningún otro caller la usa.

```powershell
cd functions; npm run lint -- src/ai/agents/orchestratorAgent.ts
```

- [ ] **Step 5: Commit**

```powershell
git add functions/src/ai/agents/orchestratorAgent.ts
git commit -m "feat(ai): orchestrator uses compressHistoryV2 (sub-B.2 wire-up)"
```

### Task 1.5: Firestore rules para historySummaries

- [ ] **Step 1: Añadir regla en firestore.rules**

```
match /artifacts/{appId}/users/{uid}/historySummaries/{summaryId} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false; // sólo backend escribe
}
```

- [ ] **Step 2: Run rules tests si existen**

```powershell
npx vitest run firestore.rules.test.ts
```

- [ ] **Step 3: Commit**

```powershell
git add firestore.rules
git commit -m "feat(rules): historySummaries read-by-owner, backend-only writes (sub-B.2)"
```

### Task 1.6: Métrica baseline `history_compression_ms`

- [ ] **Step 1: Test**

```ts
// dentro de orchestrator.test.ts, añadir
it('logs history_compression_ms score when history > 6 turns', async () => {
  const logScore = vi.fn();
  // arrange orchestrator con observability.logScore = logScore, history.length = 10
  // run
  expect(logScore).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      name: 'history_compression_ms',
    }),
  );
});
```

- [ ] **Step 2: Implementar** — wrap el call a compressHistoryV2 en perf timing y emit score.

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat(ai): track history_compression_ms baseline (sub-B.0)"
```

### Task 1.7: Open PR

```powershell
git checkout -b sub-b-compress-history-v2
git push -u origin sub-b-compress-history-v2
gh pr create --title "feat(ai): topic-aware history compression v2 with LLM summary + cache (sub-B.2)" --body "$(cat <<'EOF'
## Summary
- compressHistoryV2: chunkifica turnos antiguos, resume cada chunk vía LLM fast, cachea por conversationId+turnIndex.
- Fallback flat (130 chars) si summarizer falla o devuelve vacío.
- Firestore rules para historySummaries (read-by-owner, backend-only writes).
- Métrica history_compression_ms para baseline.

## Test plan
- [x] Vitest verde en functions/.
- [ ] Smoke manual: abrir conversación >6 turnos, verificar que el system prompt incluye `[Contexto previo]` con resúmenes coherentes.
- [ ] Comprobar Firestore `historySummaries/` se llena.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 2 — B.3: AmbiguityClassifier regex + confirm_choice block

**Goal:** Pre-LLM step que detecta cuando el mensaje del coach tiene >1 interpretación plausible dado el digest. Si es ambiguo, emite directamente un `confirm_choice` block sin pasar por el LLM caro. Si no, sigue al orchestrator normal.

**Spec ref:** Layer 3 del sub-B design (heurística inicial sin LLM).

**Files:**

- Create: `functions/src/ai/ambiguity/types.ts`
- Create: `functions/src/ai/ambiguity/heuristics.ts`
- Create: `functions/src/ai/ambiguity/classifier.ts`
- Create: `functions/src/ai/ambiguity/__tests__/heuristics.test.ts`
- Create: `functions/src/ai/ambiguity/__tests__/classifier.test.ts`
- Modify: `functions/src/ai/contentBlocks.ts` (añade `ConfirmChoiceBlock`)
- Modify: `functions/src/ai/agents/orchestratorAgent.ts` (llama classifier antes del run)
- Modify: `functions/src/ai/__tests__/orchestrator.test.ts`

### Task 2.1: AmbiguityResult type + ConfirmChoiceBlock

- [ ] **Step 1: Create types**

```ts
// functions/src/ai/ambiguity/types.ts
export type AmbiguityKind = 'clear' | 'ambiguous' | 'out-of-scope';

export interface AmbiguityCandidate {
  id: string;
  label: string;
  kind: 'team' | 'session' | 'player' | 'bracket' | 'other';
}

export interface AmbiguityResult {
  kind: AmbiguityKind;
  // For ambiguous:
  candidates?: AmbiguityCandidate[];
  clarification?: string;
  // For out-of-scope:
  reason?: string;
  suggestedAlternative?: string;
}
```

- [ ] **Step 2: Add ConfirmChoiceBlock type**

```ts
// functions/src/ai/contentBlocks.ts (append)
export interface ConfirmChoiceBlock {
  type: 'confirm_choice';
  prompt: string;
  candidates: Array<{ id: string; label: string; kind: string }>;
  /** Lo que el LLM debería re-procesar si el usuario elige una opción. */
  intent: string;
}
```

Y añadir al union `ContentBlock`.

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat(ai): AmbiguityResult types + ConfirmChoiceBlock"
```

### Task 2.2: Heurística regex para "del partido" / "este equipo"

- [ ] **Step 1: Test**

```ts
// __tests__/heuristics.test.ts
import { detectAmbiguity } from '../heuristics';
import type { UserDigest } from '../../digest/types';

const baseDigest = (overrides: Partial<UserDigest> = {}): UserDigest => ({
  todayISO: '2026-05-13',
  todayLocalDayOfWeek: 'miércoles',
  workspace: { id: 'w', name: 'Test', type: 'personal', userRole: 'owner' },
  teams: [],
  activeBrackets: [],
  upcomingSessions: [],
  recentPastSessions: [],
  pendingActions: { convocatorias: [], analyses: [], scoutings: [], playerReports: [] },
  anomalies: [],
  preferences: {},
  memories: [],
  ...overrides,
});

describe('detectAmbiguity heuristics', () => {
  it("flags 'del partido' as ambiguous when >1 upcoming partido", () => {
    const digest = baseDigest({
      upcomingSessions: [
        { id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A', rival: 'Hispano' },
        { id: 's2', fecha: '2026-05-17', tipo: 'partido', teamName: 'Juniors B', rival: 'Olímpico' },
      ],
    });
    const out = detectAmbiguity('mándame la convocatoria del partido', digest, null);
    expect(out.kind).toBe('ambiguous');
    expect(out.candidates).toHaveLength(2);
  });

  it('returns clear when only 1 upcoming partido (assumes that one)', () => {
    const digest = baseDigest({
      upcomingSessions: [{ id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A' }],
    });
    const out = detectAmbiguity('mándame la convocatoria del partido', digest, null);
    expect(out.kind).toBe('clear');
  });

  it("resolves 'este equipo' via screenSemantic.referableIds", () => {
    const digest = baseDigest({
      teams: [
        { id: 't1', name: 'Cadete A', memberCount: 12 },
        { id: 't2', name: 'Juniors B', memberCount: 14 },
      ],
    });
    const screen = {
      semantic: {
        surface: 'team-detail',
        label: 'Viendo Cadete A',
        referableIds: { 'este equipo': 't1' },
      },
    };
    const out = detectAmbiguity('muéstrame los jugadores de este equipo', digest, screen as any);
    expect(out.kind).toBe('clear');
  });

  it("flags 'este equipo' as ambiguous when no screen semantic available", () => {
    const digest = baseDigest({
      teams: [
        { id: 't1', name: 'Cadete A', memberCount: 12 },
        { id: 't2', name: 'Juniors B', memberCount: 14 },
      ],
    });
    const out = detectAmbiguity('muéstrame los jugadores de este equipo', digest, null);
    expect(out.kind).toBe('ambiguous');
  });

  it('flags out-of-scope topics (balance, finanzas, suscripción)', () => {
    const out = detectAmbiguity('dame el balance financiero del trimestre', baseDigest(), null);
    expect(out.kind).toBe('out-of-scope');
  });
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

```ts
// functions/src/ai/ambiguity/heuristics.ts
import type { UserDigest } from '../digest/types';
import type { ScreenContextData } from '../types';
import type { AmbiguityResult, AmbiguityCandidate } from './types';

const PATTERNS_PARTIDO = [
  /\b(del?|al|este|ese)\s+partido\b/i,
  /\bla\s+convocatoria\b(?!\s+(?:del|de\s+(?:el|la|los|las)\s+|para))/i,
];

const PATTERNS_EQUIPO = [/\b(este|ese|el)\s+equipo\b/i];

const PATTERNS_JUGADOR = [/\b(este|ese)\s+jugador\b/i];

const OUT_OF_SCOPE_TOPICS = [
  /\b(balance|presupuesto|finanzas|facturaci[oó]n|suscripci[oó]n|stripe|tarjeta\s+de\s+cr[eé]dito)\b/i,
  /\b(env[ií]ame\s+un\s+email|m[aá]ndame\s+un\s+sms|tw[ií]ttea)\b/i,
];

function partidoCandidates(digest: UserDigest): AmbiguityCandidate[] {
  return digest.upcomingSessions
    .filter((s) => s.tipo === 'partido')
    .map((s) => ({
      id: s.id,
      label:
        `${s.fecha}${s.horaInicio ? ` ${s.horaInicio}` : ''} ${s.teamName || ''}${s.rival ? ` vs ${s.rival}` : ''}`.trim(),
      kind: 'session' as const,
    }));
}

function teamCandidates(digest: UserDigest): AmbiguityCandidate[] {
  return digest.teams.map((t) => ({ id: t.id, label: t.name, kind: 'team' as const }));
}

export function detectAmbiguity(
  message: string,
  digest: UserDigest,
  screen: ScreenContextData | null,
): AmbiguityResult {
  // 1. Out-of-scope
  for (const pat of OUT_OF_SCOPE_TOPICS) {
    if (pat.test(message)) {
      return {
        kind: 'out-of-scope',
        reason: 'Pick no puede acceder a datos financieros ni enviar mensajes externos.',
        suggestedAlternative: 'Te puedo ayudar con entrenamientos, partidos, jugadores y brackets.',
      };
    }
  }

  // 2. "este equipo" — referableIds primero
  if (PATTERNS_EQUIPO.some((p) => p.test(message))) {
    const referableId = screen?.semantic?.referableIds?.['este equipo'];
    if (referableId) return { kind: 'clear' };
    const cands = teamCandidates(digest);
    if (cands.length > 1) {
      return {
        kind: 'ambiguous',
        clarification: '¿De qué equipo hablas?',
        candidates: cands,
      };
    }
  }

  // 3. "este jugador" — solo referableIds (no podemos listar todos en clarification)
  if (PATTERNS_JUGADOR.some((p) => p.test(message))) {
    const referableId = screen?.semantic?.referableIds?.['este jugador'];
    if (referableId) return { kind: 'clear' };
    return {
      kind: 'ambiguous',
      clarification: '¿De qué jugador hablas? Dime el equipo y el dorsal o nombre.',
      candidates: [],
    };
  }

  // 4. "del partido" / "la convocatoria"
  if (PATTERNS_PARTIDO.some((p) => p.test(message))) {
    const partidos = partidoCandidates(digest);
    if (partidos.length > 1) {
      return {
        kind: 'ambiguous',
        clarification: '¿De qué partido?',
        candidates: partidos,
      };
    }
  }

  return { kind: 'clear' };
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```powershell
git commit -m "feat(ai): regex-based ambiguity heuristics (sub-B.3)"
```

### Task 2.3: Classifier entrypoint

- [ ] **Step 1: Test**

```ts
// __tests__/classifier.test.ts
import { classifyAmbiguity } from '../classifier';
import { detectAmbiguity } from '../heuristics';
vi.mock('../heuristics');

it('delegates to detectAmbiguity heuristic in the regex-only build', async () => {
  (detectAmbiguity as any).mockReturnValue({ kind: 'clear' });
  const result = await classifyAmbiguity({ heuristicsOnly: true }, 'hola', {} as any, null);
  expect(result.kind).toBe('clear');
});
```

- [ ] **Step 2: Implement**

```ts
// functions/src/ai/ambiguity/classifier.ts
import type { UserDigest } from '../digest/types';
import type { ScreenContextData } from '../types';
import { detectAmbiguity } from './heuristics';
import type { AmbiguityResult } from './types';

export interface ClassifierDeps {
  heuristicsOnly?: boolean;
  // LLM fallback wires en B.4
}

export async function classifyAmbiguity(
  deps: ClassifierDeps,
  message: string,
  digest: UserDigest,
  screen: ScreenContextData | null,
): Promise<AmbiguityResult> {
  const heur = detectAmbiguity(message, digest, screen);
  if (deps.heuristicsOnly || heur.kind !== 'clear') return heur;
  // En B.4 — fallback al LLM si heurística no detectó nada raro
  return heur;
}
```

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat(ai): ambiguity classifier entrypoint (sub-B.3)"
```

### Task 2.4: Wire en orchestrator + emit confirm_choice block

- [ ] **Step 1: Test orchestrator**

```ts
// orchestrator.test.ts (append)
it('returns ConfirmChoice block when ambiguity detected, without LLM call', async () => {
  const llmSpy = vi.fn();
  const digest = baseDigest({
    upcomingSessions: [
      { id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A' },
      { id: 's2', fecha: '2026-05-17', tipo: 'partido', teamName: 'Juniors B' },
    ],
  });
  const orch = new OrchestratorAgent({ ...deps, llm: { generateContent: llmSpy } });
  const out = await orch.run({ message: 'mándame la convocatoria del partido', digest /* ... */ });
  expect(out.blocks.find((b) => b.type === 'confirm_choice')).toBeDefined();
  expect(llmSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement** — al inicio del orchestrator `run()`:

```ts
const ambResult = await classifyAmbiguity(
  { heuristicsOnly: true }, // LLM fallback se activa en B.4
  input.userMessage,
  digest,
  input.screenContext || null,
);
if (ambResult.kind === 'ambiguous') {
  if (traceId) {
    this.deps.observability.logScore(traceId, { name: 'ambiguity_detected', value: 1 });
  }
  return {
    blocks: [
      {
        type: 'confirm_choice',
        prompt: ambResult.clarification || '¿Cuál?',
        candidates: ambResult.candidates || [],
        intent: input.userMessage,
      },
    ],
    traceId,
  };
}
if (ambResult.kind === 'out-of-scope') {
  return {
    blocks: [
      {
        type: 'text',
        markdown: `${ambResult.reason} ${ambResult.suggestedAlternative || ''}`.trim(),
      },
    ],
    traceId,
  };
}
// kind === "clear" → continúa al flujo normal
```

- [ ] **Step 3: Tests pass + lint**

- [ ] **Step 4: Commit**

```powershell
git commit -m "feat(ai): orchestrator emits ConfirmChoice when ambiguity detected (sub-B.3)"
```

### Task 2.5: Open PR

```powershell
git checkout -b sub-b-ambiguity-regex
git push -u origin sub-b-ambiguity-regex
gh pr create --title "feat(ai): pre-LLM ambiguity detection + ConfirmChoice block (sub-B.3)" --body "..."
```

---

## PR 3 — B.4: AmbiguityClassifier LLM fallback

**Goal:** Si la heurística regex devuelve `clear` pero el mensaje del coach tiene >1 entidad plausible aún detectable por contexto semántico (no regex), llamar a un fast-model que clasifica. Threshold conservador para no perturbar el flujo cuando hay duda baja.

**Files:**

- Create: `functions/src/ai/ambiguity/llmClassifier.ts`
- Create: `functions/src/ai/ambiguity/__tests__/llmClassifier.test.ts`
- Modify: `functions/src/ai/ambiguity/classifier.ts` (wire LLM fallback)

### Task 3.1: llmClassifyAmbiguity con fast model

- [ ] **Step 1: Test**

```ts
// __tests__/llmClassifier.test.ts
import { llmClassifyAmbiguity } from '../llmClassifier';

it("returns clear when LLM responds 'clear'", async () => {
  const llm: any = { generateContent: vi.fn(async () => ({ text: '{"kind":"clear"}' })) };
  const out = await llmClassifyAmbiguity({ llm }, 'hola', baseDigest());
  expect(out.kind).toBe('clear');
});

it('returns ambiguous with candidates when LLM detects > 1', async () => {
  const llm: any = {
    generateContent: vi.fn(async () => ({
      text: '{"kind":"ambiguous","clarification":"¿Cuál?","candidates":[{"id":"t1","label":"X","kind":"team"}]}',
    })),
  };
  const out = await llmClassifyAmbiguity({ llm }, 'ese equipo', baseDigest());
  expect(out.kind).toBe('ambiguous');
});

it('returns clear when LLM throws (fail open)', async () => {
  const llm: any = {
    generateContent: vi.fn(async () => {
      throw new Error('503');
    }),
  };
  const out = await llmClassifyAmbiguity({ llm }, 'hola', baseDigest());
  expect(out.kind).toBe('clear');
});

it('returns clear when LLM returns invalid JSON (fail open)', async () => {
  const llm: any = { generateContent: vi.fn(async () => ({ text: 'no es json' })) };
  const out = await llmClassifyAmbiguity({ llm }, 'hola', baseDigest());
  expect(out.kind).toBe('clear');
});
```

- [ ] **Step 2: Implement** — prompt explícito + parse JSON + try/catch.

```ts
// functions/src/ai/ambiguity/llmClassifier.ts
import type { LLMProvider } from '../llmProvider';
import type { UserDigest } from '../digest/types';
import type { AmbiguityResult } from './types';

const SYSTEM = `Tarea: clasifica un mensaje de un entrenador de baloncesto a Pick.
Output: JSON estricto, una de:
- {"kind":"clear"}
- {"kind":"ambiguous","clarification":"<pregunta>","candidates":[{"id":"<digest_id>","label":"<texto>","kind":"team|session|player|bracket"}]}
- {"kind":"out-of-scope","reason":"<por qué>","suggestedAlternative":"<qué sí puede hacer Pick>"}

Reglas:
- Sólo "ambiguous" si hay >1 entidad plausible en el digest y el mensaje no apunta a una claramente.
- IDs SIEMPRE de los proporcionados en el digest. Nunca inventes.
- "out-of-scope" sólo para temas claramente externos (finanzas, mensajería externa, contenido legal).
- Si dudas, devuelve "clear".`;

export async function llmClassifyAmbiguity(
  deps: { llm: Pick<LLMProvider, 'generateContent'> },
  message: string,
  digest: UserDigest,
): Promise<AmbiguityResult> {
  try {
    const digestSlim = JSON.stringify({
      teams: digest.teams.map((t) => ({ id: t.id, name: t.name })),
      sessions: digest.upcomingSessions.map((s) => ({
        id: s.id,
        fecha: s.fecha,
        teamName: s.teamName,
        rival: s.rival,
        tipo: s.tipo,
      })),
      brackets: digest.activeBrackets.map((b) => ({ id: b.id, name: b.name })),
    });
    const resp = await deps.llm.generateContent({
      model: 'fast',
      systemInstruction: SYSTEM,
      contents: [{ role: 'user', parts: [{ text: `Mensaje: "${message}"\nDigest: ${digestSlim}` }] }],
    });
    const text = (resp.text || '').trim();
    const parsed = JSON.parse(text);
    if (parsed.kind === 'ambiguous' || parsed.kind === 'out-of-scope' || parsed.kind === 'clear') {
      return parsed as AmbiguityResult;
    }
    return { kind: 'clear' };
  } catch {
    return { kind: 'clear' };
  }
}
```

- [ ] **Step 3: Tests pass**

- [ ] **Step 4: Wire en classifier**

```ts
// classifier.ts (modify)
import { llmClassifyAmbiguity } from './llmClassifier';

export async function classifyAmbiguity(
  deps: { heuristicsOnly?: boolean; llm?: Pick<LLMProvider, 'generateContent'> },
  message: string,
  digest: UserDigest,
  screen: ScreenContextData | null,
): Promise<AmbiguityResult> {
  const heur = detectAmbiguity(message, digest, screen);
  if (heur.kind !== 'clear') return heur;
  if (deps.heuristicsOnly || !deps.llm) return heur;
  return llmClassifyAmbiguity({ llm: deps.llm }, message, digest);
}
```

- [ ] **Step 5: Update orchestrator wire-up** para pasar `llm`:

```ts
await classifyAmbiguity({ llm: this.deps.llm }, input.userMessage, digest, input.screenContext || null);
```

- [ ] **Step 6: Commit + PR**

```powershell
git commit -m "feat(ai): LLM fallback for ambiguity classifier (sub-B.4)"
git checkout -b sub-b-ambiguity-llm
git push -u origin sub-b-ambiguity-llm
gh pr create --title "feat(ai): LLM-assisted ambiguity classifier fallback (sub-B.4)" --body "..."
```

---

## PR 4 — B.5 (a): ProactiveEngine backend (priorización)

**Goal:** Engine que toma `digest.pendingActions` + `digest.anomalies` y devuelve `ProactiveMessage | null` según prioridad y backoff.

**Files:**

- Create: `functions/src/ai/proactive/types.ts`
- Create: `functions/src/ai/proactive/priorizer.ts`
- Create: `functions/src/ai/proactive/engine.ts`
- Create: `functions/src/ai/proactive/__tests__/priorizer.test.ts`
- Create: `functions/src/ai/proactive/__tests__/engine.test.ts`

### Task 4.1: Types

```ts
// functions/src/ai/proactive/types.ts
export type ProactiveKind =
  | 'convocatoria_urgent'
  | 'analysis_overdue'
  | 'attendance_anomaly'
  | 'scouting_missing'
  | 'birthday_today';

export interface ProactiveMessage {
  kind: ProactiveKind;
  text: string;
  severity: 'info' | 'warn' | 'high';
  suggestedPrompt?: string;
  contextRefs?: { sessionId?: string; teamId?: string; playerId?: string };
}
```

Commit: `feat(ai): ProactiveMessage types (sub-B.5)`

### Task 4.2: Priorizer

- [ ] **Step 1: Test** — convocatoria <24h gana sobre todo; análisis >7d siguiente; etc. Tests específicos por kind.

- [ ] **Step 2: Implement**

```ts
// functions/src/ai/proactive/priorizer.ts
import type { UserDigest } from '../digest/types';
import type { ProactiveMessage } from './types';

const HOURS_24 = 24 * 60 * 60 * 1000;
const DAYS_7 = 7 * 24 * 60 * 60 * 1000;

function hoursUntil(fechaISO: string, horaInicio: string | undefined, nowISO: string): number {
  const time = horaInicio || '23:59';
  const date = new Date(`${fechaISO}T${time}:00`);
  const now = new Date(nowISO);
  return (date.getTime() - now.getTime()) / (60 * 60 * 1000);
}

export function prioritizeProactive(digest: UserDigest, nowISO: string): ProactiveMessage[] {
  const msgs: ProactiveMessage[] = [];

  // 1. Convocatorias urgentes (<24h)
  for (const conv of digest.pendingActions.convocatorias) {
    const h = hoursUntil(conv.fecha, undefined, nowISO);
    if (h >= 0 && h < 24) {
      msgs.push({
        kind: 'convocatoria_urgent',
        text: `Mañana ${conv.fecha}${conv.teamName ? ` ${conv.teamName}` : ''}${conv.rival ? ` vs ${conv.rival}` : ''}. La convocatoria aún no está mandada.`,
        severity: 'high',
        suggestedPrompt: `Prepara la convocatoria del partido del ${conv.fecha}`,
        contextRefs: { sessionId: conv.sessionId },
      });
    }
  }

  // 2. Análisis overdue (>7d)
  for (const an of digest.pendingActions.analyses) {
    const ageDays = Math.floor((new Date(nowISO).getTime() - new Date(an.fecha).getTime()) / (24 * 60 * 60 * 1000));
    if (ageDays >= 7) {
      msgs.push({
        kind: 'analysis_overdue',
        text: `Llevas ${ageDays} días sin analizar el partido del ${an.fecha}${an.teamName ? ` (${an.teamName})` : ''}.`,
        severity: 'warn',
        suggestedPrompt: `Vamos a analizar el partido del ${an.fecha}`,
        contextRefs: { sessionId: an.sessionId },
      });
    }
  }

  // 3. Anomalías de asistencia
  for (const anom of digest.anomalies) {
    if (anom.kind === 'attendance') {
      msgs.push({
        kind: 'attendance_anomaly',
        text: anom.summary,
        severity: anom.severity === 'warn' ? 'warn' : 'info',
      });
    }
  }

  // 4. Scouting missing
  for (const sc of digest.pendingActions.scoutings) {
    msgs.push({
      kind: 'scouting_missing',
      text: `Próximo rival sin scouting: ${sc.rival || '?'} (${sc.fecha})`,
      severity: 'info',
      suggestedPrompt: `Vamos a preparar el scouting del partido del ${sc.fecha}`,
      contextRefs: { sessionId: sc.sessionId },
    });
  }

  // Orden por severity (high > warn > info), luego inserción.
  const sev = { high: 0, warn: 1, info: 2 };
  msgs.sort((a, b) => sev[a.severity] - sev[b.severity]);

  return msgs;
}
```

- [ ] **Step 3: Commit** — `feat(ai): ProactiveEngine priorizer (sub-B.5)`

### Task 4.3: Engine + decide()

- [ ] **Step 1: Tests** — `decide()` devuelve `null` si dismissals tienen ese kind reciente.

- [ ] **Step 2: Implement**

```ts
// functions/src/ai/proactive/engine.ts
import { prioritizeProactive } from './priorizer';
import { wasRecentlyDismissed } from './dismissals';
import type { UserDigest } from '../digest/types';
import type { ProactiveMessage } from './types';

export async function decideProactive(
  deps: { db: any; appId: string; wsId: string; userId: string },
  digest: UserDigest,
  nowISO: string,
): Promise<ProactiveMessage | null> {
  const candidates = prioritizeProactive(digest, nowISO);
  for (const c of candidates) {
    const dismissed = await wasRecentlyDismissed(deps, c.kind);
    if (!dismissed) return c;
  }
  return null;
}
```

- [ ] **Step 3: Commit + PR** — `feat(ai): ProactiveEngine decide() with dismissal-aware backoff (sub-B.5a)`

### Task 4.4: Dismissals (stub para PR5)

- [ ] **Step 1: Stub vacío con tests** — `wasRecentlyDismissed` siempre false hasta que se persistan dismissals en PR5.

```ts
// functions/src/ai/proactive/dismissals.ts (stub)
export async function wasRecentlyDismissed(_deps: any, _kind: string): Promise<boolean> {
  return false; // wired completo en B.5b (PR5)
}
```

- [ ] **Step 2: Commit + open PR**

```powershell
git checkout -b sub-b-proactive-priorizer
git push -u origin sub-b-proactive-priorizer
gh pr create --title "feat(ai): ProactiveEngine priorizer + decide (sub-B.5a)" --body "..."
```

---

## PR 5 — B.5 (b): ProactiveEngine wire + dismissals

**Goal:** Cablear `decideProactive` en la apertura de Pick + persistir dismissals en `users/{uid}/preferences/proactive`.

**Files:**

- Modify: `functions/src/ai/proactive/dismissals.ts` (Firestore-backed)
- Modify: `functions/src/index.ts` (nuevo callable `pickGetProactive`)
- Modify: `firestore.rules` (regla para proactiveDismissals)
- Create: `functions/src/ai/proactive/__tests__/dismissals.test.ts`

### Task 5.1: Implementar dismissals Firestore-backed

- [ ] **Step 1: Tests**

```ts
import { wasRecentlyDismissed, recordDismissal } from "../dismissals";

it("returns true when dismissal within 7 days", async () => { ... });
it("returns false when dismissal older than 7 days", async () => { ... });
it("recordDismissal writes timestamp to user prefs", async () => { ... });
```

- [ ] **Step 2: Implement**

```ts
// dismissals.ts
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

const BACKOFF_DAYS = 7;

interface DismissalsDoc {
  [kind: string]: { lastDismissedAt: Timestamp };
}

function ref(deps: { db: Firestore; appId: string; userId: string }) {
  return deps.db
    .collection('artifacts')
    .doc(deps.appId)
    .collection('users')
    .doc(deps.userId)
    .collection('preferences')
    .doc('proactive');
}

export async function wasRecentlyDismissed(
  deps: { db: Firestore; appId: string; userId: string },
  kind: string,
): Promise<boolean> {
  const snap = await ref(deps).get();
  if (!snap.exists) return false;
  const data = snap.data() as DismissalsDoc;
  const entry = data?.[kind];
  if (!entry?.lastDismissedAt) return false;
  const ageMs = Date.now() - entry.lastDismissedAt.toMillis();
  return ageMs < BACKOFF_DAYS * 24 * 60 * 60 * 1000;
}

export async function recordDismissal(
  deps: { db: Firestore; appId: string; userId: string },
  kind: string,
): Promise<void> {
  await ref(deps).set({ [kind]: { lastDismissedAt: Timestamp.now() } }, { merge: true });
}
```

- [ ] **Step 3: Commit** — `feat(ai): persist proactive dismissals with 7d backoff (sub-B.5b)`

### Task 5.2: Callable `pickGetProactive` + `pickDismissProactive`

- [ ] **Step 1: Tests** — el callable usa el digest del user + devuelve `ProactiveMessage | null`.

- [ ] **Step 2: Implement**

```ts
// functions/src/index.ts (append)
export const pickGetProactive = onCall({ region: 'europe-west1' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'auth required');
  const { appId, wsId, clientDate } = req.data || {};
  const digest = await buildUserDigest({ db: admin().firestore(), userId: uid, wsId, appId, clientDate });
  const msg = await decideProactive(
    { db: admin().firestore(), appId, wsId, userId: uid },
    digest,
    new Date().toISOString(),
  );
  return { message: msg };
});

export const pickDismissProactive = onCall({ region: 'europe-west1' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'auth required');
  const { appId, kind } = req.data || {};
  await recordDismissal({ db: admin().firestore(), appId, userId: uid }, kind);
  return { ok: true };
});
```

- [ ] **Step 3: Firestore rules**

```
match /artifacts/{appId}/users/{uid}/preferences/proactive {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false; // sólo backend
}
```

- [ ] **Step 4: Commit + PR**

```powershell
git commit -m "feat(ai): callables pickGetProactive + pickDismissProactive (sub-B.5b)"
git checkout -b sub-b-proactive-wire
git push -u origin sub-b-proactive-wire
gh pr create --title "feat(ai): proactive callables + dismissals persistence (sub-B.5b)" --body "..."
```

---

## PR 6 — B.6: Frontend ConfirmChoice + ProactiveCard blocks

**Goal:** Renderizar los 2 nuevos blocks en PickPanel y PickColumn. Frontend llama `pickGetProactive` al abrir Pick.

**Files:**

- Create: `src/components/pick/blocks/ConfirmChoice.jsx`
- Create: `src/components/pick/blocks/ProactiveCard.jsx`
- Modify: `src/components/pick/PickPanel.jsx`
- Modify: `src/components/pick/PickColumn.jsx`
- Modify: `src/hooks/usePick.js`
- Modify: `src/hooks/usePickTips.js`

### Task 6.1: ConfirmChoice.jsx

- [ ] **Step 1: Tests** (vitest + Testing Library)

```js
// src/components/pick/blocks/__tests__/ConfirmChoice.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmChoice from '../ConfirmChoice';

it('renders prompt + candidate buttons', () => {
  const onPick = vi.fn();
  render(
    <ConfirmChoice
      block={{
        type: 'confirm_choice',
        prompt: '¿Cuál?',
        candidates: [
          { id: 's1', label: 'Sábado vs Hispano', kind: 'session' },
          { id: 's2', label: 'Domingo vs Olímpico', kind: 'session' },
        ],
        intent: 'convocatoria',
      }}
      onPick={onPick}
    />,
  );
  expect(screen.getByText('¿Cuál?')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Sábado vs Hispano'));
  expect(onPick).toHaveBeenCalledWith({ id: 's1', label: 'Sábado vs Hispano', kind: 'session' }, 'convocatoria');
});
```

- [ ] **Step 2: Implement** — botones inline, callback `onPick({id, label, kind}, intent)`.

```jsx
// src/components/pick/blocks/ConfirmChoice.jsx
export default function ConfirmChoice({ block, onPick }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="mb-3 text-sm text-zinc-200">{block.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {block.candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c, block.intent)}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit** — `feat(pick): ConfirmChoice block (sub-B.6 #1)`

### Task 6.2: ProactiveCard.jsx

- [ ] **Step 1: Tests** — render texto + severity badge + CTA + dismiss button.

- [ ] **Step 2: Implement** — botón "Sí, hagámoslo" (dispara suggestedPrompt) + botón "Ahora no" (dispara dismiss).

```jsx
export default function ProactiveCard({ block, onAccept, onDismiss }) {
  const severityColor =
    block.severity === 'high'
      ? 'border-amber-500/50 bg-amber-500/10'
      : block.severity === 'warn'
        ? 'border-yellow-500/30 bg-yellow-500/5'
        : 'border-zinc-700 bg-zinc-950/60';
  return (
    <div className={`rounded-lg border p-4 ${severityColor}`}>
      <p className="mb-3 text-sm text-zinc-100">{block.text}</p>
      <div className="flex gap-2">
        {block.suggestedPrompt && (
          <button
            onClick={() => onAccept(block.suggestedPrompt)}
            className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Sí, hagámoslo
          </button>
        )}
        <button
          onClick={() => onDismiss(block.kind)}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit** — `feat(pick): ProactiveCard block (sub-B.6 #2)`

### Task 6.3: PickPanel + PickColumn integration

- [ ] **Step 1: Tests** — añadir caso para los 2 nuevos block types.

- [ ] **Step 2: Implement** — añadir `case "confirm_choice"` y `case "proactive_card"` en el switch de tipos.

- [ ] **Step 3: Commit** — `feat(pick): render confirm_choice + proactive_card in PickPanel/PickColumn (sub-B.6 #3)`

### Task 6.4: usePick.js — fetch proactive al abrir

- [ ] **Step 1: Test** — al primer mount, llama `pickGetProactive` y si hay message, lo añade al inicio de la conversación.

- [ ] **Step 2: Implement** — useEffect con dependencias `[wsId, conversationId, firstOpen]`.

- [ ] **Step 3: Commit** — `feat(pick): fetch proactive on open (sub-B.6 #4)`

### Task 6.5: Refactor usePickTips para consumir backend

- [ ] **Step 1: Borrar tips estáticos** (si todos quedan reemplazados por backend) o mantener fallback offline.

- [ ] **Step 2: Commit** — `refactor(pick): usePickTips delegates to backend proactive (sub-B.6 #5)`

### Task 6.6: Open PR

```powershell
git checkout -b sub-b-frontend-blocks
git push -u origin sub-b-frontend-blocks
gh pr create --title "feat(pick): ConfirmChoice + ProactiveCard blocks + fetch on open (sub-B.6)" --body "..."
```

---

## PR 7 — B.7 + B.8: Multi-turn evals + docs

**Goal:** Eval cases en `AutoEvaluator` para los 5 escenarios narrativos del spec + actualizar CLAUDE.md.

**Files:**

- Create: `functions/src/ai/__tests__/evals/multiTurnAmbiguity.fixtures.ts`
- Modify: `CLAUDE.md`

### Task 7.1: Multi-turn fixtures

- [ ] **Step 1: 5 fixtures** correspondiendo a los 5 casos del spec.

```ts
export const multiTurnAmbiguityFixtures = [
  {
    name: 'case-1-convocatoria-ambiguous',
    digestOverrides: {
      upcomingSessions: [
        /* 3 partidos */
      ],
    },
    message: 'Mándame la convocatoria del partido',
    expectBlocks: ['confirm_choice'],
    expectNoLlmCall: true,
  },
  {
    name: 'case-2-multi-turn-narrative',
    history: [
      /* 8 turnos sobre Cadete A */
    ],
    message: 'y la del otro equipo?',
    expectContains: /Juniors B|el otro/,
  },
  // ... cases 3-5
];
```

- [ ] **Step 2: Hook en AutoEvaluator existente**

- [ ] **Step 3: Commit** — `test(ai): multi-turn + ambiguity eval fixtures (sub-B.7)`

### Task 7.2: CLAUDE.md docs

- [ ] **Step 1: Añadir sección "Pick conversational layer (sub-B)" después de "Pick context system":**

```md
### Pick conversational layer (sub-proyecto B)

Sobre el contexto de sub-A, sub-B añade 4 capas para conversación natural:

1. **System prompt redesign** (`functions/src/ai/promptManager.ts → orchestrator-system`) — persona Pick reforzada, few-shot examples, ambiguity protocol.
2. **History compression v2** (`functions/src/ai/history/*`) — topic-aware chunking + LLM summary + Firestore cache por (conversationId, turnIndex). Reemplaza el truncamiento flat a 130 chars.
3. **AmbiguityClassifier** (`functions/src/ai/ambiguity/*`) — pre-LLM step. Heurística regex primero (más rápido, sin coste), fast-model LLM como fallback. Emite `confirm_choice` block sin llamar al orchestrator caro.
4. **ProactiveEngine** (`functions/src/ai/proactive/*`) — al abrir Pick, decide si emitir `proactive_card` block basándose en `digest.pendingActions` + `digest.anomalies`. Backoff de 7d por kind cuando el coach lo descarta.

Frontend renderiza los 2 nuevos blocks en `components/pick/blocks/ConfirmChoice.jsx` + `ProactiveCard.jsx`. `usePick` llama `pickGetProactive` al abrir; `usePickTips` queda como fallback offline.

Métricas (Langfuse): `ambiguity_detected`, `clarification_resolved_rate`, `proactive_emission_rate`, `proactive_acceptance_rate`, `history_compression_ms`.
```

- [ ] **Step 2: Commit** — `docs: document Pick conversational layer in CLAUDE.md (sub-B.8)`

### Task 7.3: Open PR

```powershell
git checkout -b sub-b-evals-docs
git push -u origin sub-b-evals-docs
gh pr create --title "test+docs(ai): multi-turn + ambiguity evals + CLAUDE.md (sub-B.7+B.8)" --body "..."
```

---

## Done criteria (sub-B completo)

- [ ] Todos los 7 PRs mergeados a main.
- [ ] Vitest verde en cada PR.
- [ ] Smoke manual con cuenta real:
  - "Mándame la convocatoria del partido" con >1 partido próximo → emite `confirm_choice`.
  - Conversación >6 turnos → system prompt incluye `[Contexto previo]` con resúmenes coherentes (verificar en Langfuse trace).
  - Abrir Pick un viernes con convocatoria <24h pendiente → muestra `proactive_card`.
  - "Ahora no" → no vuelve a mostrar el mismo kind en 7 días.
- [ ] No regresión en `tool_calls`, `iteration_count`, `fallback_message_emitted`.
- [ ] Métricas nuevas pobladas en Langfuse.

---

## Out-of-scope (para sub-C)

- Write tools nuevos (planilla persistente, convocatoria con estado "mandada", updates, deletes).
- Push notifications via FCM.
- Voice mode / multimodal.
- Cross-workspace conversation history.
- Pre-compute scheduled del digest (sigue on-demand).
