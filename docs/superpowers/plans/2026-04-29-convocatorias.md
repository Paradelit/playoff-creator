# Convocatorias de partido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a feature that lets coaches generate, customize, copy, and share via WhatsApp the pre-match call-up message ("convocatoria") for any league/playoff/friendly match, with reminders in the home dashboard, birthdays, Pick chat integration, and the supporting data model (competitions, location upgrade, hora-fin auto-estimation).

**Architecture:** A pure rendering engine in `src/utils/convocatoriaTemplate.js` (mirrored TS in `functions/src/shared/`) consumes a session + team + competition + members and produces a message string. UI surfaces (modal, calendar, Pick chat block) all consume the engine. A small Cloud Function resolves Google Maps shortlinks. The home `PendingActionsList` is extended with two new item types (convocatoria + cumpleaños). Pick gets two new tools that call the same engine.

**Tech Stack:** React 19 + JSX (no TS in client), Vite, Firebase (Firestore + Functions), Tailwind, Vitest + React Testing Library, Lucide icons, ESLint + Prettier.

**Spec:** `docs/superpowers/specs/2026-04-29-convocatorias-design.md` — read it first.

---

## Phase organization

This plan has 10 phases. Each phase is mergeable on its own and produces a working state of the app. If you stop after any phase, what's shipped works (it just doesn't yet have the next layer of capability).

**Commit convention:** every phase commits in small, TDD-shaped commits. After each task that ends in a commit step, push if you want — phases are independent enough that a partial phase doesn't break anything.

---

## Phase 1 — Data model fundamentals

Adds new fields to existing collections, creates the `competitions` subcollection and `playoffConvocatorias` collection, updates Firestore rules, adds the duration constants. No UI yet — the form keeps working as before.

### Task 1.1: Add Firestore rules verification test

The existing rules use a wildcard `match /artifacts/{appId}/users/{uid}/{document=**}` that already covers any new user-scoped subcollection. We just need to verify our new paths work with the wildcard.

**Files:**

- Modify: `firestore.rules` (no changes — verify only)

- [ ] **Step 1: Re-read `firestore.rules` and confirm**

```bash
cat firestore.rules | grep -A 1 "match /artifacts/{appId}/users"
```

Expected: a wildcard rule on `{document=**}`. If present, our new paths `teams/{teamId}/competitions/{cid}` and `playoffConvocatorias/{id}` are already covered.

- [ ] **Step 2: No commit (verification-only step)**

### Task 1.2: Add DURACION_PARTIDO_MINUTOS constants

**Files:**

- Modify: `src/utils/constants.js`
- Test: `src/utils/constants.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `src/utils/constants.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { estimarDuracionPartido, DURACION_PARTIDO_FALLBACK } from './constants';

describe('estimarDuracionPartido', () => {
  it('returns 75 for Minibasket', () => {
    expect(estimarDuracionPartido({ categoria: 'Minibasket' })).toBe(75);
  });
  it('is case-insensitive', () => {
    expect(estimarDuracionPartido({ categoria: 'minibasket' })).toBe(75);
    expect(estimarDuracionPartido({ categoria: 'MINIBASKET' })).toBe(75);
  });
  it('strips accents (Júnior → junior)', () => {
    expect(estimarDuracionPartido({ categoria: 'Júnior' })).toBe(100);
  });
  it('returns 90 for Cadete', () => {
    expect(estimarDuracionPartido({ categoria: 'Cadete' })).toBe(90);
  });
  it('returns fallback 90 for unknown category', () => {
    expect(estimarDuracionPartido({ categoria: 'Veteranos' })).toBe(DURACION_PARTIDO_FALLBACK);
  });
  it('returns fallback for null team', () => {
    expect(estimarDuracionPartido(null)).toBe(DURACION_PARTIDO_FALLBACK);
  });
  it('returns fallback for empty categoria', () => {
    expect(estimarDuracionPartido({})).toBe(DURACION_PARTIDO_FALLBACK);
  });
});
```

- [ ] **Step 2: Run test (should fail — function not exported yet)**

```bash
npx vitest run src/utils/constants.test.js
```

Expected: FAIL — `estimarDuracionPartido is not a function`.

- [ ] **Step 3: Implement**

Append to `src/utils/constants.js`:

```js
export const DURACION_PARTIDO_FALLBACK = 90;

const DURACION_PARTIDO_MINUTOS = {
  premini: 60,
  minibasket: 75,
  mini: 75,
  preinfantil: 80,
  alevin: 80,
  infantil: 90,
  cadete: 90,
  junior: 100,
  senior: 100,
};

function normalizarCategoria(s) {
  if (typeof s !== 'string') return '';
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function estimarDuracionPartido(team) {
  const cat = normalizarCategoria(team?.categoria);
  return DURACION_PARTIDO_MINUTOS[cat] ?? DURACION_PARTIDO_FALLBACK;
}
```

- [ ] **Step 4: Run test (should pass)**

```bash
npx vitest run src/utils/constants.test.js
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/constants.js src/utils/constants.test.js
git commit -m "feat(constants): add estimarDuracionPartido by team category"
```

### Task 1.3: Create competitions service

**Files:**

- Create: `src/services/competitionsService.js`
- Test: `src/services/competitionsService.test.js`

- [ ] **Step 1: Implement service**

Create `src/services/competitionsService.js`:

```js
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';

function competitionsCol(teamId, uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'competitions');
}

export function subscribeToCompetitions(teamId, uid, db, appId, callback) {
  const q = query(competitionsCol(teamId, uid, db, appId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function saveCompetition(competition, teamId, { uid, db, appId }) {
  const ref = doc(competitionsCol(teamId, uid, db, appId), competition.id);
  await setDoc(
    ref,
    {
      ...competition,
      updatedAt: serverTimestamp(),
      ...(competition.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export async function deleteCompetition(competitionId, teamId, { uid, db, appId }) {
  await deleteDoc(doc(competitionsCol(teamId, uid, db, appId), competitionId));
}
```

- [ ] **Step 2: Write smoke test**

Create `src/services/competitionsService.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { saveCompetition, deleteCompetition, subscribeToCompetitions } from './competitionsService';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => ({ _path: args.slice(1).join('/') })),
  doc: vi.fn((col, id) => ({ _path: `${col._path}/${id}` })),
  setDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
  onSnapshot: vi.fn(() => () => undefined),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  query: vi.fn((col) => col),
  orderBy: vi.fn(() => undefined),
}));

const ctx = { uid: 'u1', db: {}, appId: 'app1' };

describe('competitionsService', () => {
  it('saveCompetition writes with createdAt when new', async () => {
    const { setDoc } = await import('firebase/firestore');
    await saveCompetition({ id: 'c1', nombre: 'Liga' }, 't1', ctx);
    const call = setDoc.mock.calls.at(-1);
    expect(call[1]).toMatchObject({
      id: 'c1',
      nombre: 'Liga',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    });
  });

  it('saveCompetition skips createdAt when already set', async () => {
    const { setDoc } = await import('firebase/firestore');
    await saveCompetition({ id: 'c1', createdAt: 'X' }, 't1', ctx);
    const call = setDoc.mock.calls.at(-1);
    expect(call[1].createdAt).toBe('X');
    expect(call[1].updatedAt).toBe('SERVER_TIMESTAMP');
  });

  it('deleteCompetition deletes the doc', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteCompetition('c1', 't1', ctx);
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('subscribeToCompetitions registers snapshot listener', () => {
    const { onSnapshot } = require('firebase/firestore');
    const cb = vi.fn();
    subscribeToCompetitions('t1', 'u1', {}, 'app1', cb);
    expect(onSnapshot).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests (should pass)**

```bash
npx vitest run src/services/competitionsService.test.js
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/competitionsService.js src/services/competitionsService.test.js
git commit -m "feat(competitions): add competitions service (CRUD + subscribe)"
```

### Task 1.4: Add useCompetitions hook

**Files:**

- Create: `src/hooks/useCompetitions.js`

- [ ] **Step 1: Implement hook (no test — thin wrapper)**

Create `src/hooks/useCompetitions.js`:

```js
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToCompetitions } from '../services/competitionsService';

export function useCompetitions(teamId) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db || !teamId) {
      setCompetitions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToCompetitions(teamId, user.uid, db, appId, (list) => {
      setCompetitions(list);
      setLoading(false);
    });
    return unsub;
  }, [user, db, appId, teamId]);

  return { competitions, loading };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCompetitions.js
git commit -m "feat(competitions): add useCompetitions hook"
```

### Task 1.5: Add playoffConvocatorias service

**Files:**

- Create: `src/services/playoffConvocatoriasService.js`

- [ ] **Step 1: Implement**

Create `src/services/playoffConvocatoriasService.js`:

```js
import { collection, doc, setDoc, onSnapshot, serverTimestamp, getDocs, query } from 'firebase/firestore';

function col(uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'playoffConvocatorias');
}

export function subscribeToPlayoffConvocatorias(uid, db, appId, callback) {
  return onSnapshot(query(col(uid, db, appId)), (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function getPlayoffConvocatorias(uid, db, appId) {
  const snap = await getDocs(query(col(uid, db, appId)));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function savePlayoffConvocatoria(payload, { uid, db, appId }) {
  const ref = doc(col(uid, db, appId), payload.sessionId);
  await setDoc(
    ref,
    { ...payload, updatedAt: serverTimestamp(), ...(payload.createdAt ? {} : { createdAt: serverTimestamp() }) },
    { merge: true },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/playoffConvocatoriasService.js
git commit -m "feat(playoffs): add playoffConvocatorias service for virtual session metadata"
```

### Task 1.6: Add tolerance read for legacy `convocatoria` field

The existing `session.convocatoria` field is renamed to `session.jugadoresConvocados`. We add a read helper that maps the old field to the new one.

**Files:**

- Modify: `src/utils/calendarUtils.js`
- Test: `src/utils/calendarUtils.test.js` (existing — extend)

- [ ] **Step 1: Write failing test**

Append to `src/utils/calendarUtils.test.js`:

```js
import { readJugadoresConvocados } from './calendarUtils';

describe('readJugadoresConvocados', () => {
  it('returns jugadoresConvocados when present', () => {
    expect(readJugadoresConvocados({ jugadoresConvocados: 'Pablo, Sergio' })).toBe('Pablo, Sergio');
  });
  it('falls back to legacy convocatoria field', () => {
    expect(readJugadoresConvocados({ convocatoria: 'Pablo' })).toBe('Pablo');
  });
  it('prefers new field over legacy', () => {
    expect(readJugadoresConvocados({ jugadoresConvocados: 'New', convocatoria: 'Old' })).toBe('New');
  });
  it('returns empty string for missing both', () => {
    expect(readJugadoresConvocados({})).toBe('');
  });
  it('returns empty string for null session', () => {
    expect(readJugadoresConvocados(null)).toBe('');
  });
});
```

- [ ] **Step 2: Run test (should fail)**

```bash
npx vitest run src/utils/calendarUtils.test.js
```

Expected: FAIL — `readJugadoresConvocados` not exported.

- [ ] **Step 3: Implement**

Append to `src/utils/calendarUtils.js`:

```js
export function readJugadoresConvocados(session) {
  if (!session) return '';
  return session.jugadoresConvocados ?? session.convocatoria ?? '';
}
```

- [ ] **Step 4: Run test (should pass)**

```bash
npx vitest run src/utils/calendarUtils.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/calendarUtils.js src/utils/calendarUtils.test.js
git commit -m "feat(calendar): add readJugadoresConvocados with legacy fallback"
```

### Task 1.7: Replace legacy reads in SessionDetailModal and SessionFormModal

**Files:**

- Modify: `src/components/calendar/SessionDetailModal.jsx`
- Modify: `src/components/calendar/SessionFormModal.jsx`

- [ ] **Step 1: Update SessionDetailModal**

In `src/components/calendar/SessionDetailModal.jsx`, replace the existing reference to `session.convocatoria` with the helper:

Find this block (around lines 107-110):

```jsx
{
  session.convocatoria && (
    <div className="mt-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Convocatoria</span>
      <p className="text-sm text-slate-700 whitespace-pre-line mt-0.5">{session.convocatoria}</p>
    </div>
  );
}
```

Replace with (also import `readJugadoresConvocados` at the top):

```jsx
{
  readJugadoresConvocados(session) && (
    <div className="mt-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Convocados</span>
      <p className="text-sm text-slate-700 whitespace-pre-line mt-0.5">{readJugadoresConvocados(session)}</p>
    </div>
  );
}
```

Add the import at top:

```jsx
import { readJugadoresConvocados } from '../../utils/calendarUtils';
```

- [ ] **Step 2: Update SessionFormModal**

In `src/components/calendar/SessionFormModal.jsx`, find the textarea around line 170-179 (`Convocatoria (opcional)`). Replace label and field name:

```jsx
<FormField label="Jugadores convocados (opcional)" htmlFor={convocatoriaId}>
  <textarea
    id={convocatoriaId}
    placeholder="Nombres de los jugadores convocados..."
    value={readJugadoresConvocados(editingSession)}
    onChange={(e) => setEditingSession((s) => ({ ...s, jugadoresConvocados: e.target.value, convocatoria: undefined }))}
    rows={2}
    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
  />
</FormField>
```

Add the import at top:

```jsx
import { readJugadoresConvocados } from '../../utils/calendarUtils';
```

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run src/components/calendar/
```

Expected: all calendar tests pass (we haven't broken anything; the variable name in JSX changed but logic is the same).

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/SessionDetailModal.jsx src/components/calendar/SessionFormModal.jsx
git commit -m "refactor(calendar): rename convocatoria field to jugadoresConvocados (legacy read tolerated)"
```

---

## Phase 2 — Competitions tab

CRUD UI for the team's competitions. Allows the user to create the leagues their team plays in. Standalone — no other phase consumes this directly until Phase 3.

### Task 2.1: Create CompetitionsTab component

**Files:**

- Create: `src/components/teams/CompetitionsTab.jsx`
- Test: `src/components/teams/CompetitionsTab.test.jsx`

- [ ] **Step 1: Write failing render test**

Create `src/components/teams/CompetitionsTab.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompetitionsTab from './CompetitionsTab';

vi.mock('../../hooks/useCompetitions', () => ({
  useCompetitions: () => ({ competitions: [], loading: false }),
}));

describe('CompetitionsTab', () => {
  it('shows empty state when no competitions', () => {
    render(<CompetitionsTab teamId="t1" />);
    expect(screen.getByText(/Sin competiciones/i)).toBeInTheDocument();
  });

  it('shows add button', () => {
    render(<CompetitionsTab teamId="t1" />);
    expect(screen.getByRole('button', { name: /Añadir competición/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (should fail — component does not exist)**

```bash
npx vitest run src/components/teams/CompetitionsTab.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement minimal component**

Create `src/components/teams/CompetitionsTab.jsx`:

```jsx
import React, { useState } from 'react';
import { Plus, Trophy, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useCompetitions } from '../../hooks/useCompetitions';
import { saveCompetition, deleteCompetition } from '../../services/competitionsService';
import CompetitionFormModal from './CompetitionFormModal';
import ConfirmDialog from '../ConfirmDialog';

export default function CompetitionsTab({ teamId }) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { competitions, loading } = useCompetitions(teamId);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function handleSave(competition) {
    await saveCompetition({ ...competition, id: competition.id || crypto.randomUUID() }, teamId, {
      uid: user.uid,
      db,
      appId,
    });
    setEditing(null);
  }

  async function handleDelete() {
    if (!deletingId) return;
    await deleteCompetition(deletingId, teamId, { uid: user.uid, db, appId });
    setDeletingId(null);
  }

  if (loading) {
    return <div className="text-sm text-slate-500 p-4">Cargando competiciones…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Competiciones</h3>
        <button
          type="button"
          onClick={() =>
            setEditing({ nombre: '', fases: [{ id: crypto.randomUUID(), nombre: 'Fase 1', jornadas: 22 }] })
          }
          className="text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1 text-sm transition"
        >
          <Plus size={15} aria-hidden="true" /> Añadir competición
        </button>
      </div>

      {competitions.length === 0 ? (
        <div className="text-sm text-slate-500 italic px-4 py-8 text-center bg-slate-50 rounded-xl border border-slate-200">
          Sin competiciones. Añade la liga del equipo para usarla en partidos.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {competitions.map((c) => (
            <li key={c.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
              <Trophy size={18} className="text-amber-500 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{c.nombre}</p>
                <p className="text-xs text-slate-500 truncate">
                  {(c.fases || []).map((f) => `${f.nombre} (${f.jornadas}j)`).join(' · ') || 'Sin fases'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(c)}
                aria-label="Editar competición"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded transition"
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(c.id)}
                aria-label="Eliminar competición"
                className="text-red-400 hover:text-red-600 p-1.5 rounded transition"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && <CompetitionFormModal competition={editing} onSave={handleSave} onClose={() => setEditing(null)} />}

      {deletingId && (
        <ConfirmDialog
          title="Eliminar competición"
          message="Los partidos vinculados perderán su jornada. ¿Seguro?"
          confirmLabel="Eliminar"
          confirmTone="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit (CompetitionFormModal pending in next task — will fail to import for now, ok to commit since we'll add it next)**

Skip commit until 2.2 done.

### Task 2.2: Create CompetitionFormModal

**Files:**

- Create: `src/components/teams/CompetitionFormModal.jsx`

- [ ] **Step 1: Implement**

Create `src/components/teams/CompetitionFormModal.jsx`:

```jsx
import React, { useId, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import Dialog from '../Dialog';

export default function CompetitionFormModal({ competition, onSave, onClose }) {
  const titleId = useId();
  const [form, setForm] = useState({
    ...competition,
    fases:
      Array.isArray(competition.fases) && competition.fases.length > 0
        ? competition.fases
        : [{ id: crypto.randomUUID(), nombre: 'Fase 1', jornadas: 22 }],
  });
  const [saving, setSaving] = useState(false);

  function updateFase(idx, patch) {
    setForm((f) => ({
      ...f,
      fases: f.fases.map((fase, i) => (i === idx ? { ...fase, ...patch } : fase)),
    }));
  }

  function addFase() {
    setForm((f) => ({
      ...f,
      fases: [...f.fases, { id: crypto.randomUUID(), nombre: `Fase ${f.fases.length + 1}`, jornadas: 22 }],
    }));
  }

  function removeFase(idx) {
    setForm((f) => ({ ...f, fases: f.fases.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-5.5rem)] sm:max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 my-auto shrink-0"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
        <h3 id={titleId} className="text-lg font-bold text-slate-800">
          {competition.id ? 'Editar competición' : 'Nueva competición'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 rounded"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700">Nombre</span>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="ej. Liga Cadete A Madrid"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-slate-700">Fases</legend>
          {form.fases.map((fase, idx) => (
            <div key={fase.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
              <input
                type="text"
                value={fase.nombre}
                onChange={(e) => updateFase(idx, { nombre: e.target.value })}
                placeholder="Fase 1"
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
              />
              <input
                type="number"
                min="1"
                max="60"
                value={fase.jornadas}
                onChange={(e) => updateFase(idx, { jornadas: Number(e.target.value) || 1 })}
                className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                aria-label="Número de jornadas"
              />
              <span className="text-xs text-slate-500">j</span>
              <button
                type="button"
                onClick={() => removeFase(idx)}
                aria-label="Eliminar fase"
                disabled={form.fases.length === 1}
                className="text-red-400 hover:text-red-600 p-1 rounded disabled:opacity-30"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addFase}
            className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1 self-start"
          >
            <Plus size={14} aria-hidden="true" /> Añadir fase
          </button>
        </fieldset>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run CompetitionsTab test**

```bash
npx vitest run src/components/teams/CompetitionsTab.test.jsx
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/teams/CompetitionsTab.jsx src/components/teams/CompetitionsTab.test.jsx src/components/teams/CompetitionFormModal.jsx
git commit -m "feat(competitions): add CompetitionsTab and CompetitionFormModal UI"
```

### Task 2.3: Wire CompetitionsTab into TeamDetailScreen

**Files:**

- Modify: `src/screens/TeamDetailScreen.jsx`

- [ ] **Step 1: Add tabs to TeamDetailScreen**

In `src/screens/TeamDetailScreen.jsx`, after the existing imports, add:

```jsx
import CompetitionsTab from '../components/teams/CompetitionsTab';
```

Inside the component, after `const [editingTeam, ...]` declarations, add a tab state:

```jsx
const [activeTab, setActiveTab] = useState('plantilla');
```

Wrap the existing rendering of staff/jugadores in a conditional `{activeTab === 'plantilla' && (...)}` and add the tab strip + Competitions panel above it.

Find the section that starts with `{/* Sección Staff */}` and the matching closing `</div>` of jugadores section. Wrap it. Then immediately above that, render the tabs:

```jsx
<div className="mb-6 border-b border-slate-200 flex gap-4">
  <button
    type="button"
    onClick={() => setActiveTab('plantilla')}
    className={`pb-3 text-sm font-bold transition border-b-2 ${activeTab === 'plantilla' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
  >
    Plantilla
  </button>
  <button
    type="button"
    onClick={() => setActiveTab('competiciones')}
    className={`pb-3 text-sm font-bold transition border-b-2 ${activeTab === 'competiciones' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
  >
    Competiciones
  </button>
</div>;

{
  activeTab === 'competiciones' && <CompetitionsTab teamId={teamId} />;
}

{
  activeTab === 'plantilla' && <>{/* existing staff + jugadores sections */}</>;
}
```

- [ ] **Step 2: Manual smoke check (no automated test for this wiring)**

```bash
npm run dev
```

Visit a team detail page. Click "Competiciones" → empty state. Click "Añadir competición" → modal. Save one. Reload — persists. Edit → saves. Delete → confirmation → gone.

- [ ] **Step 3: Commit**

```bash
git add src/screens/TeamDetailScreen.jsx
git commit -m "feat(team): integrate CompetitionsTab into TeamDetailScreen"
```

---

## Phase 3 — SessionFormModal upgrade

Adds liga/jornada inputs, splits `lugar` into name + maps URL, hides `horaFin` behind "Ajustar", adds `notaExtra`.

### Task 3.1: Auto-numeration helper

**Files:**

- Create: `src/utils/jornadaNumbering.js`
- Test: `src/utils/jornadaNumbering.test.js`

- [ ] **Step 1: Write failing test**

Create `src/utils/jornadaNumbering.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeJornadaNumero, recalcAutoJornadas } from './jornadaNumbering';

describe('computeJornadaNumero', () => {
  const sessions = [
    { id: 's1', fecha: '2026-09-15', competitionId: 'c1', faseId: 'f1' },
    { id: 's2', fecha: '2026-09-22', competitionId: 'c1', faseId: 'f1' },
    { id: 's3', fecha: '2026-09-29', competitionId: 'c1', faseId: 'f1' },
  ];

  it('returns ordinal position by date', () => {
    expect(computeJornadaNumero(sessions[0], sessions, 'c1', 'f1')).toBe(1);
    expect(computeJornadaNumero(sessions[1], sessions, 'c1', 'f1')).toBe(2);
    expect(computeJornadaNumero(sessions[2], sessions, 'c1', 'f1')).toBe(3);
  });

  it('returns 1 for an empty list (new session)', () => {
    expect(computeJornadaNumero({ id: 'new', fecha: '2026-10-01' }, [], 'c1', 'f1')).toBe(1);
  });

  it('handles a new session inserted in middle', () => {
    const newSession = { id: 'sNew', fecha: '2026-09-20', competitionId: 'c1', faseId: 'f1' };
    expect(computeJornadaNumero(newSession, [...sessions, newSession], 'c1', 'f1')).toBe(2);
  });

  it('skips manually-numbered sessions when computing', () => {
    const sessionsWithManual = [
      { id: 's1', fecha: '2026-09-15', competitionId: 'c1', faseId: 'f1' },
      {
        id: 'sManual',
        fecha: '2026-09-22',
        competitionId: 'c1',
        faseId: 'f1',
        jornadaNumero: 99,
        jornadaNumeroManual: true,
      },
      { id: 's3', fecha: '2026-09-29', competitionId: 'c1', faseId: 'f1' },
    ];
    expect(computeJornadaNumero(sessionsWithManual[0], sessionsWithManual, 'c1', 'f1')).toBe(1);
    expect(computeJornadaNumero(sessionsWithManual[2], sessionsWithManual, 'c1', 'f1')).toBe(2);
  });
});

describe('recalcAutoJornadas', () => {
  it('returns updated sessions list with renumbered jornadas', () => {
    const list = [
      { id: 's1', fecha: '2026-09-15', competitionId: 'c1', faseId: 'f1' },
      { id: 's2', fecha: '2026-09-22', competitionId: 'c1', faseId: 'f1' },
    ];
    const result = recalcAutoJornadas(list, 'c1', 'f1');
    expect(result.find((s) => s.id === 's1').jornadaNumero).toBe(1);
    expect(result.find((s) => s.id === 's2').jornadaNumero).toBe(2);
  });

  it('respects manually-numbered sessions', () => {
    const list = [
      { id: 's1', fecha: '2026-09-15', competitionId: 'c1', faseId: 'f1', jornadaNumero: 5, jornadaNumeroManual: true },
      { id: 's2', fecha: '2026-09-22', competitionId: 'c1', faseId: 'f1' },
    ];
    const result = recalcAutoJornadas(list, 'c1', 'f1');
    expect(result.find((s) => s.id === 's1').jornadaNumero).toBe(5);
    expect(result.find((s) => s.id === 's2').jornadaNumero).toBe(1);
  });
});
```

- [ ] **Step 2: Run test (should fail)**

```bash
npx vitest run src/utils/jornadaNumbering.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/utils/jornadaNumbering.js`:

```js
function inFase(s, competitionId, faseId) {
  return s.competitionId === competitionId && s.faseId === faseId;
}

export function computeJornadaNumero(session, allSessions, competitionId, faseId) {
  const auto = (allSessions || [])
    .filter((s) => inFase(s, competitionId, faseId))
    .filter((s) => !s.jornadaNumeroManual)
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1));

  const includesSelf = auto.some((s) => s.id === session.id);
  if (!includesSelf) {
    const merged = [...auto, session].sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
    return merged.findIndex((s) => s.id === session.id) + 1;
  }
  return auto.findIndex((s) => s.id === session.id) + 1;
}

export function recalcAutoJornadas(sessions, competitionId, faseId) {
  const inScope = (sessions || []).filter((s) => inFase(s, competitionId, faseId));
  const autos = inScope
    .filter((s) => !s.jornadaNumeroManual)
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
    .map((s, i) => ({ ...s, jornadaNumero: i + 1 }));
  const manuals = inScope.filter((s) => s.jornadaNumeroManual);
  const recalced = [...autos, ...manuals];
  return (sessions || []).map((s) => recalced.find((r) => r.id === s.id) || s);
}
```

- [ ] **Step 4: Run test (should pass)**

```bash
npx vitest run src/utils/jornadaNumbering.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/jornadaNumbering.js src/utils/jornadaNumbering.test.js
git commit -m "feat(competitions): add jornada auto-numbering utility"
```

### Task 3.2: Add resolveMapsUrl Cloud Function

**Files:**

- Create: `functions/src/locations/resolveMapsUrl.ts`
- Create: `functions/src/locations/resolveMapsUrl.test.ts`
- Modify: `functions/src/index.ts` (export the function)

- [ ] **Step 1: Locate existing function exports**

```bash
ls functions/src/index.ts
```

Read the file to know where to add the export.

- [ ] **Step 2: Write failing test**

Create `functions/src/locations/resolveMapsUrl.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isMapsShortUrl, extractPlaceFromMapsUrl } from './resolveMapsUrl';

describe('isMapsShortUrl', () => {
  it('accepts maps.app.goo.gl', () => {
    expect(isMapsShortUrl('https://maps.app.goo.gl/abc123')).toBe(true);
  });
  it('accepts goo.gl/maps', () => {
    expect(isMapsShortUrl('https://goo.gl/maps/abc')).toBe(true);
  });
  it('rejects non-maps URL', () => {
    expect(isMapsShortUrl('https://example.com')).toBe(false);
  });
  it('rejects empty', () => {
    expect(isMapsShortUrl('')).toBe(false);
  });
});

describe('extractPlaceFromMapsUrl', () => {
  it('extracts place name from /maps/place/<name>/...', () => {
    const url = 'https://www.google.com/maps/place/Pabell%C3%B3n+Ramiro+de+Maeztu/@40.4,-3.7';
    expect(extractPlaceFromMapsUrl(url)).toBe('Pabellón Ramiro de Maeztu');
  });
  it('returns null when no place segment', () => {
    expect(extractPlaceFromMapsUrl('https://www.google.com/maps')).toBe(null);
  });
  it('returns null for invalid URL', () => {
    expect(extractPlaceFromMapsUrl('not a url')).toBe(null);
  });
});
```

- [ ] **Step 3: Run test (should fail)**

```bash
cd functions && npx vitest run src/locations/resolveMapsUrl.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `functions/src/locations/resolveMapsUrl.ts`:

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

export function isMapsShortUrl(s: string): boolean {
  if (typeof s !== 'string' || !s) return false;
  try {
    const u = new URL(s);
    if (u.host === 'maps.app.goo.gl') return true;
    if (u.host === 'goo.gl' && u.pathname.startsWith('/maps/')) return true;
    return false;
  } catch {
    return false;
  }
}

export function extractPlaceFromMapsUrl(longUrl: string): string | null {
  if (typeof longUrl !== 'string') return null;
  try {
    const u = new URL(longUrl);
    const m = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (!m) return null;
    return decodeURIComponent(m[1]).replace(/\+/g, ' ').trim() || null;
  } catch {
    return null;
  }
}

const cache = new Map<string, { result: ResolveResult; expiresAt: number }>();
const TTL_MS = 24 * 3600 * 1000;

interface ResolveResult {
  resolvedUrl: string;
  placeName: string | null;
}

async function followRedirect(shortUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(shortUrl, { method: 'GET', redirect: 'follow', signal: controller.signal });
    return res.url;
  } finally {
    clearTimeout(timeout);
  }
}

export const resolveMapsUrl = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido.');
  const data = request.data as { shortUrl?: unknown };
  const shortUrl = typeof data.shortUrl === 'string' ? data.shortUrl : '';
  if (!isMapsShortUrl(shortUrl)) {
    throw new HttpsError('invalid-argument', 'URL no es un shortlink de Google Maps.');
  }

  const cached = cache.get(shortUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let resolvedUrl: string;
  try {
    resolvedUrl = await followRedirect(shortUrl);
  } catch (err) {
    throw new HttpsError('deadline-exceeded', 'No se pudo resolver la URL en 5 segundos.');
  }

  const result: ResolveResult = {
    resolvedUrl,
    placeName: extractPlaceFromMapsUrl(resolvedUrl),
  };
  cache.set(shortUrl, { result, expiresAt: Date.now() + TTL_MS });
  return result;
});
```

- [ ] **Step 5: Add export in `functions/src/index.ts`**

Append to `functions/src/index.ts`:

```ts
export { resolveMapsUrl } from './locations/resolveMapsUrl';
```

- [ ] **Step 6: Run test (should pass)**

```bash
cd functions && npx vitest run src/locations/resolveMapsUrl.test.ts
```

Expected: 7 pure-function tests pass.

- [ ] **Step 7: Commit**

```bash
git add functions/src/locations/resolveMapsUrl.ts functions/src/locations/resolveMapsUrl.test.ts functions/src/index.ts
git commit -m "feat(locations): add resolveMapsUrl cloud function for shortlink expansion"
```

### Task 3.3: Add resolveMapsUrl client wrapper

**Files:**

- Create: `src/services/locationsService.js`

- [ ] **Step 1: Implement**

Create `src/services/locationsService.js`:

```js
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';

let _functions;
function getFns() {
  if (!_functions) _functions = getFunctions();
  return _functions;
}

export async function resolveMapsUrlClient(shortUrl) {
  const fn = httpsCallable(getFns(), 'resolveMapsUrl');
  const res = await fn({ shortUrl });
  return res.data; // { resolvedUrl, placeName }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/locationsService.js
git commit -m "feat(locations): add client wrapper for resolveMapsUrl"
```

### Task 3.4: Upgrade SessionFormModal — split lugar + lugarMapsUrl

**Files:**

- Modify: `src/components/calendar/SessionFormModal.jsx`

- [ ] **Step 1: Replace the existing `Lugar` field block**

Find the `<FormField label="Lugar" htmlFor={lugarId}>` block (around line 229). Replace with two fields and an auto-resolve effect.

Add at the top of the function (with other useId calls):

```jsx
const lugarMapsUrlId = useId();
const [resolvingMaps, setResolvingMaps] = useState(false);
```

Add the import:

```jsx
import { useState, useId, useEffect, useRef } from 'react';
import { resolveMapsUrlClient } from '../../services/locationsService';
```

Replace the Lugar field block with:

```jsx
<FormField label="Lugar" htmlFor={lugarId}>
  <input
    id={lugarId}
    type="text"
    placeholder="Pabellón, pista..."
    value={editingSession.lugar || ''}
    onChange={(e) => setEditingSession((s) => ({ ...s, lugar: e.target.value }))}
    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  />
</FormField>
<FormField label="URL de Google Maps (opcional)" htmlFor={lugarMapsUrlId}>
  <input
    id={lugarMapsUrlId}
    type="url"
    placeholder="https://maps.app.goo.gl/..."
    value={editingSession.lugarMapsUrl || ''}
    onChange={(e) => setEditingSession((s) => ({ ...s, lugarMapsUrl: e.target.value }))}
    onBlur={async (e) => {
      const url = e.target.value.trim();
      if (!url || editingSession.lugar) return;
      setResolvingMaps(true);
      try {
        const { placeName } = await resolveMapsUrlClient(url);
        if (placeName) setEditingSession((s) => ({ ...s, lugar: s.lugar || placeName }));
      } catch {
        // silent failure: user can type lugar manually
      } finally {
        setResolvingMaps(false);
      }
    }}
    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  />
  {resolvingMaps && <p className="text-xs text-slate-500 mt-1">Resolviendo dirección…</p>}
</FormField>
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open a partido form, paste a `maps.app.goo.gl/xxx` URL → after blur, the `lugar` field auto-fills with the place name.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/SessionFormModal.jsx
git commit -m "feat(calendar): split lugar into lugar + lugarMapsUrl with auto-resolve"
```

### Task 3.5: Hide `horaFin` behind "Ajustar"

**Files:**

- Modify: `src/components/calendar/SessionFormModal.jsx`
- Modify: `src/hooks/useSessionEditor.js` (if it exists — needs estimar logic)

- [ ] **Step 1: Locate useSessionEditor**

```bash
ls src/hooks/useSessionEditor.js
```

Read it to understand the save flow.

- [ ] **Step 2: Modify form to hide horaFin for partidos**

In `SessionFormModal.jsx`, find the grid that contains `Hora inicio` and `Hora fin` (around lines 206-228). Change the `Hora fin` block: render it only when `editingSession.horaFinExpanded === true || editingSession.tipo === 'entrenamiento'`. For partidos, show a small detail above the inputs:

Replace the grid block with:

```jsx
<div className="grid grid-cols-2 gap-3">
  <FormField label="Hora inicio" htmlFor={horaInicioId}>
    <input
      id={horaInicioId}
      type="time"
      value={editingSession.horaInicio}
      onChange={(e) => setEditingSession((s) => ({ ...s, horaInicio: e.target.value }))}
      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
    />
  </FormField>
  {(editingSession.tipo === 'entrenamiento' || editingSession.horaFinExpanded) && (
    <FormField label="Hora fin" htmlFor={horaFinId} error={sessionErrors.horaFin}>
      <input
        id={horaFinId}
        type="time"
        value={editingSession.horaFin}
        onChange={(e) => {
          setEditingSession((s) => ({ ...s, horaFin: e.target.value }));
          if (sessionErrors.horaFin) setSessionErrors((prev) => ({ ...prev, horaFin: undefined }));
        }}
        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${sessionErrors.horaFin ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-400'}`}
      />
    </FormField>
  )}
</div>;
{
  editingSession.tipo !== 'entrenamiento' && !editingSession.horaFinExpanded && (
    <button
      type="button"
      onClick={() => setEditingSession((s) => ({ ...s, horaFinExpanded: true }))}
      className="text-xs text-slate-500 hover:text-slate-700 self-start"
    >
      Duración estimada por categoría · Ajustar
    </button>
  );
}
```

- [ ] **Step 3: Update onSubmit handler**

Locate the submission flow in `useSessionEditor` (or wherever the session save happens before calling `saveCalendarSession`). Before saving, if `tipo` is `partido` or `playoff` and `horaFin` is empty, compute it from `estimarDuracionPartido(team)` plus `horaInicio`.

In `src/hooks/useSessionEditor.js`, find the function that prepares the session for save. Add the helper:

```js
import { estimarDuracionPartido } from '../utils/constants';

function withEstimatedHoraFin(session, team) {
  if (session.tipo === 'entrenamiento') return session;
  if (session.horaFin) return session;
  if (!session.horaInicio) return session;
  const dur = estimarDuracionPartido(team);
  const [h, m] = session.horaInicio.split(':').map(Number);
  const totalMin = h * 60 + m + dur;
  const fh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const fm = String(totalMin % 60).padStart(2, '0');
  return { ...session, horaFin: `${fh}:${fm}` };
}
```

Apply `withEstimatedHoraFin(session, team)` before `saveCalendarSession`.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Create a partido without setting Hora fin → save → re-open → `horaFin` is auto-filled.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/SessionFormModal.jsx src/hooks/useSessionEditor.js
git commit -m "feat(calendar): hide horaFin behind Ajustar with auto-estimate by category"
```

### Task 3.6: Add Liga / Amistoso selector + competition + jornada

**Files:**

- Modify: `src/components/calendar/SessionFormModal.jsx`

- [ ] **Step 1: Add state and competition fetch**

Near the top of `SessionFormModal`, add the hook:

```jsx
import { useCompetitions } from '../../hooks/useCompetitions';
```

Inside the function:

```jsx
const { competitions } = useCompetitions(editingSession.teamId);
```

- [ ] **Step 2: Add Liga / Amistoso selector**

Inside the `editingSession.tipo === 'partido' && (...)` block, immediately after the `Rival` FormField, insert:

```jsx
<FormField label="Tipo" asFieldset>
  <div className="flex gap-2" role="group" aria-label="Tipo de partido">
    <button
      type="button"
      onClick={() =>
        setEditingSession((s) => ({
          ...s,
          competitionId: s.competitionId || competitions[0]?.id || null,
          faseId: null,
          jornadaNumero: null,
          jornadaNumeroManual: false,
        }))
      }
      aria-pressed={!!editingSession.competitionId}
      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${editingSession.competitionId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      Liga
    </button>
    <button
      type="button"
      onClick={() =>
        setEditingSession((s) => ({
          ...s,
          competitionId: null,
          faseId: null,
          jornadaNumero: null,
          jornadaNumeroManual: false,
        }))
      }
      aria-pressed={!editingSession.competitionId}
      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${!editingSession.competitionId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      Amistoso
    </button>
  </div>
</FormField>;

{
  editingSession.competitionId && competitions.length === 0 && (
    <p className="text-xs text-slate-500 italic">
      Sin competiciones del equipo. Crea una en la pestaña Competiciones del equipo.
    </p>
  );
}

{
  editingSession.competitionId && competitions.length > 0 && (
    <>
      <FormField label="Competición">
        <select
          value={editingSession.competitionId || ''}
          onChange={(e) => setEditingSession((s) => ({ ...s, competitionId: e.target.value, faseId: null }))}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
        >
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Fase">
        <select
          value={editingSession.faseId || ''}
          onChange={(e) => setEditingSession((s) => ({ ...s, faseId: e.target.value }))}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
        >
          <option value="">Selecciona fase</option>
          {(competitions.find((c) => c.id === editingSession.competitionId)?.fases || []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre} ({f.jornadas}j)
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Jornada (auto)">
        <input
          type="number"
          min="1"
          value={editingSession.jornadaNumero ?? ''}
          placeholder="Auto al guardar"
          onChange={(e) =>
            setEditingSession((s) => ({
              ...s,
              jornadaNumero: e.target.value === '' ? null : Number(e.target.value),
              jornadaNumeroManual: e.target.value !== '',
            }))
          }
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
        />
      </FormField>
    </>
  );
}
```

- [ ] **Step 3: Apply auto-numbering on save**

In `useSessionEditor.js`, before saving a partido session, call `computeJornadaNumero` if needed:

```js
import { computeJornadaNumero } from '../utils/jornadaNumbering';

function withAutoJornada(session, allSessions) {
  if (!session.competitionId || !session.faseId) return session;
  if (session.jornadaNumeroManual) return session;
  return {
    ...session,
    jornadaNumero: computeJornadaNumero(session, allSessions, session.competitionId, session.faseId),
  };
}
```

Apply `withAutoJornada(session, allSessions)` (where `allSessions` is the existing list from the calendar query) before save.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Create a partido, mark as Liga, pick a competition + fase, save. Re-open — jornadaNumero is set. Create another for a later date — jornadaNumero is the next ordinal.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/SessionFormModal.jsx src/hooks/useSessionEditor.js
git commit -m "feat(calendar): add Liga/Amistoso selector with competition + auto jornada"
```

### Task 3.7: Add notaExtra field

**Files:**

- Modify: `src/components/calendar/SessionFormModal.jsx`

- [ ] **Step 1: Add textarea**

Inside the `editingSession.tipo === 'partido' && (...)` block, after the Convocados field, insert:

```jsx
<FormField label="Nota extra para la convocatoria (opcional)">
  <textarea
    placeholder="Algo extra que avisar al grupo (ej. llevar ambas equipaciones)..."
    value={editingSession.notaExtra || ''}
    onChange={(e) => setEditingSession((s) => ({ ...s, notaExtra: e.target.value }))}
    rows={2}
    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
  />
</FormField>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/SessionFormModal.jsx
git commit -m "feat(calendar): add notaExtra field for per-match convocatoria customization"
```

---

## Phase 4 — Convocatoria template engine

The pure rendering engine. Heavy TDD — this is the core of the feature.

### Task 4.1: Create date helpers

**Files:**

- Create: `src/utils/convocatoriaDates.js`
- Test: `src/utils/convocatoriaDates.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/utils/convocatoriaDates.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { saludoFromHour, fechaRelativa } from './convocatoriaDates';

describe('saludoFromHour', () => {
  it('Buenos días before 14:00', () => {
    expect(saludoFromHour(8)).toBe('Buenos días');
    expect(saludoFromHour(13)).toBe('Buenos días');
  });
  it('Buenas tardes 14:00-17:59', () => {
    expect(saludoFromHour(14)).toBe('Buenas tardes');
    expect(saludoFromHour(17)).toBe('Buenas tardes');
  });
  it('Buenas noches from 18:00', () => {
    expect(saludoFromHour(18)).toBe('Buenas noches');
    expect(saludoFromHour(23)).toBe('Buenas noches');
  });
});

describe('fechaRelativa', () => {
  const now = new Date('2026-04-29T10:00:00');
  it('returns "hoy" for same day', () => {
    expect(fechaRelativa('2026-04-29', now)).toBe('hoy');
  });
  it('returns "mañana" for next day', () => {
    expect(fechaRelativa('2026-04-30', now)).toBe('mañana');
  });
  it('returns weekday for 2-6 days', () => {
    expect(fechaRelativa('2026-05-02', now)).toBe('el sábado');
  });
  it('returns full date for 7+ days', () => {
    expect(fechaRelativa('2026-05-15', now)).toBe('el 15 de mayo');
  });
});
```

- [ ] **Step 2: Run (fail)**

```bash
npx vitest run src/utils/convocatoriaDates.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/utils/convocatoriaDates.js`:

```js
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function saludoFromHour(h) {
  if (h >= 18) return 'Buenas noches';
  if (h >= 14) return 'Buenas tardes';
  return 'Buenos días';
}

function ymdToLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(target, now) {
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t - n) / (1000 * 60 * 60 * 24));
}

export function fechaRelativa(targetYmd, now = new Date()) {
  const target = ymdToLocalDate(targetYmd);
  const days = diffDays(target, now);
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days >= 2 && days <= 6) return `el ${DIAS_SEMANA[target.getDay()]}`;
  return `el ${target.getDate()} de ${MESES[target.getMonth()]}`;
}
```

- [ ] **Step 4: Run (pass)**

```bash
npx vitest run src/utils/convocatoriaDates.test.js
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/convocatoriaDates.js src/utils/convocatoriaDates.test.js
git commit -m "feat(convocatorias): add date helpers for greeting and relative date"
```

### Task 4.2: Encabezado generator

**Files:**

- Create: `src/utils/convocatoriaEncabezado.js`
- Test: `src/utils/convocatoriaEncabezado.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/utils/convocatoriaEncabezado.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generarEncabezado } from './convocatoriaEncabezado';

describe('generarEncabezado', () => {
  const competition = {
    id: 'c1',
    nombre: 'Liga Cadete A',
    fases: [
      { id: 'f1', nombre: 'Fase 1', jornadas: 22 },
      { id: 'f2', nombre: 'Permanencia', jornadas: 7 },
    ],
  };

  it('liga par + 1ª vuelta (jornada 1-11 of 22)', () => {
    const session = { tipo: 'partido', competitionId: 'c1', faseId: 'f1', jornadaNumero: 5, rival: 'Movistar' };
    const out = generarEncabezado({ session, competition });
    expect(out).toBe('*Liga Cadete A — Fase 1 (1ª vuelta)*\n_Jornada 5 vs Movistar_');
  });

  it('liga par + 2ª vuelta (jornada 12-22 of 22)', () => {
    const session = { tipo: 'partido', competitionId: 'c1', faseId: 'f1', jornadaNumero: 15, rival: 'Movistar' };
    const out = generarEncabezado({ session, competition });
    expect(out).toBe('*Liga Cadete A — Fase 1 (2ª vuelta)*\n_Jornada 15 vs Movistar_');
  });

  it('liga impar (no vuelta) — jornadas=7', () => {
    const session = { tipo: 'partido', competitionId: 'c1', faseId: 'f2', jornadaNumero: 3, rival: 'Movistar' };
    const out = generarEncabezado({ session, competition });
    expect(out).toBe('*Liga Cadete A — Permanencia*\n_Jornada 3 vs Movistar_');
  });

  it('amistoso (no competition)', () => {
    const session = { tipo: 'partido', competitionId: null, rival: 'Movistar' };
    const out = generarEncabezado({ session, competition: null });
    expect(out).toBe('*Amistoso*\n_vs Movistar_');
  });

  it('playoff with matchTitle and gameIndex', () => {
    const session = { tipo: 'playoff', matchTitle: '1/8', gameIndex: 0, rival: 'Saltium' };
    const out = generarEncabezado({ session, competition: null });
    expect(out).toBe('*Playoffs 1/8*\n_Jornada 1 vs Saltium_');
  });

  it('playoff game 2 of 3', () => {
    const session = { tipo: 'playoff', matchTitle: 'Cuartos', gameIndex: 1, rival: 'Saltium' };
    const out = generarEncabezado({ session, competition: null });
    expect(out).toBe('*Playoffs Cuartos*\n_Jornada 2 vs Saltium_');
  });
});
```

- [ ] **Step 2: Run (fail)**

```bash
npx vitest run src/utils/convocatoriaEncabezado.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/utils/convocatoriaEncabezado.js`:

```js
function vueltaSuffix(fase, jornadaNumero) {
  if (!fase || !Number.isFinite(fase.jornadas)) return '';
  if (fase.jornadas % 2 !== 0) return '';
  const half = Math.floor(fase.jornadas / 2);
  return jornadaNumero <= half ? ' (1ª vuelta)' : ' (2ª vuelta)';
}

export function generarEncabezado({ session, competition }) {
  const rival = session?.rival || 'Rival';

  if (session?.tipo === 'playoff') {
    const matchTitle = session.matchTitle || 'Eliminatoria';
    const game = (session.gameIndex || 0) + 1;
    return `*Playoffs ${matchTitle}*\n_Jornada ${game} vs ${rival}_`;
  }

  if (!session?.competitionId || !competition) {
    return `*Amistoso*\n_vs ${rival}_`;
  }

  const fase = (competition.fases || []).find((f) => f.id === session.faseId);
  if (!fase) return `*${competition.nombre}*\n_vs ${rival}_`;

  const vuelta = vueltaSuffix(fase, session.jornadaNumero);
  return `*${competition.nombre} — ${fase.nombre}${vuelta}*\n_Jornada ${session.jornadaNumero} vs ${rival}_`;
}
```

- [ ] **Step 4: Run (pass)**

```bash
npx vitest run src/utils/convocatoriaEncabezado.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/convocatoriaEncabezado.js src/utils/convocatoriaEncabezado.test.js
git commit -m "feat(convocatorias): add encabezado generator (liga/playoff/amistoso)"
```

### Task 4.3: Template renderer

**Files:**

- Create: `src/utils/convocatoriaTemplate.js`
- Test: `src/utils/convocatoriaTemplate.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/utils/convocatoriaTemplate.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATE, renderConvocatoria } from './convocatoriaTemplate';

describe('renderConvocatoria — liga visitante', () => {
  const team = {
    id: 't1',
    categoria: 'Cadete',
    citaOffsetMinutos: 45,
  };
  const competition = {
    id: 'c1',
    nombre: 'Liga Cadete A',
    fases: [{ id: 'f1', nombre: 'Fase 1', jornadas: 22 }],
  };
  const session = {
    tipo: 'partido',
    fecha: '2026-04-30',
    horaInicio: '09:30',
    rival: 'Movistar Estudiantes',
    lugar: 'Pabellón Ramiro de Maeztu',
    lugarMapsUrl: 'https://maps.app.goo.gl/Sc93PwU8kxUgzKty8',
    esLocal: false,
    competitionId: 'c1',
    faseId: 'f1',
    jornadaNumero: 15,
    notaExtra: '',
  };

  it('renders the full message with default template', () => {
    const now = new Date('2026-04-29T22:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition, now });
    expect(mensaje).toContain('Buenas noches');
    expect(mensaje).toContain('*Liga Cadete A — Fase 1 (2ª vuelta)*');
    expect(mensaje).toContain('_Jornada 15 vs Movistar Estudiantes_');
    expect(mensaje).toContain('mañana a las 09:30');
    expect(mensaje).toContain('Pabellón Ramiro de Maeztu');
    expect(mensaje).toContain('https://maps.app.goo.gl/Sc93PwU8kxUgzKty8');
    expect(mensaje).toContain('Quedamos allí a las 08:45');
  });

  it('elides notaExtra line when empty', () => {
    const now = new Date('2026-04-29T22:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition, now });
    expect(mensaje).not.toMatch(/\n\n\n/); // no triple newline
  });

  it('keeps notaExtra line when provided', () => {
    const now = new Date('2026-04-29T22:00:00');
    const { mensaje } = renderConvocatoria({
      session: { ...session, notaExtra: 'Importante llevar ambas equipaciones.' },
      team,
      competition,
      now,
    });
    expect(mensaje).toContain('Importante llevar ambas equipaciones.');
  });
});

describe('renderConvocatoria — local omits URL', () => {
  it('does not include lugarMapsUrl when esLocal=true', () => {
    const team = { id: 't1', citaOffsetMinutos: 45 };
    const session = {
      tipo: 'partido',
      fecha: '2026-04-30',
      horaInicio: '18:30',
      rival: 'Saltium',
      lugar: 'Nuestro pabellón',
      lugarMapsUrl: 'https://maps.app.goo.gl/abc',
      esLocal: true,
      competitionId: null,
    };
    const now = new Date('2026-04-29T15:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition: null, now });
    expect(mensaje).not.toContain('https://maps.app.goo.gl');
    expect(mensaje).toContain('en el pabellón');
  });
});

describe('renderConvocatoria — hora cita override', () => {
  it('uses session.horaCita when set, ignoring offset', () => {
    const team = { id: 't1', citaOffsetMinutos: 45 };
    const session = {
      tipo: 'partido',
      fecha: '2026-04-30',
      horaInicio: '18:30',
      rival: 'X',
      lugar: 'X',
      esLocal: true,
      horaCita: '17:30',
    };
    const now = new Date('2026-04-29T15:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition: null, now });
    expect(mensaje).toContain('17:30');
  });

  it('computes from offset when horaCita not set', () => {
    const team = { id: 't1', citaOffsetMinutos: 60 };
    const session = {
      tipo: 'partido',
      fecha: '2026-04-30',
      horaInicio: '18:30',
      rival: 'X',
      lugar: 'X',
      esLocal: true,
    };
    const now = new Date('2026-04-29T15:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition: null, now });
    expect(mensaje).toContain('17:30');
  });
});

describe('renderConvocatoria — custom template', () => {
  it('uses team.plantillaConvocatoria when provided', () => {
    const team = { id: 't1', citaOffsetMinutos: 45, plantillaConvocatoria: 'Hola.\n{ENCABEZADO}\nFin.' };
    const session = {
      tipo: 'partido',
      fecha: '2026-04-30',
      horaInicio: '18:30',
      rival: 'Saltium',
      lugar: 'X',
      esLocal: true,
      competitionId: null,
    };
    const now = new Date('2026-04-29T22:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition: null, now });
    expect(mensaje.startsWith('Hola.')).toBe(true);
    expect(mensaje.endsWith('Fin.')).toBe(true);
  });
});

describe('DEFAULT_TEMPLATE', () => {
  it('is a non-empty string', () => {
    expect(typeof DEFAULT_TEMPLATE).toBe('string');
    expect(DEFAULT_TEMPLATE.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run (fail)**

```bash
npx vitest run src/utils/convocatoriaTemplate.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/utils/convocatoriaTemplate.js`:

```js
import { generarEncabezado } from './convocatoriaEncabezado';
import { saludoFromHour, fechaRelativa } from './convocatoriaDates';

export const DEFAULT_TEMPLATE = [
  '{saludo}.',
  '',
  '{ENCABEZADO}',
  '',
  'Jugamos {fechaRelativa} a las {horaInicio} en {lugar}{lugarUrlSiVisitante}.',
  '',
  'Quedamos {citaSiVisitante} a las {horaCita}.',
  '',
  '{notaExtra}',
  '',
  'Nos vemos {fechaRelativaNosVemos}!',
  '🏀💪🏻',
].join('\n');

const VAR_NAMES = [
  'saludo',
  'ENCABEZADO',
  'rival',
  'fechaRelativa',
  'horaInicio',
  'horaCita',
  'lugar',
  'lugarUrlSiVisitante',
  'citaSiVisitante',
  'notaExtra',
  'fechaRelativaNosVemos',
];

function computeHoraCita(horaInicio, offsetMin) {
  if (!horaInicio || !Number.isFinite(offsetMin)) return '';
  const [h, m] = horaInicio.split(':').map(Number);
  const total = h * 60 + m - offsetMin;
  if (total < 0) return '';
  const fh = String(Math.floor(total / 60)).padStart(2, '0');
  const fm = String(total % 60).padStart(2, '0');
  return `${fh}:${fm}`;
}

function buildVariables({ session, team, competition, now }) {
  const offset = team?.citaOffsetMinutos ?? 45;
  const horaCita = session.horaCita || computeHoraCita(session.horaInicio, offset);
  const isLocal = !!session.esLocal;
  const fechaRel = fechaRelativa(session.fecha, now);

  return {
    saludo: saludoFromHour(now.getHours()),
    ENCABEZADO: generarEncabezado({ session, competition }),
    rival: session.rival || '',
    fechaRelativa: fechaRel,
    horaInicio: session.horaInicio || '',
    horaCita,
    lugar: session.lugar || '',
    lugarUrlSiVisitante: !isLocal && session.lugarMapsUrl ? ` ${session.lugarMapsUrl}` : '',
    citaSiVisitante: isLocal ? 'en el pabellón' : 'allí',
    notaExtra: session.notaExtra || '',
    fechaRelativaNosVemos: fechaRel,
  };
}

function lineHasOnlyEmptyVars(line, variables) {
  const vars = line.match(/\{([A-Za-z]+)\}/g) || [];
  if (vars.length === 0) return false;
  return vars.every((v) => {
    const name = v.slice(1, -1);
    return !variables[name];
  });
}

function applyVars(line, variables) {
  return line.replace(/\{([A-Za-z]+)\}/g, (_m, name) => variables[name] ?? '');
}

export function renderConvocatoria({ session, team, competition, members, now }) {
  const variables = buildVariables({ session, team, competition, now: now || new Date() });
  const template = (team?.plantillaConvocatoria && team.plantillaConvocatoria.trim()) || DEFAULT_TEMPLATE;

  const lines = template.split('\n').filter((line) => !lineHasOnlyEmptyVars(line, variables));
  const mensaje = lines
    .map((l) => applyVars(l, variables))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { mensaje, encabezado: variables.ENCABEZADO, variables, variableNames: VAR_NAMES };
}

export const VARIABLE_LABELS = {
  saludo: 'Saludo del momento del día',
  ENCABEZADO: 'Cabecera (Liga / Playoff / Amistoso)',
  rival: 'Nombre del rival',
  fechaRelativa: 'Fecha relativa del partido',
  horaInicio: 'Hora de inicio del partido',
  horaCita: 'Hora de cita',
  lugar: 'Lugar (nombre del pabellón)',
  lugarUrlSiVisitante: 'URL de Maps (solo si visitante)',
  citaSiVisitante: '"allí" / "en el pabellón"',
  notaExtra: 'Nota extra del partido',
  fechaRelativaNosVemos: 'Fecha relativa (cierre)',
};
```

- [ ] **Step 4: Run (pass)**

```bash
npx vitest run src/utils/convocatoriaTemplate.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/convocatoriaTemplate.js src/utils/convocatoriaTemplate.test.js
git commit -m "feat(convocatorias): add template renderer with default template + variables"
```

---

## Phase 5 — Convocatorias tab (template editor)

The `TeamDetailScreen → Convocatorias` tab. Lets the coach edit the template, the cita offset, the reminder window, and the recurring pabellones.

### Task 5.1: Add ConvocatoriasTab component

**Files:**

- Create: `src/components/teams/ConvocatoriasTab.jsx`
- Test: `src/components/teams/ConvocatoriasTab.test.jsx`

- [ ] **Step 1: Implement test (smoke)**

Create `src/components/teams/ConvocatoriasTab.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConvocatoriasTab from './ConvocatoriasTab';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../../contexts/FirebaseContext', () => ({ useFirebase: () => ({ db: {}, appId: 'a1' }) }));
vi.mock('../../services/teamsService', () => ({ saveTeam: vi.fn() }));

describe('ConvocatoriasTab', () => {
  it('renders all four sections', () => {
    const team = {
      id: 't1',
      plantillaConvocatoria: '',
      citaOffsetMinutos: 45,
      convocatoriaReminderHours: 72,
      pabellones: [],
    };
    render(<ConvocatoriasTab team={team} />);
    expect(screen.getByText(/Plantilla del mensaje/i)).toBeInTheDocument();
    expect(screen.getByText(/Hora de cita/i)).toBeInTheDocument();
    expect(screen.getByText(/Recordatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/Pabellones/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (fail)**

```bash
npx vitest run src/components/teams/ConvocatoriasTab.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/teams/ConvocatoriasTab.jsx`:

```jsx
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { saveTeam } from '../../services/teamsService';
import { DEFAULT_TEMPLATE, VARIABLE_LABELS, renderConvocatoria } from '../../utils/convocatoriaTemplate';

const PREVIEW_SESSION = {
  tipo: 'partido',
  fecha: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  horaInicio: '09:30',
  rival: 'Movistar Estudiantes',
  lugar: 'Pabellón Ramiro de Maeztu',
  lugarMapsUrl: 'https://maps.app.goo.gl/example',
  esLocal: false,
  competitionId: 'preview-c',
  faseId: 'preview-f',
  jornadaNumero: 15,
  notaExtra: '',
};
const PREVIEW_COMPETITION = {
  id: 'preview-c',
  nombre: 'Liga Cadete A',
  fases: [{ id: 'preview-f', nombre: 'Fase 1', jornadas: 22 }],
};

export default function ConvocatoriasTab({ team }) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const [form, setForm] = useState({
    plantillaConvocatoria: team.plantillaConvocatoria || DEFAULT_TEMPLATE,
    citaOffsetMinutos: team.citaOffsetMinutos ?? 45,
    convocatoriaReminderHours: team.convocatoriaReminderHours ?? 72,
    pabellones: Array.isArray(team.pabellones) ? team.pabellones : [],
  });
  const [saving, setSaving] = useState(false);
  const textareaRef = React.useRef(null);

  function insertVariable(name) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = form.plantillaConvocatoria.slice(0, start);
    const after = form.plantillaConvocatoria.slice(end);
    setForm((f) => ({ ...f, plantillaConvocatoria: `${before}{${name}}${after}` }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + name.length + 2, start + name.length + 2);
    }, 0);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTeam({ ...team, ...form }, { uid: user.uid, db, appId });
    } finally {
      setSaving(false);
    }
  }

  function addPabellon() {
    setForm((f) => ({ ...f, pabellones: [...f.pabellones, { nombre: '', mapsUrl: '' }] }));
  }
  function updatePabellon(idx, patch) {
    setForm((f) => ({ ...f, pabellones: f.pabellones.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  }
  function removePabellon(idx) {
    setForm((f) => ({ ...f, pabellones: f.pabellones.filter((_, i) => i !== idx) }));
  }

  const previewTeam = { ...team, ...form };
  const previewMensaje = (() => {
    try {
      return renderConvocatoria({
        session: PREVIEW_SESSION,
        team: previewTeam,
        competition: PREVIEW_COMPETITION,
        now: new Date(),
      }).mensaje;
    } catch (e) {
      return `Error en la plantilla: ${e.message}`;
    }
  })();

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Plantilla del mensaje</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <textarea
              ref={textareaRef}
              value={form.plantillaConvocatoria}
              onChange={(e) => setForm((f) => ({ ...f, plantillaConvocatoria: e.target.value }))}
              rows={14}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, plantillaConvocatoria: DEFAULT_TEMPLATE }))}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Restaurar default
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-slate-500 uppercase">Variables</p>
            {Object.entries(VARIABLE_LABELS).map(([name, label]) => (
              <button
                key={name}
                type="button"
                onClick={() => insertVariable(name)}
                title={label}
                className="text-left text-xs bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1 font-mono text-slate-700"
              >
                {`{${name}}`}
              </button>
            ))}
          </div>
        </div>
        <details className="mt-3 bg-slate-50 rounded-xl p-3">
          <summary className="text-xs font-bold text-slate-700 cursor-pointer">Vista previa</summary>
          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans mt-2">{previewMensaje}</pre>
        </details>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Hora de cita</h3>
        <label className="flex items-center gap-2 text-sm">
          <span>Citamos</span>
          <input
            type="number"
            min="0"
            max="180"
            value={form.citaOffsetMinutos}
            onChange={(e) => setForm((f) => ({ ...f, citaOffsetMinutos: Number(e.target.value) }))}
            className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          />
          <span>minutos antes del partido</span>
        </label>
        <p className="text-xs text-slate-500 mt-1">Puedes ajustarlo en cada partido si lo necesitas.</p>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Recordatorio</h3>
        <label className="flex items-center gap-2 text-sm">
          <span>Avísame</span>
          <input
            type="number"
            min="1"
            max="240"
            value={form.convocatoriaReminderHours}
            onChange={(e) => setForm((f) => ({ ...f, convocatoriaReminderHours: Number(e.target.value) }))}
            className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          />
          <span>horas antes si no he mandado la convocatoria</span>
        </label>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Pabellones recurrentes</h3>
          <button
            type="button"
            onClick={addPabellon}
            className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1"
          >
            <Plus size={14} aria-hidden="true" /> Añadir pabellón
          </button>
        </div>
        {form.pabellones.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Sin pabellones guardados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {form.pabellones.map((p, idx) => (
              <li key={idx} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={p.nombre}
                  onChange={(e) => updatePabellon(idx, { nombre: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                />
                <input
                  type="url"
                  placeholder="URL Maps"
                  value={p.mapsUrl}
                  onChange={(e) => updatePabellon(idx, { mapsUrl: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => removePabellon(idx)}
                  aria-label="Eliminar pabellón"
                  className="text-red-400 hover:text-red-600 p-1 rounded"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 bg-white pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test (pass)**

```bash
npx vitest run src/components/teams/ConvocatoriasTab.test.jsx
```

Expected: 1 test passes.

- [ ] **Step 5: Wire into TeamDetailScreen**

In `src/screens/TeamDetailScreen.jsx`, add a third tab `convocatorias` to the tab strip and render `<ConvocatoriasTab team={team} />`. Add the import:

```jsx
import ConvocatoriasTab from '../components/teams/ConvocatoriasTab';
```

Inside the tab strip:

```jsx
<button
  type="button"
  onClick={() => setActiveTab('convocatorias')}
  className={`pb-3 text-sm font-bold transition border-b-2 ${activeTab === 'convocatorias' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
>
  Convocatorias
</button>
```

After the existing competiciones panel:

```jsx
{
  activeTab === 'convocatorias' && team && <ConvocatoriasTab team={team} />;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/teams/ConvocatoriasTab.jsx src/components/teams/ConvocatoriasTab.test.jsx src/screens/TeamDetailScreen.jsx
git commit -m "feat(team): add Convocatorias tab with template editor"
```

---

## Phase 6 — ConvocatoriaModal + sub-modal trigger from SessionDetailModal + calendar mini-icon

### Task 6.1: Build ConvocatoriaModal

**Files:**

- Create: `src/components/calendar/ConvocatoriaModal.jsx`
- Test: `src/components/calendar/ConvocatoriaModal.test.jsx`

- [ ] **Step 1: Implement smoke test**

Create `src/components/calendar/ConvocatoriaModal.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConvocatoriaModal from './ConvocatoriaModal';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../../contexts/FirebaseContext', () => ({ useFirebase: () => ({ db: {}, appId: 'a1' }) }));
vi.mock('../../services/calendarService', () => ({ saveCalendarSession: vi.fn() }));
vi.mock('../../services/playoffConvocatoriasService', () => ({ savePlayoffConvocatoria: vi.fn() }));

const team = { id: 't1', citaOffsetMinutos: 45 };
const session = {
  id: 's1',
  tipo: 'partido',
  fecha: '2026-04-30',
  horaInicio: '18:30',
  rival: 'Saltium',
  lugar: 'Pabellón',
  esLocal: true,
  competitionId: null,
  teamId: 't1',
};

describe('ConvocatoriaModal', () => {
  it('renders rendered message with copy and share buttons', () => {
    render(<ConvocatoriaModal session={session} team={team} competition={null} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Copiar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WhatsApp/i })).toBeInTheDocument();
  });

  it('updates preview when notaExtra changes', async () => {
    const user = userEvent.setup();
    render(<ConvocatoriaModal session={session} team={team} competition={null} onClose={() => {}} />);
    const notaInput = screen.getByPlaceholderText(/Nota extra/i);
    await user.type(notaInput, 'Llevar dos equipaciones');
    expect(screen.getByDisplayValue(/Llevar dos equipaciones/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (fail)**

```bash
npx vitest run src/components/calendar/ConvocatoriaModal.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/calendar/ConvocatoriaModal.jsx`:

```jsx
import React, { useId, useState, useMemo } from 'react';
import { X, Copy, Send, RotateCcw } from 'lucide-react';
import Dialog from '../Dialog';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { saveCalendarSession } from '../../services/calendarService';
import { savePlayoffConvocatoria } from '../../services/playoffConvocatoriasService';
import { renderConvocatoria } from '../../utils/convocatoriaTemplate';

export default function ConvocatoriaModal({ session, team, competition, onClose }) {
  const titleId = useId();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [notaExtra, setNotaExtra] = useState(session.notaExtra || '');
  const [horaCitaOverride, setHoraCitaOverride] = useState(session.horaCita || '');
  const [editedMessage, setEditedMessage] = useState(null);
  const [usingSnapshot, setUsingSnapshot] = useState(!!session.mensajeConvocatoria);
  const [submitting, setSubmitting] = useState(false);

  const rendered = useMemo(() => {
    const sessionForRender = { ...session, notaExtra, horaCita: horaCitaOverride || undefined };
    return renderConvocatoria({ session: sessionForRender, team, competition, now: new Date() });
  }, [session, team, competition, notaExtra, horaCitaOverride]);

  const messageToShow =
    usingSnapshot && session.mensajeConvocatoria
      ? (editedMessage ?? session.mensajeConvocatoria)
      : (editedMessage ?? rendered.mensaje);

  async function persistSent(finalMessage) {
    if (session.tipo === 'playoff') {
      await savePlayoffConvocatoria(
        {
          sessionId: session.id,
          bracketId: session.bracketId,
          bracketMatchId: session.bracketMatchId,
          gameIndex: session.gameIndex || 0,
          mensajeConvocatoria: finalMessage,
          convocatoriaSentAt: new Date(),
          notaExtra,
          horaCita: horaCitaOverride || null,
        },
        { uid: user.uid, db, appId },
      );
    } else {
      await saveCalendarSession(
        {
          ...session,
          mensajeConvocatoria: finalMessage,
          convocatoriaSentAt: new Date(),
          notaExtra,
          horaCita: horaCitaOverride || null,
        },
        { uid: user.uid, db, appId },
      );
    }
  }

  async function handleCopy() {
    setSubmitting(true);
    try {
      await navigator.clipboard.writeText(messageToShow);
      await persistSent(messageToShow);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    setSubmitting(true);
    try {
      const url = `whatsapp://send?text=${encodeURIComponent(messageToShow)}`;
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ text: messageToShow });
        } catch {
          window.location.href = url;
        }
      } else {
        window.location.href = url;
      }
      await persistSent(messageToShow);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  function handleRegenerate() {
    setUsingSnapshot(false);
    setEditedMessage(null);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[120] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-5.5rem)] sm:max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 my-auto shrink-0"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
        <h3 id={titleId} className="text-lg font-bold text-slate-800">
          Mandar convocatoria
        </h3>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Nota extra (opcional)"
            value={notaExtra}
            onChange={(e) => {
              setNotaExtra(e.target.value);
              setEditedMessage(null);
            }}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={horaCitaOverride}
            placeholder="Hora cita override"
            onChange={(e) => {
              setHoraCitaOverride(e.target.value);
              setEditedMessage(null);
            }}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={messageToShow}
          onChange={(e) => setEditedMessage(e.target.value)}
          rows={14}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-sans"
        />
        {usingSnapshot && (
          <button
            type="button"
            onClick={handleRegenerate}
            className="text-xs text-slate-500 hover:text-slate-700 self-start flex items-center gap-1"
          >
            <RotateCcw size={12} aria-hidden="true" /> Regenerar desde plantilla
          </button>
        )}
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={submitting}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Copy size={15} aria-hidden="true" /> Copiar
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={submitting}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Send size={15} aria-hidden="true" /> Compartir por WhatsApp
        </button>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test (pass)**

```bash
npx vitest run src/components/calendar/ConvocatoriaModal.test.jsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/ConvocatoriaModal.jsx src/components/calendar/ConvocatoriaModal.test.jsx
git commit -m "feat(convocatorias): add ConvocatoriaModal with copy + WhatsApp share"
```

### Task 6.2: Wire ConvocatoriaModal into SessionDetailModal

**Files:**

- Modify: `src/components/calendar/SessionDetailModal.jsx`

- [ ] **Step 1: Add the button + state**

In `src/components/calendar/SessionDetailModal.jsx`:

Add the imports:

```jsx
import { Send } from 'lucide-react';
import ConvocatoriaModal from './ConvocatoriaModal';
import { useCompetitions } from '../../hooks/useCompetitions';
```

Inside the component, add state:

```jsx
const [showConvocatoria, setShowConvocatoria] = useState(false);
const { competitions } = useCompetitions(session.teamId);
const team = teams.find((t) => t.id === session.teamId) || null;
const competition = (competitions || []).find((c) => c.id === session.competitionId) || null;
```

In the actions column, add (after the other partido/playoff buttons):

```jsx
{
  (session.tipo === 'partido' || session.tipo === 'playoff') && (
    <button
      type="button"
      onClick={() => setShowConvocatoria(true)}
      className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
    >
      <Send size={16} aria-hidden="true" />
      {session.convocatoriaSentAt ? '✓ Convocatoria enviada — reenviar' : 'Mandar convocatoria'}
    </button>
  );
}
```

At the end of the component (before the closing tag), render the modal:

```jsx
{
  showConvocatoria && (
    <ConvocatoriaModal
      session={session}
      team={team}
      competition={competition}
      onClose={() => setShowConvocatoria(false)}
    />
  );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open a partido detail → click "Mandar convocatoria" → modal opens with rendered message → Copy works → re-open shows "✓ Convocatoria enviada — reenviar".

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/SessionDetailModal.jsx
git commit -m "feat(calendar): wire ConvocatoriaModal into SessionDetailModal"
```

### Task 6.3: Add mini-icon Send in calendar cells

**Files:**

- Modify: `src/components/calendar/MonthGrid.jsx`
- Modify: `src/components/calendar/WeekView.jsx`
- Modify: `src/components/calendar/DayView.jsx`
- Modify: `src/screens/CalendarScreen.jsx` (lift modal state)

- [ ] **Step 1: Lift state in CalendarScreen**

In `src/screens/CalendarScreen.jsx`, add:

```jsx
import ConvocatoriaModal from '../components/calendar/ConvocatoriaModal';
import { useCompetitions } from '../hooks/useCompetitions';

const [convocatoriaSession, setConvocatoriaSession] = useState(null);
```

Build a per-team competitions index (subscribe to all teams' competitions or fetch on demand). Simpler: when `convocatoriaSession` is set, use a child component that takes `teamId` and renders the modal:

```jsx
function ConvocatoriaModalLoader({ session, teams, onClose }) {
  const team = teams.find((t) => t.id === session.teamId) || null;
  const { competitions } = useCompetitions(session.teamId);
  const competition = (competitions || []).find((c) => c.id === session.competitionId) || null;
  return <ConvocatoriaModal session={session} team={team} competition={competition} onClose={onClose} />;
}
```

Pass `setConvocatoriaSession` down to `MonthGrid`, `WeekView`, `DayView` as `onConvocatoriaClick`.

Render at the screen end:

```jsx
{
  convocatoriaSession && (
    <ConvocatoriaModalLoader session={convocatoriaSession} teams={teams} onClose={() => setConvocatoriaSession(null)} />
  );
}
```

- [ ] **Step 2: Add the icon in MonthGrid**

In each cell that renders a session of `tipo: partido | playoff`, conditionally show a `Send` icon if `!session.convocatoriaSentAt && session.fecha + horaInicio is in the future`. Pseudocode:

```jsx
import { Send } from 'lucide-react';

function shouldShowSendIcon(session, now = new Date()) {
  if (!['partido', 'playoff'].includes(session.tipo)) return false;
  if (session.convocatoriaSentAt) return false;
  if (!session.fecha) return false;
  const start = new Date(`${session.fecha}T${session.horaInicio || '00:00'}`);
  return start.getTime() > now.getTime();
}
```

In the cell render, add the icon button absolutely positioned in a corner:

```jsx
{
  shouldShowSendIcon(session) && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onConvocatoriaClick(session);
      }}
      aria-label="Mandar convocatoria"
      className="absolute top-0.5 right-0.5 text-rose-500 hover:text-rose-700 bg-white/80 rounded p-0.5"
    >
      <Send size={11} aria-hidden="true" />
    </button>
  );
}
```

Apply the same in `WeekView.jsx` and `DayView.jsx`.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Each future, unsent partido/playoff in the calendar shows a small `Send` icon. Clicking it opens the modal directly.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/MonthGrid.jsx src/components/calendar/WeekView.jsx src/components/calendar/DayView.jsx src/screens/CalendarScreen.jsx
git commit -m "feat(calendar): add mini Send icon for pending convocatoria on calendar cells"
```

---

## Phase 7 — Pendientes system

### Task 7.1: Build pendientes computation utility

**Files:**

- Create: `src/utils/convocatoriaPendientes.js`
- Test: `src/utils/convocatoriaPendientes.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/utils/convocatoriaPendientes.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildConvocatoriaPendientes, buildCumpleañosDelDia } from './convocatoriaPendientes';

const NOW = new Date('2026-04-29T10:00:00');
const teamA = { id: 'tA', convocatoriaReminderHours: 72, teamName: 'Cadete A' };

describe('buildConvocatoriaPendientes', () => {
  it('includes session within window not yet sent', () => {
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-04-30', horaInicio: '18:00', rival: 'X' },
    ];
    const items = buildConvocatoriaPendientes(sessions, [teamA], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('convocatoria');
  });

  it('excludes already sent', () => {
    const sessions = [
      {
        id: 's1',
        teamId: 'tA',
        tipo: 'partido',
        fecha: '2026-04-30',
        horaInicio: '18:00',
        rival: 'X',
        convocatoriaSentAt: new Date(),
      },
    ];
    expect(buildConvocatoriaPendientes(sessions, [teamA], NOW)).toHaveLength(0);
  });

  it('excludes past sessions', () => {
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-04-28', horaInicio: '18:00', rival: 'X' },
    ];
    expect(buildConvocatoriaPendientes(sessions, [teamA], NOW)).toHaveLength(0);
  });

  it('excludes sessions outside reminder window', () => {
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-05-15', horaInicio: '18:00', rival: 'X' },
    ];
    expect(buildConvocatoriaPendientes(sessions, [teamA], NOW)).toHaveLength(0);
  });

  it('marks severity high when <24h', () => {
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-04-29', horaInicio: '18:00', rival: 'X' },
    ];
    const items = buildConvocatoriaPendientes(sessions, [teamA], NOW);
    expect(items[0].severity).toBe('high');
  });

  it('uses default 72h when team has no override', () => {
    const team = { id: 'tA' };
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-05-01', horaInicio: '18:00', rival: 'X' },
    ];
    expect(buildConvocatoriaPendientes(sessions, [team], NOW)).toHaveLength(1);
  });
});

describe('buildCumpleañosDelDia', () => {
  it('matches member born today', () => {
    const member = { id: 'm1', nombre: 'Pablo', fechaNacimiento: '2010-04-29', teamId: 'tA', tipo: 'jugador' };
    const items = buildCumpleañosDelDia([member], [teamA], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe('high');
  });

  it('matches member born tomorrow', () => {
    const member = { id: 'm1', nombre: 'Pablo', fechaNacimiento: '2010-04-30', teamId: 'tA' };
    const items = buildCumpleañosDelDia([member], [teamA], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe('normal');
  });

  it('skips members with no birthday', () => {
    const member = { id: 'm1', nombre: 'Pablo', teamId: 'tA' };
    expect(buildCumpleañosDelDia([member], [teamA], NOW)).toHaveLength(0);
  });

  it('29-feb falls back to 28-feb in non-leap years', () => {
    const member = { id: 'm1', nombre: 'Pablo', fechaNacimiento: '2008-02-29', teamId: 'tA' };
    const nonLeap = new Date('2026-02-28T10:00:00');
    const items = buildCumpleañosDelDia([member], [teamA], nonLeap);
    expect(items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run (fail)**

```bash
npx vitest run src/utils/convocatoriaPendientes.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/utils/convocatoriaPendientes.js`:

```js
function startTimestamp(session) {
  const [h, m] = (session.horaInicio || '00:00').split(':').map(Number);
  const [Y, M, D] = session.fecha.split('-').map(Number);
  return new Date(Y, M - 1, D, h || 0, m || 0).getTime();
}

export function buildConvocatoriaPendientes(sessions, teams, now = new Date()) {
  const result = [];
  const teamsById = new Map((teams || []).map((t) => [t.id, t]));
  const nowMs = now.getTime();

  for (const s of sessions || []) {
    if (!['partido', 'playoff'].includes(s.tipo)) continue;
    if (s.convocatoriaSentAt) continue;
    if (!s.fecha) continue;
    const startMs = startTimestamp(s);
    if (startMs <= nowMs) continue;
    const team = teamsById.get(s.teamId);
    const ventanaH = team?.convocatoriaReminderHours ?? 72;
    const horas = (startMs - nowMs) / 3600000;
    if (horas > ventanaH) continue;
    result.push({
      id: `convocatoria-${s.id}`,
      type: 'convocatoria',
      session: s,
      team,
      label: `Mandar convocatoria — vs ${s.rival || 'rival'}`,
      severity: horas < 24 ? 'high' : 'normal',
    });
  }
  return result.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return startTimestamp(a.session) - startTimestamp(b.session);
  });
}

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function birthdayOnDay(fechaNac, day) {
  const [, m, d] = fechaNac.split('-').map(Number);
  const sameMonthDay = day.getMonth() === m - 1 && day.getDate() === d;
  if (sameMonthDay) return true;
  if (m === 2 && d === 29 && day.getMonth() === 1 && day.getDate() === 28 && !isLeap(day.getFullYear())) return true;
  return false;
}

function ageOn(fechaNac, day) {
  const [Y, M, D] = fechaNac.split('-').map(Number);
  let age = day.getFullYear() - Y;
  if (day.getMonth() < M - 1 || (day.getMonth() === M - 1 && day.getDate() < D)) age -= 1;
  return age;
}

export function buildCumpleañosDelDia(members, teams, now = new Date()) {
  const result = [];
  const teamsById = new Map((teams || []).map((t) => [t.id, t]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  for (const m of members || []) {
    if (!m.fechaNacimiento || typeof m.fechaNacimiento !== 'string') continue;
    if (birthdayOnDay(m.fechaNacimiento, today)) {
      result.push({
        id: `cumpleaños-${m.id}-${today.getFullYear()}`,
        type: 'cumpleaños',
        member: m,
        team: teamsById.get(m.teamId),
        label: `Hoy cumple ${m.nombre}`,
        severity: 'high',
        age: ageOn(m.fechaNacimiento, today),
      });
    } else if (birthdayOnDay(m.fechaNacimiento, tomorrow)) {
      result.push({
        id: `cumpleaños-${m.id}-${tomorrow.getFullYear()}-tomorrow`,
        type: 'cumpleaños',
        member: m,
        team: teamsById.get(m.teamId),
        label: `Mañana cumple ${m.nombre}`,
        severity: 'normal',
        age: ageOn(m.fechaNacimiento, tomorrow),
      });
    }
  }
  return result;
}
```

- [ ] **Step 4: Run (pass)**

```bash
npx vitest run src/utils/convocatoriaPendientes.test.js
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/convocatoriaPendientes.js src/utils/convocatoriaPendientes.test.js
git commit -m "feat(pendientes): add buildConvocatoriaPendientes + buildCumpleañosDelDia"
```

### Task 7.2: Subscribe to all-team members for cumpleaños

**Files:**

- Modify: `src/services/teamsService.js`
- Modify: `src/hooks/useHomeDashboard.js` (read it first)

- [ ] **Step 1: Read useHomeDashboard**

```bash
ls src/hooks/useHomeDashboard.js
```

Read it to know the current shape (teams, sessions, etc.).

- [ ] **Step 2: Add an aggregator helper**

In `src/services/teamsService.js`, append:

```js
import { onSnapshot, query } from 'firebase/firestore';

export function subscribeToAllMembers(teams, uid, db, appId, callback) {
  const unsubs = [];
  const byTeam = new Map();

  function emit() {
    const all = [];
    for (const [teamId, members] of byTeam.entries()) {
      members.forEach((m) => all.push({ ...m, teamId }));
    }
    callback(all);
  }

  for (const t of teams) {
    const u = onSnapshot(query(membersCol(t.id, uid, db, appId)), (snap) => {
      byTeam.set(
        t.id,
        snap.docs.map((d) => ({ ...d.data(), id: d.id })),
      );
      emit();
    });
    unsubs.push(u);
  }
  return () => unsubs.forEach((u) => u());
}
```

- [ ] **Step 3: Extend useHomeDashboard to expose allMembers**

In `src/hooks/useHomeDashboard.js`, add a state:

```js
const [allMembers, setAllMembers] = useState([]);

useEffect(() => {
  if (!user || !db || teams.length === 0) {
    setAllMembers([]);
    return;
  }
  const unsub = subscribeToAllMembers(teams, user.uid, db, appId, setAllMembers);
  return unsub;
}, [user, db, appId, teams]);
```

Add `allMembers` to the returned object.

- [ ] **Step 4: Commit**

```bash
git add src/services/teamsService.js src/hooks/useHomeDashboard.js
git commit -m "feat(home): subscribe to all teams' members for cumpleaños"
```

### Task 7.3: Extend PendingActionsList with new types

**Files:**

- Modify: `src/components/home/PendingActionsList.jsx`
- Modify: `src/utils/homeUtils.js`

- [ ] **Step 1: Update PendingActionsList**

In `src/components/home/PendingActionsList.jsx`, extend `ItemIcon`:

```jsx
import { AlertCircle, ClipboardList, Trophy, ArrowRight, CheckCircle2, Send, Cake } from 'lucide-react';

function ItemIcon({ type }) {
  if (type === 'result')
    return (
      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
        <Trophy size={18} className="text-amber-600" aria-hidden="true" />
      </div>
    );
  if (type === 'convocatoria')
    return (
      <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
        <Send size={18} className="text-rose-600" aria-hidden="true" />
      </div>
    );
  if (type === 'cumpleaños')
    return (
      <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
        <Cake size={18} className="text-violet-600" aria-hidden="true" />
      </div>
    );
  return (
    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
      <ClipboardList size={18} className="text-blue-600" aria-hidden="true" />
    </div>
  );
}
```

The list rendering already iterates items. Update the `<DateChip>` block to handle items without sessions (cumpleaños have no session):

```jsx
{
  item.session && <DateChip session={item.session} severity={item.severity} />;
}
```

Also truncate to 10 with overflow CTA. Find the `items.map` and replace with:

```jsx
const visibleItems = items.slice(0, 10);
const overflow = items.length - visibleItems.length;
```

Then iterate `visibleItems`. After the list, add:

```jsx
{
  overflow > 0 && (
    <li className="px-4 py-2 text-center">
      <a href="/pendientes" className="text-sm text-blue-600 hover:text-blue-800 font-bold">
        +{overflow} más
      </a>
    </li>
  );
}
```

- [ ] **Step 2: Extend homeUtils to feed pendientes**

In `src/utils/homeUtils.js`, find the function that produces pending items (likely something like `buildPendingItems`). Append the new types:

```js
import { buildConvocatoriaPendientes, buildCumpleañosDelDia } from './convocatoriaPendientes';

// Inside the existing pending-items builder (or a new helper),
// concatenate the new generators:
export function buildAllPendientes({ sessions, teams, members, now = new Date(), existingItems = [] }) {
  return [
    ...existingItems,
    ...buildConvocatoriaPendientes(sessions, teams, now),
    ...buildCumpleañosDelDia(members, teams, now),
  ];
}
```

Whoever calls `<PendingActionsList items={...} />` (likely `useHomeDashboard` or `HomeScreen`) needs to pass the merged items list. Locate the call site and add the new generators.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/PendingActionsList.jsx src/utils/homeUtils.js
git commit -m "feat(home): extend PendingActionsList with convocatoria and cumpleaños types"
```

### Task 7.4: Wire item taps to actions

**Files:**

- Modify: `src/screens/DashboardScreen.jsx` (where `PendingActionsList` is rendered)

- [ ] **Step 1: Locate the dashboard handler**

Find where `<PendingActionsList ... onAction={...}>` is rendered. Inspect what `onAction(item)` does today.

- [ ] **Step 2: Extend onAction**

For `item.type === 'convocatoria'`: open `ConvocatoriaModal` for `item.session`.
For `item.type === 'cumpleaños'`: open a passive modal showing member info.

```jsx
import ConvocatoriaModal from '../components/calendar/ConvocatoriaModal';
import CumpleañosModal from '../components/home/CumpleañosModal';

const [convocatoriaSession, setConvocatoriaSession] = useState(null);
const [cumpleañosItem, setCumpleañosItem] = useState(null);

const handlePendingAction = (item) => {
  if (item.type === 'convocatoria') setConvocatoriaSession(item.session);
  else if (item.type === 'cumpleaños') setCumpleañosItem(item);
  else /* existing handlers */ ;
};
```

- [ ] **Step 3: Create CumpleañosModal**

Create `src/components/home/CumpleañosModal.jsx`:

```jsx
import React, { useId } from 'react';
import { X, Cake } from 'lucide-react';
import Dialog from '../Dialog';

const SEEN_KEY = (memberId, year) => `cumpleañosSeen-${memberId}-${year}`;

export default function CumpleañosModal({ item, onClose }) {
  const titleId = useId();
  const m = item.member;

  function handleSeen() {
    try {
      localStorage.setItem(SEEN_KEY(m.id, new Date().getFullYear()), '1');
    } catch {}
    onClose();
  }

  const sub =
    m.tipo === 'staff'
      ? `${item.team?.teamName || ''}${m.rol ? ` · ${m.rol}` : ''}`
      : `${item.team?.teamName || ''}${m.dorsal ? ` · #${m.dorsal}` : ''}`;

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[120] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 my-auto shrink-0"
    >
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <Cake size={20} className="text-violet-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 id={titleId} className="font-bold text-slate-800">
            {item.label}
          </h3>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-slate-600">Cumple {item.age} años.</p>
      </div>
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={handleSeen}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl"
        >
          Marcar como visto
        </button>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/DashboardScreen.jsx src/components/home/CumpleañosModal.jsx
git commit -m "feat(home): wire pendientes item taps to convocatoria and cumpleaños modals"
```

### Task 7.5: Add /pendientes route

**Files:**

- Create: `src/screens/PendientesScreen.jsx`
- Modify: `src/shell/AppRouter.jsx`

- [ ] **Step 1: Create the screen**

Create `src/screens/PendientesScreen.jsx`:

```jsx
import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHomeDashboard } from '../hooks/useHomeDashboard';
import PendingActionsList from '../components/home/PendingActionsList';
import { buildAllPendientes } from '../utils/homeUtils';
import ConvocatoriaModal from '../components/calendar/ConvocatoriaModal';
import CumpleañosModal from '../components/home/CumpleañosModal';
import { useCompetitions } from '../hooks/useCompetitions';

export default function PendientesScreen() {
  const navigate = useNavigate();
  const { teams, allSessions: sessions, allMembers } = useHomeDashboard();
  const [filterType, setFilterType] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');
  const [convocatoriaSession, setConvocatoriaSession] = useState(null);
  const [cumpleañosItem, setCumpleañosItem] = useState(null);

  const items = buildAllPendientes({ sessions, teams, members: allMembers });
  const filtered = items.filter((i) => {
    if (filterType !== 'all' && i.type !== filterType) return false;
    if (filterTeam !== 'all' && i.team?.id !== filterTeam) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm font-bold mb-4"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Volver
        </button>
        <h1 className="text-2xl font-black text-slate-900 mb-4">Pendientes</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            ['all', 'Todos'],
            ['convocatoria', 'Convocatorias'],
            ['cumpleaños', 'Cumpleaños'],
            ['result', 'Resultados'],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilterType(v)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full ${filterType === v ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              {label}
            </button>
          ))}
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600"
          >
            <option value="all">Todos los equipos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.teamName}
              </option>
            ))}
          </select>
        </div>
        <PendingActionsList
          items={filtered}
          onAction={(item) => {
            if (item.type === 'convocatoria') setConvocatoriaSession(item.session);
            else if (item.type === 'cumpleaños') setCumpleañosItem(item);
          }}
        />
      </div>
      {convocatoriaSession && (
        <ConvocatoriaModalLoader
          session={convocatoriaSession}
          teams={teams}
          onClose={() => setConvocatoriaSession(null)}
        />
      )}
      {cumpleañosItem && <CumpleañosModal item={cumpleañosItem} onClose={() => setCumpleañosItem(null)} />}
    </div>
  );
}

function ConvocatoriaModalLoader({ session, teams, onClose }) {
  const team = teams.find((t) => t.id === session.teamId) || null;
  const { competitions } = useCompetitions(session.teamId);
  const competition = (competitions || []).find((c) => c.id === session.competitionId) || null;
  return <ConvocatoriaModal session={session} team={team} competition={competition} onClose={onClose} />;
}
```

- [ ] **Step 2: Wire the route**

In `src/shell/AppRouter.jsx`, add the lazy-loaded route:

```jsx
const PendientesScreen = lazy(() => import('../screens/PendientesScreen'));

// inside <Routes>:
<Route
  path="/pendientes"
  element={
    <ModuleBoundary>
      <PendientesScreen />
    </ModuleBoundary>
  }
/>;
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/PendientesScreen.jsx src/shell/AppRouter.jsx
git commit -m "feat(pendientes): add /pendientes overview route with filters"
```

---

## Phase 8 — Pick integration

### Task 8.1: Mirror engine to functions/src/shared

The Pick tool runs in Cloud Functions (Node, TS), so the engine needs a TS version. We can copy the JS file into `functions/src/shared/convocatoriaTemplate.ts` and add types.

**Files:**

- Create: `functions/src/shared/convocatoriaTemplate.ts`
- Create: `functions/src/shared/convocatoriaTemplate.test.ts`

- [ ] **Step 1: Port engine to TS**

Create `functions/src/shared/convocatoriaTemplate.ts` (port from `src/utils/convocatoriaTemplate.js`):

```ts
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export interface CompetitionShape {
  id: string;
  nombre: string;
  fases: Array<{ id: string; nombre: string; jornadas: number }>;
}

export interface SessionShape {
  tipo: 'partido' | 'playoff' | 'entrenamiento';
  fecha?: string;
  horaInicio?: string;
  horaCita?: string;
  rival?: string;
  lugar?: string;
  lugarMapsUrl?: string;
  esLocal?: boolean;
  competitionId?: string | null;
  faseId?: string | null;
  jornadaNumero?: number | null;
  notaExtra?: string;
  matchTitle?: string;
  gameIndex?: number;
}

export interface TeamShape {
  id: string;
  citaOffsetMinutos?: number;
  plantillaConvocatoria?: string;
  categoria?: string;
}

function ymdToLocalDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function diffDays(target: Date, now: Date) {
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t.getTime() - n.getTime()) / 86400000);
}
function fechaRelativa(ymd: string, now: Date) {
  const t = ymdToLocalDate(ymd);
  const d = diffDays(t, now);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d >= 2 && d <= 6) return `el ${DIAS_SEMANA[t.getDay()]}`;
  return `el ${t.getDate()} de ${MESES[t.getMonth()]}`;
}
function saludoFromHour(h: number) {
  if (h >= 18) return 'Buenas noches';
  if (h >= 14) return 'Buenas tardes';
  return 'Buenos días';
}

function vueltaSuffix(fase: CompetitionShape['fases'][number] | undefined, jornadaNumero: number) {
  if (!fase || !Number.isFinite(fase.jornadas)) return '';
  if (fase.jornadas % 2 !== 0) return '';
  const half = Math.floor(fase.jornadas / 2);
  return jornadaNumero <= half ? ' (1ª vuelta)' : ' (2ª vuelta)';
}

function generarEncabezado(session: SessionShape, competition: CompetitionShape | null) {
  const rival = session?.rival || 'Rival';
  if (session?.tipo === 'playoff') {
    const matchTitle = session.matchTitle || 'Eliminatoria';
    const game = (session.gameIndex || 0) + 1;
    return `*Playoffs ${matchTitle}*\n_Jornada ${game} vs ${rival}_`;
  }
  if (!session?.competitionId || !competition) return `*Amistoso*\n_vs ${rival}_`;
  const fase = competition.fases.find((f) => f.id === session.faseId);
  if (!fase) return `*${competition.nombre}*\n_vs ${rival}_`;
  const vuelta = vueltaSuffix(fase, session.jornadaNumero || 0);
  return `*${competition.nombre} — ${fase.nombre}${vuelta}*\n_Jornada ${session.jornadaNumero} vs ${rival}_`;
}

function computeHoraCita(horaInicio: string | undefined, offsetMin: number) {
  if (!horaInicio) return '';
  const [h, m] = horaInicio.split(':').map(Number);
  const total = h * 60 + m - offsetMin;
  if (total < 0) return '';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const DEFAULT_TEMPLATE = [
  '{saludo}.',
  '',
  '{ENCABEZADO}',
  '',
  'Jugamos {fechaRelativa} a las {horaInicio} en {lugar}{lugarUrlSiVisitante}.',
  '',
  'Quedamos {citaSiVisitante} a las {horaCita}.',
  '',
  '{notaExtra}',
  '',
  'Nos vemos {fechaRelativaNosVemos}!',
  '🏀💪🏻',
].join('\n');

export interface RenderInput {
  session: SessionShape;
  team: TeamShape | null;
  competition: CompetitionShape | null;
  now?: Date;
}

export interface RenderOutput {
  mensaje: string;
  encabezado: string;
}

export function renderConvocatoria({ session, team, competition, now }: RenderInput): RenderOutput {
  const N = now || new Date();
  const offset = team?.citaOffsetMinutos ?? 45;
  const horaCita = session.horaCita || computeHoraCita(session.horaInicio, offset);
  const isLocal = !!session.esLocal;
  const fechaRel = session.fecha ? fechaRelativa(session.fecha, N) : '';
  const variables: Record<string, string> = {
    saludo: saludoFromHour(N.getHours()),
    ENCABEZADO: generarEncabezado(session, competition),
    rival: session.rival || '',
    fechaRelativa: fechaRel,
    horaInicio: session.horaInicio || '',
    horaCita,
    lugar: session.lugar || '',
    lugarUrlSiVisitante: !isLocal && session.lugarMapsUrl ? ` ${session.lugarMapsUrl}` : '',
    citaSiVisitante: isLocal ? 'en el pabellón' : 'allí',
    notaExtra: session.notaExtra || '',
    fechaRelativaNosVemos: fechaRel,
  };
  const template = (team?.plantillaConvocatoria && team.plantillaConvocatoria.trim()) || DEFAULT_TEMPLATE;
  const lines = template.split('\n').filter((line) => {
    const vars = line.match(/\{([A-Za-z]+)\}/g) || [];
    if (vars.length === 0) return true;
    return !vars.every((v) => !variables[v.slice(1, -1)]);
  });
  const mensaje = lines
    .map((l) => l.replace(/\{([A-Za-z]+)\}/g, (_m, n) => variables[n] ?? ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { mensaje, encabezado: variables.ENCABEZADO };
}
```

- [ ] **Step 2: Add a parity test (one happy-path scenario)**

Create `functions/src/shared/convocatoriaTemplate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderConvocatoria } from './convocatoriaTemplate';

describe('renderConvocatoria (TS port)', () => {
  it('renders liga visitante with default template', () => {
    const out = renderConvocatoria({
      session: {
        tipo: 'partido',
        fecha: '2026-04-30',
        horaInicio: '09:30',
        rival: 'Movistar',
        lugar: 'Ramiro de Maeztu',
        lugarMapsUrl: 'https://maps.app.goo.gl/x',
        esLocal: false,
        competitionId: 'c1',
        faseId: 'f1',
        jornadaNumero: 15,
      },
      team: { id: 't1', categoria: 'Cadete', citaOffsetMinutos: 45 },
      competition: { id: 'c1', nombre: 'Liga', fases: [{ id: 'f1', nombre: 'Fase 1', jornadas: 22 }] },
      now: new Date('2026-04-29T22:00:00'),
    });
    expect(out.mensaje).toContain('Buenas noches');
    expect(out.mensaje).toContain('(2ª vuelta)');
    expect(out.mensaje).toContain('Quedamos allí a las 08:45');
  });
});
```

- [ ] **Step 3: Run**

```bash
cd functions && npx vitest run src/shared/convocatoriaTemplate.test.ts
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add functions/src/shared/convocatoriaTemplate.ts functions/src/shared/convocatoriaTemplate.test.ts
git commit -m "feat(pick): port convocatoria engine to TS for Cloud Functions"
```

### Task 8.2: Add Pick tool `mandar_convocatoria`

**Files:**

- Modify: `functions/src/ai/tools/writeTools.ts`

- [ ] **Step 1: Read existing tools registry**

```bash
cat functions/src/ai/tools/registry.ts
```

Understand the `ToolDefinition` shape and how the orchestrator emits content blocks.

- [ ] **Step 2: Add the tool**

Append a tool to the array returned by `createWriteTools()` in `functions/src/ai/tools/writeTools.ts`:

```ts
{
  name: 'mandar_convocatoria',
  description:
    'Genera el mensaje de convocatoria de un partido próximo del usuario. Devuelve el texto listo para que el entrenador lo copie/comparta. NO envía nada — solo prepara el mensaje. Usa esto cuando el usuario pida "convocatoria", "mensaje del partido", "avisar al grupo" o similar.',
  isWrite: false,
  parameters: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'ID de la sesión (puede ser playoff virtual: playoff-...)' },
      notaExtra: { type: 'string', description: 'Nota adicional para añadir al mensaje (opcional)' },
      horaCitaOverride: { type: 'string', description: 'Override de la hora de cita HH:mm (opcional)' },
    },
    required: ['sessionId'],
  },
  handler: async (args, ctx) => {
    const sessionId = String(args.sessionId);
    const { db, appId, uid } = ctx as any;

    // Resolve session: real (Firestore) or virtual (playoff bracket)
    let session: any = null;
    let teamId: string | null = null;
    if (sessionId.startsWith('playoff-')) {
      // Walk the brackets to find the virtual session
      const bracketsSnap = await db.collection(`artifacts/${appId}/users/${uid}/brackets`).get();
      for (const bDoc of bracketsSnap.docs) {
        const bracket = bDoc.data();
        const state = bracket.bracketData?.state || {};
        for (const m of Object.values<any>(state)) {
          const match = m;
          const dates = match.dates || [];
          for (let gi = 0; gi < dates.length; gi++) {
            const candidateId = `playoff-${bDoc.id}-${match.id}-${gi}`;
            if (candidateId === sessionId) {
              const isMyTeamTeam1 = match.team1 === bracket.myTeam;
              session = {
                id: sessionId,
                tipo: 'playoff',
                fecha: dates[gi],
                horaInicio: (match.times || [])[gi],
                rival: isMyTeamTeam1 ? match.team2 : match.team1,
                lugar: (match.places || [])[gi],
                esLocal: isMyTeamTeam1,
                matchTitle: match.title,
                gameIndex: gi,
              };
              teamId = bracket.teamId;
              if (args.notaExtra) session.notaExtra = String(args.notaExtra);
              if (args.horaCitaOverride) session.horaCita = String(args.horaCitaOverride);
            }
          }
        }
      }
    } else {
      const ref = db.doc(`artifacts/${appId}/users/${uid}/calendarSessions/${sessionId}`);
      const snap = await ref.get();
      if (snap.exists) {
        session = { id: snap.id, ...snap.data() };
        teamId = session.teamId;
        if (args.notaExtra) session.notaExtra = String(args.notaExtra);
        if (args.horaCitaOverride) session.horaCita = String(args.horaCitaOverride);
      }
    }

    if (!session) return { error: `No se encontró la sesión ${sessionId}.` };
    if (!teamId) return { error: 'La sesión no tiene equipo asociado.' };

    const teamSnap = await db.doc(`artifacts/${appId}/users/${uid}/teams/${teamId}`).get();
    const team = teamSnap.exists ? { id: teamSnap.id, ...teamSnap.data() } : null;

    let competition: any = null;
    if (session.competitionId) {
      const cSnap = await db.doc(`artifacts/${appId}/users/${uid}/teams/${teamId}/competitions/${session.competitionId}`).get();
      if (cSnap.exists) competition = { id: cSnap.id, ...cSnap.data() };
    }

    const { renderConvocatoria } = await import('../../shared/convocatoriaTemplate');
    const { mensaje, encabezado } = renderConvocatoria({ session, team, competition });

    return {
      kind: 'convocatoria_block',
      sessionId,
      mensaje,
      encabezado,
      sessionRef: { tipo: session.tipo, fecha: session.fecha, rival: session.rival, lugar: session.lugar },
    };
  },
},
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/ai/tools/writeTools.ts
git commit -m "feat(pick): add mandar_convocatoria tool"
```

### Task 8.3: Add Pick tool `listar_partidos_pendientes_convocatoria`

**Files:**

- Modify: `functions/src/ai/tools/readTools.ts`

- [ ] **Step 1: Read existing read tool patterns**

```bash
head -60 functions/src/ai/tools/readTools.ts
```

- [ ] **Step 2: Add the tool**

Append to the array returned in `readTools.ts`:

```ts
{
  name: 'listar_partidos_pendientes_convocatoria',
  description:
    'Lista los partidos próximos del usuario que aún no tienen convocatoria enviada, dentro de la ventana de aviso configurada del equipo.',
  isWrite: false,
  parameters: {
    type: 'object',
    properties: {
      teamId: { type: 'string', description: 'Filtrar por equipo (opcional)' },
      limit: { type: 'number', description: 'Máximo de items (default 10)' },
    },
  },
  handler: async (args, ctx) => {
    const { db, appId, uid } = ctx as any;
    const limit = typeof args.limit === 'number' ? args.limit : 10;
    const now = Date.now();
    const futureLimit = now + 30 * 24 * 3600 * 1000;
    const todayYmd = new Date(now).toISOString().slice(0, 10);

    const sessionsSnap = await db
      .collection(`artifacts/${appId}/users/${uid}/calendarSessions`)
      .where('fecha', '>=', todayYmd)
      .orderBy('fecha', 'asc')
      .limit(50)
      .get();

    const teamsSnap = await db.collection(`artifacts/${appId}/users/${uid}/teams`).get();
    const teamsById = new Map<string, any>();
    teamsSnap.docs.forEach((d: any) => teamsById.set(d.id, { id: d.id, ...d.data() }));

    const items: any[] = [];
    for (const d of sessionsSnap.docs) {
      const s = { id: d.id, ...d.data() } as any;
      if (!['partido', 'playoff'].includes(s.tipo)) continue;
      if (s.convocatoriaSentAt) continue;
      if (args.teamId && s.teamId !== args.teamId) continue;
      const team = teamsById.get(s.teamId);
      const ventanaH = team?.convocatoriaReminderHours ?? 72;
      const [h, m] = (s.horaInicio || '00:00').split(':').map(Number);
      const [Y, M, D] = s.fecha.split('-').map(Number);
      const startMs = new Date(Y, M - 1, D, h || 0, m || 0).getTime();
      const horas = (startMs - now) / 3600000;
      if (horas > ventanaH || horas <= 0) continue;
      items.push({
        sessionId: s.id, fecha: s.fecha, rival: s.rival, horaInicio: s.horaInicio,
        severity: horas < 24 ? 'high' : 'normal',
      });
      if (items.length >= limit) break;
    }
    return { items };
  },
},
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/ai/tools/readTools.ts
git commit -m "feat(pick): add listar_partidos_pendientes_convocatoria tool"
```

### Task 8.4: Add ConvocatoriaBlock component for chat

**Files:**

- Create: `src/components/pick/blocks/ConvocatoriaBlock.tsx`
- Modify: `src/components/pick/blocks/BlockRenderer.tsx`
- Modify: `functions/src/shared/pickContracts.ts`

- [ ] **Step 1: Read existing block patterns**

```bash
cat src/components/pick/blocks/SessionPreviewBlock.tsx
cat src/components/pick/blocks/BlockRenderer.tsx
```

- [ ] **Step 2: Add the contract**

In `functions/src/shared/pickContracts.ts`, append the new block kind:

```ts
export interface ConvocatoriaBlock {
  kind: 'convocatoria_block';
  sessionId: string;
  mensaje: string;
  encabezado: string;
  sessionRef: { tipo?: string; fecha?: string; rival?: string; lugar?: string };
}
```

Add it to the union of block types if there is one.

- [ ] **Step 3: Implement the React block**

Create `src/components/pick/blocks/ConvocatoriaBlock.tsx`:

```tsx
import React, { useState } from 'react';
import { Send, Copy } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useFirebase } from '../../../contexts/FirebaseContext';
import { saveCalendarSession } from '../../../services/calendarService';
import { savePlayoffConvocatoria } from '../../../services/playoffConvocatoriasService';

interface Props {
  block: {
    sessionId: string;
    mensaje: string;
    sessionRef: { tipo?: string; fecha?: string; rival?: string; lugar?: string };
  };
}

export default function ConvocatoriaBlock({ block }: Props) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const [text, setText] = useState(block.mensaje);
  const [submitting, setSubmitting] = useState(false);

  async function persist() {
    if (block.sessionId.startsWith('playoff-')) {
      const [, bracketId, bracketMatchId, gameIndex] = block.sessionId.split('-');
      await savePlayoffConvocatoria(
        {
          sessionId: block.sessionId,
          bracketId,
          bracketMatchId,
          gameIndex: Number(gameIndex),
          mensajeConvocatoria: text,
          convocatoriaSentAt: new Date(),
        },
        { uid: user!.uid, db, appId },
      );
    } else {
      await saveCalendarSession(
        { id: block.sessionId, mensajeConvocatoria: text, convocatoriaSentAt: new Date() },
        { uid: user!.uid, db, appId },
      );
    }
  }

  async function handleCopy() {
    setSubmitting(true);
    try {
      await navigator.clipboard.writeText(text);
      await persist();
    } finally {
      setSubmitting(false);
    }
  }
  async function handleShare() {
    setSubmitting(true);
    try {
      const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ text });
        } catch {
          window.location.href = url;
        }
      } else {
        window.location.href = url;
      }
      await persist();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 my-2">
      <p className="text-xs font-bold text-slate-500 uppercase mb-2">
        Convocatoria · vs {block.sessionRef.rival || 'Rival'}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-sans"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleCopy}
          disabled={submitting}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Copy size={14} aria-hidden="true" /> Copiar
        </button>
        <button
          onClick={handleShare}
          disabled={submitting}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Send size={14} aria-hidden="true" /> WhatsApp
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Register in BlockRenderer**

In `src/components/pick/blocks/BlockRenderer.tsx`, add a case for `kind === 'convocatoria_block'`:

```tsx
import ConvocatoriaBlock from './ConvocatoriaBlock';

// inside the switch:
case 'convocatoria_block':
  return <ConvocatoriaBlock block={block} />;
```

- [ ] **Step 5: Commit**

```bash
git add src/components/pick/blocks/ConvocatoriaBlock.tsx src/components/pick/blocks/BlockRenderer.tsx functions/src/shared/pickContracts.ts
git commit -m "feat(pick): add ConvocatoriaBlock chat component and contract"
```

### Task 8.5: Update Pick system prompt

**Files:**

- Modify: `functions/src/ai/promptManager.ts`

- [ ] **Step 1: Read current prompt structure**

```bash
head -200 functions/src/ai/promptManager.ts
```

- [ ] **Step 2: Add a section about convocatorias**

Find the section that lists tools/capabilities. Add (in Spanish, matching the existing tone):

```
## Convocatorias de partido

Cuando el usuario pida una convocatoria, mensaje del partido, "avisar al grupo", "cita del sábado" o similar:

1. Si el sessionId no es claro, primero invoca `listar_partidos_pendientes_convocatoria` (filtrando por teamId si está en contexto de pantalla) y pregunta cuál si hay más de uno.
2. Invoca `mandar_convocatoria` con el sessionId concreto. Pasa `notaExtra` solo si el usuario lo dice ("avísales que lleven dos equipaciones").
3. Devuelve el resultado dentro del bloque `convocatoria_block` (no en texto markdown). NO inventes datos del partido — usa solo lo que devuelve la tool.
4. La tool no envía nada: deja que el entrenador pulse Copiar o Compartir desde el bloque.
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/ai/promptManager.ts
git commit -m "feat(pick): add system prompt section for convocatorias workflow"
```

---

## Phase 9 — Help article + final wiring

### Task 9.1: Add help article

**Files:**

- Modify: `src/content/helpArticles.ts`

- [ ] **Step 1: Read structure**

```bash
head -80 src/content/helpArticles.ts
```

- [ ] **Step 2: Append article**

Append a new entry to the articles array:

```ts
{
  slug: 'convocatorias-de-partido',
  title: 'Convocatorias de partido',
  category: 'Calendario',
  body: `
Cómo funciona la convocatoria del partido en Pick&Coach: generación, plantilla, recordatorios y envío por WhatsApp.

## Generar la convocatoria

Desde el detalle de un partido (toca el partido en el calendario) pulsa **Mandar convocatoria**. También puedes pulsar el icono de avión en la celda del partido del calendario, o pedírselo a Pick: *"haz la convocatoria del sábado"*.

Se abre un sub-modal con el mensaje renderizado a partir de los datos del partido y la plantilla del equipo. Antes de copiar puedes:

- Editar el texto directamente.
- Añadir una **nota extra** (ej. "llevar ambas equipaciones") que se inyecta en la plantilla.
- Cambiar la **hora de cita** solo para este partido.

## Plantilla del equipo

En **Equipo → Convocatorias** está la plantilla del equipo. Tiene variables disponibles que insertas con un click:

- \`{saludo}\` — "Buenos días", "Buenas tardes", "Buenas noches" según la hora.
- \`{ENCABEZADO}\` — bloque autogenerado con la fase, vuelta y jornada (o "Playoffs 1/8" o "Amistoso").
- \`{rival}\`, \`{horaInicio}\`, \`{horaCita}\`, \`{lugar}\`, \`{lugarUrlSiVisitante}\`, \`{citaSiVisitante}\`, \`{notaExtra}\`, \`{fechaRelativa}\`, \`{fechaRelativaNosVemos}\`.

Si una variable no tiene valor, su línea se elide automáticamente. Para partidos en casa la URL de Maps no aparece (el equipo conoce el sitio).

## Encabezado automático

- **Liga**: \`*Liga — Fase 1 (1ª/2ª vuelta)* / Jornada N vs Rival\`. La 1ª/2ª vuelta se infiere si el número de jornadas es par (la primera mitad es 1ª, la segunda 2ª). Si es impar, se omite.
- **Playoffs**: \`*Playoffs {ronda}* / Jornada {gameIndex+1} vs Rival\`.
- **Amistoso**: \`*Amistoso* / vs Rival\`.

## Competiciones del equipo

Crea las ligas del equipo en **Equipo → Competiciones**. Cada competición tiene fases con su número de jornadas. Cuando creas un partido y lo marcas como "Liga", eliges competición + fase, y la jornada se asigna automáticamente por orden de fecha (puedes editarla manualmente — quedará fijada).

## Pabellones recurrentes

Guarda en el equipo los pabellones que más usas: cuando crees un partido como local, podrás elegirlos del desplegable en lugar de teclear nombre + URL.

## Recordatorios

Si te falta mandar la convocatoria de un partido próximo, aparece como **Pendiente** en el home. La ventana es configurable por equipo (default: 72h). A menos de 24h aparece marcada en rojo.

## Envío por WhatsApp

El sub-modal tiene dos botones:

- **Copiar** — copia el mensaje al portapapeles. Pégalo en el chat / grupo / lista de difusión que tú prefieras.
- **Compartir por WhatsApp** — abre el selector de WhatsApp con el texto pre-rellenado. Eliges chat/grupo/lista, pulsas enviar.

Pick&Coach no guarda contactos ni envía automáticamente: usa tu agenda de WhatsApp tal y como ya la tienes.

## Pick

Puedes pedírselo en lenguaje natural:
- *"¿qué convocatorias tengo pendientes esta semana?"* → Pick lista los partidos.
- *"haz la del sábado"* → Pick genera el mensaje y te lo deja listo en el chat con los botones de Copiar/Compartir.
- *"añade que lleven dos equipaciones"* → Pick lo regenera con la nota extra.
`,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/content/helpArticles.ts
git commit -m "docs(help): add convocatorias-de-partido article"
```

---

## Phase 10 — Final testing and polish

### Task 10.1: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all green. Investigate any regression and fix.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run prettier check**

```bash
npm run format:check
```

Run `npm run format` if needed.

### Task 10.2: Manual end-to-end smoke test

- [ ] **Step 1: Setup**

```bash
npm run dev
```

- [ ] **Step 2: Walkthrough**

Test the full flow:

1. Create a competition for a team in **Equipo → Competiciones**.
2. Edit the convocatoria template in **Equipo → Convocatorias**, save.
3. Create a partido marked as Liga with that competition. Paste a Maps shortlink → name auto-fills.
4. Save. Open detail → "Mandar convocatoria" → verify rendered message.
5. Copy → confirm pendiente disappears from home.
6. Re-open detail → "✓ Convocatoria enviada — reenviar".
7. Add a player with `fechaNacimiento` of today → home shows cumpleaños pendiente.
8. Visit `/pendientes` → all items present, filters work.
9. In Pick chat: _"haz la convocatoria del sábado"_ → block appears.

If any step breaks, file a bug, fix, repeat.

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: address issues found in end-to-end smoke test"
```

### Task 10.3: Final commit

- [ ] **Step 1: Verify clean state**

```bash
git status
```

Expected: clean working tree.

---

## Self-review checklist (run after writing this plan)

The following spec sections must each have a corresponding task:

| Spec section                                      | Tasks                                             |
| ------------------------------------------------- | ------------------------------------------------- |
| Modelo de datos: subcolección competitions        | 1.3                                               |
| Modelo de datos: campos team                      | 5.1 (saved via ConvocatoriasTab)                  |
| Modelo de datos: campos session                   | 3.4, 3.5, 3.6, 3.7                                |
| Modelo de datos: doc lateral playoffConvocatorias | 1.5                                               |
| Reglas Firestore                                  | 1.1 (verification only — wildcard already covers) |
| Motor template                                    | 4.1, 4.2, 4.3, 8.1                                |
| Cloud Function resolveMapsUrl                     | 3.2                                               |
| TeamDetailScreen tabs                             | 2.3, 5.1                                          |
| SessionFormModal upgrade                          | 3.4–3.7                                           |
| SessionDetailModal botón                          | 6.2                                               |
| Calendario mini-icono                             | 6.3                                               |
| ConvocatoriaModal                                 | 6.1                                               |
| Pendientes lógica                                 | 7.1                                               |
| PendingActionsList types                          | 7.3                                               |
| /pendientes ruta                                  | 7.5                                               |
| Pick tools                                        | 8.2, 8.3                                          |
| ConvocatoriaBlock                                 | 8.4                                               |
| Pick prompt                                       | 8.5                                               |
| Help article                                      | 9.1                                               |
| Migración / lectura tolerante                     | 1.6, 1.7                                          |
| Constantes (DURACION_PARTIDO)                     | 1.2                                               |
| Auto-numeración jornadas                          | 3.1, 3.6                                          |

All sections covered. No placeholders. Type names consistent (`session.jugadoresConvocados`, `team.plantillaConvocatoria`, etc., used identically across tasks).

---

**End of plan.**
