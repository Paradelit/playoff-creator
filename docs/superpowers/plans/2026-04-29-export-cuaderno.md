# Export del Cuaderno (Informe + Asistencia) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir descarga de Informe de Jugadores (PDF + Word) y Asistencia (Excel) desde el cuaderno, replicando el formato de los referentes del club. Fix incluido para persistencia del campo "Observaciones" del informe.

**Architecture:** Generación programática client-side, lazy-loaded para no inflar el bundle inicial. Función pura `buildInformeData()` produce un objeto neutro reutilizado por exporters de PDF y Word. Componente `<ExportMenu />` reutilizable reemplaza el botón "Imprimir A4" actual.

**Tech Stack:** React 19, Vite, Firebase, Tailwind, Vitest. Libs nuevas: `jspdf` + `jspdf-autotable` (PDF), `docx` (Word), `exceljs` (Excel con estilos).

**Spec:** [docs/superpowers/specs/2026-04-29-export-cuaderno-design.md](../specs/2026-04-29-export-cuaderno-design.md)

---

## File Map

**Files to create**:

- `src/services/exporters/exportUtils.js` — slugify, formatFilename, fetchLogoAsDataUrl, EXPORT_MONTHS, monthKeyForExport, sessionLabelForDate
- `src/services/exporters/exportUtils.test.js`
- `src/services/exporters/informeExporter.js` — buildInformeData, exportInformeToPdf, exportInformeToWord
- `src/services/exporters/informeExporter.test.js`
- `src/services/exporters/asistenciaExporter.js` — groupSessionsByMonth, computeMonthTotals, computeYearTotals, exportAsistenciaToExcel
- `src/services/exporters/asistenciaExporter.test.js`
- `src/components/cuaderno/ExportMenu.jsx`
- `src/components/cuaderno/ExportMenu.test.jsx`

**Files to modify**:

- `package.json` — añadir dependencias
- `src/services/teamsService.js` — extender `subscribeToInformeJugadores` y `saveInformeJugadores` para soportar `{ rows, observaciones }`
- `src/services/teamsService.test.js` — añadir tests de las funciones nuevas
- `src/screens/cuaderno/InformeJugadoresScreen.jsx` — wire observaciones state/save, sustituir botón Imprimir por `<ExportMenu />`
- `src/screens/cuaderno/AsistenciaScreen.jsx` — sustituir botón Imprimir por `<ExportMenu />`

---

## Task 1: Instalar dependencias

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Instalar libs**

Run:

```bash
npm install jspdf jspdf-autotable docx exceljs
```

- [ ] **Step 2: Verificar `package.json`**

Comprobar que las 4 dependencias aparecen en la sección `"dependencies"`. Versiones esperadas (rangos, no exactos): `jspdf` ^3, `jspdf-autotable` ^5, `docx` ^9, `exceljs` ^4.

- [ ] **Step 3: Verificar build sigue verde**

Run:

```bash
npm run build
```

Expected: build succeeds, no errors. Bundle inicial puede crecer marginalmente (los `await import(...)` aún no existen, así que vite las trataría como deps; en próximas tareas se aislarán).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add jspdf, docx, exceljs for cuaderno exports"
```

---

## Task 2: Extender teamsService para Observaciones del informe

**Files:**

- Modify: `src/services/teamsService.js:98-106`
- Modify: `src/services/teamsService.test.js`

Cambio: las funciones `subscribeToInformeJugadores` y `saveInformeJugadores` pasan de manejar un array plano de filas a manejar `{ rows, observaciones }`. Se mantiene compatibilidad con docs legacy (array plano) en la lectura.

- [ ] **Step 1: Test de lectura — formato nuevo `{ rows, observaciones }`**

Añadir al final de `src/services/teamsService.test.js`:

```js
import {
  // ...imports existentes...
  subscribeToInformeJugadores,
  saveInformeJugadores,
} from './teamsService';

describe('subscribeToInformeJugadores', () => {
  it('reads new shape { rows, observaciones }', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({
        exists: () => true,
        data: () => ({ rows: [{ id: 0, nombre: 'A' }], observaciones: 'comentario' }),
      });
      return vi.fn();
    });
    subscribeToInformeJugadores('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith({ rows: [{ id: 0, nombre: 'A' }], observaciones: 'comentario' });
  });

  it('normalizes legacy array shape to { rows, observaciones: "" }', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({
        exists: () => true,
        data: () => ({ rows: [{ id: 0, nombre: 'A' }] }),
      });
      return vi.fn();
    });
    subscribeToInformeJugadores('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith({ rows: [{ id: 0, nombre: 'A' }], observaciones: '' });
  });

  it('returns empty rows + observaciones when doc does not exist', () => {
    const cb = vi.fn();
    onSnapshot.mockImplementation((_ref, callback) => {
      callback({ exists: () => false });
      return vi.fn();
    });
    subscribeToInformeJugadores('t1', 'u1', {}, 'app1', cb);
    expect(cb).toHaveBeenCalledWith({ rows: [], observaciones: '' });
  });
});

describe('saveInformeJugadores', () => {
  it('writes { rows, observaciones, updatedAt }', async () => {
    await saveInformeJugadores('t1', { rows: [{ id: 0 }], observaciones: 'x' }, ctx);
    expect(setDoc).toHaveBeenCalledWith('mock-doc-ref', {
      rows: [{ id: 0 }],
      observaciones: 'x',
      updatedAt: 'SERVER_TS',
    });
  });
});
```

- [ ] **Step 2: Run tests — fail**

Run:

```bash
npx vitest run src/services/teamsService.test.js
```

Expected: las 4 nuevas pruebas fallan ("expected to be called with…").

- [ ] **Step 3: Implementar el cambio en `teamsService.js`**

Reemplazar las líneas 98-106 actuales (el bloque `subscribeToInformeJugadores` + `saveInformeJugadores`) por:

```js
export function subscribeToInformeJugadores(teamId, uid, db, appId, callback) {
  return onSnapshot(informeJugadoresDoc(teamId, uid, db, appId), (snap) => {
    if (!snap.exists()) {
      callback({ rows: [], observaciones: '' });
      return;
    }
    const data = snap.data();
    callback({
      rows: Array.isArray(data.rows) ? data.rows : [],
      observaciones: typeof data.observaciones === 'string' ? data.observaciones : '',
    });
  });
}

export async function saveInformeJugadores(teamId, payload, { uid, db, appId }) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const observaciones = typeof payload?.observaciones === 'string' ? payload.observaciones : '';
  await setDoc(informeJugadoresDoc(teamId, uid, db, appId), {
    rows,
    observaciones,
    updatedAt: serverTimestamp(),
  });
}
```

- [ ] **Step 4: Run tests — pass**

Run:

```bash
npx vitest run src/services/teamsService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/teamsService.js src/services/teamsService.test.js
git commit -m "feat(cuaderno): persist observaciones in informe-jugadores doc"
```

---

## Task 3: Wire Observaciones en InformeJugadoresScreen

**Files:**

- Modify: `src/screens/cuaderno/InformeJugadoresScreen.jsx`

Adapta el componente al nuevo shape `{ rows, observaciones }`. El bug actual es que la `<textarea>` final no tiene `value` ni `onChange`.

- [ ] **Step 1: Adaptar el subscribe + state**

En `InformeJugadoresScreen.jsx`, sustituir el bloque actual del `useEffect` que llama a `subscribeToInformeJugadores` (líneas ~147-165) y los hooks de state alrededor:

Añadir un nuevo state al lado de `rows`:

```jsx
const [observaciones, setObservaciones] = useState('');
```

Y reemplazar el `useEffect` por:

```jsx
useEffect(() => {
  if (!user || !db) return;
  return subscribeToInformeJugadores(teamId, user.uid, db, appId, ({ rows: loadedRows, observaciones: loadedObs }) => {
    if (isFirstLoad.current) {
      if (loadedRows.length > 0) {
        setRows(loadedRows);
      } else {
        const jugadores = membersRef.current;
        if (jugadores.length > 0) {
          setRows(jugadores.map((j, i) => emptyRow(i, j.nombre || '')));
        } else {
          setRows(Array.from({ length: 12 }, (_, i) => emptyRow(i)));
        }
      }
      setObservaciones(loadedObs || '');
      isFirstLoad.current = false;
    }
  });
}, [user, db, appId, teamId]);
```

- [ ] **Step 2: Adaptar `triggerSave`**

Reemplazar la implementación actual de `triggerSave` (líneas ~168-179) por una que reciba el payload completo:

```jsx
const triggerSave = useCallback(
  (newRows, newObservaciones) => {
    setSaveStatus('unsaved');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      await saveInformeJugadores(
        teamId,
        { rows: newRows, observaciones: newObservaciones },
        { uid: user.uid, db, appId },
      );
      setSaveStatus('saved');
    }, 1500);
  },
  [teamId, user, db, appId],
);
```

- [ ] **Step 3: Actualizar callers de `triggerSave`**

Cada lugar que llamaba `triggerSave(updated)` debe llamar `triggerSave(updated, observaciones)`. Lugares a tocar (todos en `InformeJugadoresScreen.jsx`):

- `updateRow` — `triggerSave(updated, observaciones);`
- `confirmReset` — añadir `setObservaciones('');` antes; luego `triggerSave(fresh, '');`
- `sortByRanking` — `triggerSave(sorted, observaciones);`
- `handleDrop` — `triggerSave(updated, observaciones);`
- `handleTouchEnd` — `triggerSave(updated, observaciones);`

Y crear nuevo helper:

```jsx
function updateObservaciones(value) {
  setObservaciones(value);
  triggerSave(rows, value);
}
```

- [ ] **Step 4: Wire la `<textarea>`**

Localizar el bloque `<div className="mt-8 border border-gray-300 p-3">` con la textarea de Observaciones (alrededor de la línea 441). Reemplazar la `<textarea>` por:

```jsx
<textarea
  value={observaciones}
  onChange={(e) => updateObservaciones(e.target.value)}
  className="w-full min-h-[80px] resize-y focus:outline-none bg-transparent font-sans text-sm print:min-h-[40px]"
  placeholder="Observaciones generales sobre el equipo..."
  aria-label="Observaciones generales sobre el equipo"
/>
```

- [ ] **Step 5: Verificar manualmente**

Run:

```bash
npm run dev
```

Navegar a `/teams/<teamId>/cuaderno/informe-jugadores`. Escribir algo en Observaciones. Esperar 2 segundos. Refrescar la página. Verificar que el texto persiste.

- [ ] **Step 6: Lint + tests**

Run:

```bash
npm run lint && npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/cuaderno/InformeJugadoresScreen.jsx
git commit -m "fix(cuaderno): persist observaciones textarea in informe jugadores"
```

---

## Task 4: Crear `exportUtils.js` con helpers compartidos

**Files:**

- Create: `src/services/exporters/exportUtils.js`
- Test: `src/services/exporters/exportUtils.test.js`

Helpers puros usados por los tres exporters: slugify, formatFilename, fetchLogoAsDataUrl, mes constants para Excel, sessionLabel.

- [ ] **Step 1: Test de `slugify`**

Crear `src/services/exporters/exportUtils.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { slugify, formatFilename, EXPORT_MONTHS, monthKeyForExport, sessionLabelForDate } from './exportUtils';

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('Benjamín 2º A')).toBe('benjamin-2o-a');
  });

  it('removes accents and special characters', () => {
    expect(slugify('Niñas Cadete A')).toBe('ninas-cadete-a');
  });

  it('collapses multiple spaces and trims', () => {
    expect(slugify('  Equipo  Test  ')).toBe('equipo-test');
  });

  it('falls back to "equipo" if input is empty', () => {
    expect(slugify('')).toBe('equipo');
    expect(slugify('   ')).toBe('equipo');
  });
});
```

- [ ] **Step 2: Implementar `slugify`**

Crear `src/services/exporters/exportUtils.js`:

```js
export function slugify(input) {
  if (typeof input !== 'string') return 'equipo';
  const normalized = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
  return normalized || 'equipo';
}
```

- [ ] **Step 3: Run tests — pass**

Run:

```bash
npx vitest run src/services/exporters/exportUtils.test.js
```

Expected: 4 PASS.

- [ ] **Step 4: Test de `formatFilename`**

Añadir a `exportUtils.test.js`:

```js
describe('formatFilename', () => {
  it('builds informe filename', () => {
    expect(formatFilename('informe', 'Benjamín 2º A', '2025-26', 'pdf')).toBe(
      'Informe-jugadores-benjamin-2o-a-2025-26.pdf',
    );
  });

  it('builds asistencia filename', () => {
    expect(formatFilename('asistencia', 'Cadete', '2025-26', 'xlsx')).toBe('Asistencia-cadete-2025-26.xlsx');
  });

  it('uses .docx extension', () => {
    expect(formatFilename('informe', 'X', '2025-26', 'docx')).toBe('Informe-jugadores-x-2025-26.docx');
  });
});
```

- [ ] **Step 5: Implementar `formatFilename`**

Añadir a `exportUtils.js`:

```js
export function formatFilename(type, teamName, temporada, ext) {
  const slug = slugify(teamName);
  const prefix = type === 'asistencia' ? 'Asistencia' : 'Informe-jugadores';
  return `${prefix}-${slug}-${temporada}.${ext}`;
}
```

- [ ] **Step 6: Test de `EXPORT_MONTHS` y `monthKeyForExport`**

Añadir a `exportUtils.test.js`:

```js
describe('EXPORT_MONTHS', () => {
  it('has 11 months from agosto to junio', () => {
    expect(EXPORT_MONTHS).toHaveLength(11);
    expect(EXPORT_MONTHS[0].key).toBe('agosto');
    expect(EXPORT_MONTHS[0].full).toBe('Agosto');
    expect(EXPORT_MONTHS[10].key).toBe('junio');
  });
});

describe('monthKeyForExport', () => {
  it('maps a date in agosto', () => {
    expect(monthKeyForExport('2025-08-15')).toBe('agosto');
  });

  it('maps a date in enero', () => {
    expect(monthKeyForExport('2026-01-15')).toBe('enero');
  });

  it('returns null for julio (out of season)', () => {
    expect(monthKeyForExport('2025-07-15')).toBe(null);
  });
});
```

- [ ] **Step 7: Implementar `EXPORT_MONTHS` + `monthKeyForExport`**

Añadir a `exportUtils.js`:

```js
export const EXPORT_MONTHS = [
  { key: 'agosto', label: 'Ago', full: 'Agosto', num: 7 },
  { key: 'septiembre', label: 'Sep', full: 'Septiembre', num: 8 },
  { key: 'octubre', label: 'Oct', full: 'Octubre', num: 9 },
  { key: 'noviembre', label: 'Nov', full: 'Noviembre', num: 10 },
  { key: 'diciembre', label: 'Dic', full: 'Diciembre', num: 11 },
  { key: 'enero', label: 'Ene', full: 'Enero', num: 0 },
  { key: 'febrero', label: 'Feb', full: 'Febrero', num: 1 },
  { key: 'marzo', label: 'Mar', full: 'Marzo', num: 2 },
  { key: 'abril', label: 'Abr', full: 'Abril', num: 3 },
  { key: 'mayo', label: 'May', full: 'Mayo', num: 4 },
  { key: 'junio', label: 'Jun', full: 'Junio', num: 5 },
];

export function monthKeyForExport(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getMonth();
  return EXPORT_MONTHS.find((mo) => mo.num === m)?.key || null;
}
```

- [ ] **Step 8: Test de `sessionLabelForDate`**

Añadir a `exportUtils.test.js`:

```js
describe('sessionLabelForDate', () => {
  it('formats a Wednesday as X-DD', () => {
    expect(sessionLabelForDate('2025-08-20')).toBe('X-20'); // 2025-08-20 is a Wednesday
  });

  it('formats a Sunday as D-DD', () => {
    expect(sessionLabelForDate('2025-08-24')).toBe('D-24'); // Sunday
  });
});
```

- [ ] **Step 9: Implementar `sessionLabelForDate`**

Añadir a `exportUtils.js`:

```js
const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export function sessionLabelForDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_LETTERS[d.getDay()]}-${d.getDate()}`;
}
```

- [ ] **Step 10: Test de `fetchLogoAsDataUrl`**

Añadir a `exportUtils.test.js`:

```js
import { fetchLogoAsDataUrl } from './exportUtils';

describe('fetchLogoAsDataUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for falsy input', async () => {
    expect(await fetchLogoAsDataUrl(null)).toBe(null);
    expect(await fetchLogoAsDataUrl('')).toBe(null);
    expect(await fetchLogoAsDataUrl(undefined)).toBe(null);
  });

  it('returns null when fetch fails', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('CORS')));
    expect(await fetchLogoAsDataUrl('https://example.com/logo.png')).toBe(null);
  });

  it('returns dataURL string when fetch succeeds', async () => {
    const fakeBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(fakeBlob) }));
    const result = await fetchLogoAsDataUrl('https://example.com/logo.png');
    expect(typeof result).toBe('string');
    expect(result.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('returns null when fetch responds non-ok', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    expect(await fetchLogoAsDataUrl('https://example.com/missing.png')).toBe(null);
  });
});
```

- [ ] **Step 11: Implementar `fetchLogoAsDataUrl`**

Añadir a `exportUtils.js`:

```js
export async function fetchLogoAsDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 12: Run all tests**

Run:

```bash
npx vitest run src/services/exporters/exportUtils.test.js
```

Expected: PASS (todos los tests).

- [ ] **Step 13: Commit**

```bash
git add src/services/exporters/exportUtils.js src/services/exporters/exportUtils.test.js
git commit -m "feat(exporters): add shared utils (slugify, filename, months, logo fetch)"
```

---

## Task 5: Crear componente `ExportMenu`

**Files:**

- Create: `src/components/cuaderno/ExportMenu.jsx`
- Test: `src/components/cuaderno/ExportMenu.test.jsx`

Dropdown reutilizable que reemplaza el botón "Imprimir A4" actual.

- [ ] **Step 1: Test del componente**

Crear `src/components/cuaderno/ExportMenu.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportMenu from './ExportMenu';

describe('ExportMenu', () => {
  it('renders the trigger button labelled "Exportar"', () => {
    render(<ExportMenu items={[{ key: 'pdf', label: 'PDF', onClick: vi.fn() }]} />);
    expect(screen.getByRole('button', { name: /exportar/i })).toBeInTheDocument();
  });

  it('opens the menu on click and shows items', () => {
    const onClick = vi.fn();
    render(<ExportMenu items={[{ key: 'pdf', label: 'PDF', onClick }]} />);
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
    expect(screen.getByRole('menuitem', { name: /pdf/i })).toBeInTheDocument();
  });

  it('calls onClick and closes the menu when an item is clicked', () => {
    const onClick = vi.fn();
    render(<ExportMenu items={[{ key: 'pdf', label: 'PDF', onClick }]} />);
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /pdf/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<ExportMenu items={[{ key: 'pdf', label: 'PDF', onClick: vi.fn() }]} />);
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }));
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('shows save status badge when status prop is provided', () => {
    render(<ExportMenu status="saving" items={[{ key: 'pdf', label: 'PDF', onClick: vi.fn() }]} />);
    expect(screen.getByText(/guardando/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — fail (componente no existe)**

Run:

```bash
npx vitest run src/components/cuaderno/ExportMenu.test.jsx
```

Expected: FAIL — "Cannot find module './ExportMenu'".

- [ ] **Step 3: Implementar el componente**

Crear `src/components/cuaderno/ExportMenu.jsx`:

```jsx
import React, { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

export default function ExportMenu({ items = [], status }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleSelect(item) {
    setOpen(false);
    if (typeof item.onClick === 'function') item.onClick();
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-3 print:hidden">
      {status && (
        <span className="text-xs font-semibold text-slate-400">
          {status === 'saving' && 'Guardando...'}
          {status === 'saved' && '✓ Guardado'}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={15} aria-hidden="true" /> Exportar
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-20"
        >
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {item.icon && <span aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — pass**

Run:

```bash
npx vitest run src/components/cuaderno/ExportMenu.test.jsx
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/cuaderno/ExportMenu.jsx src/components/cuaderno/ExportMenu.test.jsx
git commit -m "feat(cuaderno): add reusable ExportMenu dropdown component"
```

---

## Task 6: `informeExporter.js` — `buildInformeData` (función pura)

**Files:**

- Create: `src/services/exporters/informeExporter.js`
- Test: `src/services/exporters/informeExporter.test.js`

`buildInformeData` produce el objeto neutro que comparten PDF y Word. Lógica compleja: inferir título, normalizar columnas y rows, manejar logo opcional.

- [ ] **Step 1: Test de `buildInformeData`**

Crear `src/services/exporters/informeExporter.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';

vi.mock('./exportUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchLogoAsDataUrl: vi.fn(),
  };
});

vi.mock('../../utils/teamUtils', () => ({
  teamDisplayName: vi.fn((team) => team?.nombre || 'Equipo'),
}));

import { buildInformeData } from './informeExporter';
import { fetchLogoAsDataUrl } from './exportUtils';

describe('buildInformeData', () => {
  it('returns the canonical shape with all fields populated', async () => {
    fetchLogoAsDataUrl.mockResolvedValue('data:image/png;base64,XYZ');
    const team = { nombre: 'Benjamín 2º A' };
    const profile = { nombreClub: 'Mi Club', logoClub: 'http://x/logo.png' };
    const rows = [{ id: 0, ranking: '1', nombre: 'A', compromiso: 'b' }];

    const result = await buildInformeData({
      team,
      profile,
      rows,
      observaciones: 'observación',
      temporada: '2025-26',
    });

    expect(result.clubName).toBe('Mi Club');
    expect(result.teamName).toBe('Benjamín 2º A');
    expect(result.temporada).toBe('2025-26');
    expect(result.title).toBe('INFORME JUGADORES/AS 2025-26');
    expect(result.logoDataUrl).toBe('data:image/png;base64,XYZ');
    expect(result.columns).toHaveLength(8);
    expect(result.columns[0]).toEqual({ key: 'ranking', label: 'Ranking' });
    expect(result.columns[1]).toEqual({ key: 'nombre', label: 'Nombre' });
    expect(result.rows).toHaveLength(1);
    expect(result.observaciones).toBe('observación');
  });

  it('falls back to default club name when profile is empty', async () => {
    fetchLogoAsDataUrl.mockResolvedValue(null);
    const result = await buildInformeData({
      team: { nombre: 'X' },
      profile: {},
      rows: [],
      observaciones: '',
      temporada: '2025-26',
    });
    expect(result.clubName).toBe('Uros de Rivas');
    expect(result.logoDataUrl).toBe(null);
  });

  it('handles null team gracefully', async () => {
    fetchLogoAsDataUrl.mockResolvedValue(null);
    const result = await buildInformeData({
      team: null,
      profile: { nombreClub: 'Club' },
      rows: [],
      observaciones: '',
      temporada: '2025-26',
    });
    expect(result.teamName).toBe('Equipo');
  });

  it('coerces row values to empty strings', async () => {
    fetchLogoAsDataUrl.mockResolvedValue(null);
    const result = await buildInformeData({
      team: { nombre: 'X' },
      profile: {},
      rows: [{ id: 0, ranking: null, nombre: undefined, compromiso: 'ok' }],
      observaciones: '',
      temporada: '2025-26',
    });
    expect(result.rows[0].ranking).toBe('');
    expect(result.rows[0].nombre).toBe('');
    expect(result.rows[0].compromiso).toBe('ok');
  });
});
```

- [ ] **Step 2: Run tests — fail**

Run:

```bash
npx vitest run src/services/exporters/informeExporter.test.js
```

Expected: FAIL — "Cannot find module".

- [ ] **Step 3: Implementar `buildInformeData`**

Crear `src/services/exporters/informeExporter.js`:

```js
import { teamDisplayName } from '../../utils/teamUtils';
import { fetchLogoAsDataUrl } from './exportUtils';

const COLUMNS = [
  { key: 'ranking', label: 'Ranking' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'compromiso', label: 'Compromiso' },
  { key: 'actitud', label: 'Actitud' },
  { key: 'aptitudes', label: 'Aptitudes' },
  { key: 'capAprender', label: 'Cap. Aprender' },
  { key: 'calidad', label: 'Calidad' },
  { key: 'tiro', label: 'Tiro' },
];

function asString(v) {
  return v == null ? '' : String(v);
}

export async function buildInformeData({ team, profile, rows, observaciones, temporada }) {
  const clubName = profile?.nombreClub || 'Uros de Rivas';
  const teamName = team ? teamDisplayName(team) : 'Equipo';
  const logoDataUrl = await fetchLogoAsDataUrl(profile?.logoClub);
  const title = `INFORME JUGADORES/AS ${temporada}`;
  const normalizedRows = (rows || []).map((row) => ({
    ranking: asString(row.ranking),
    nombre: asString(row.nombre),
    compromiso: asString(row.compromiso),
    actitud: asString(row.actitud),
    aptitudes: asString(row.aptitudes),
    capAprender: asString(row.capAprender),
    calidad: asString(row.calidad),
    tiro: asString(row.tiro),
  }));

  return {
    clubName,
    teamName,
    temporada,
    logoDataUrl,
    title,
    columns: COLUMNS,
    rows: normalizedRows,
    observaciones: asString(observaciones),
  };
}
```

- [ ] **Step 4: Run tests — pass**

Run:

```bash
npx vitest run src/services/exporters/informeExporter.test.js
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/exporters/informeExporter.js src/services/exporters/informeExporter.test.js
git commit -m "feat(exporters): add buildInformeData pure function"
```

---

## Task 7: `informeExporter.js` — `exportInformeToPdf`

**Files:**

- Modify: `src/services/exporters/informeExporter.js`

Lazy-loaded `jspdf` + `jspdf-autotable`. No se testea con unit tests (involucra la lib real); se verifica manualmente.

- [ ] **Step 1: Implementar `exportInformeToPdf`**

Añadir al final de `src/services/exporters/informeExporter.js`:

```js
import { formatFilename } from './exportUtils';

export async function exportInformeToPdf(data) {
  const { default: jsPDF } = await import('jspdf');
  const autoTableMod = await import('jspdf-autotable');
  const autoTable = autoTableMod.default || autoTableMod.autoTable;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const drawHeader = () => {
    if (data.logoDataUrl) {
      try {
        doc.addImage(data.logoDataUrl, 'PNG', margin, 8, 22, 22);
      } catch {
        // ignore image errors silently
      }
    }
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(data.title, pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`Equipo - ${data.teamName}`, pageWidth / 2, 22, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Temporada ${data.temporada}`, pageWidth - margin, 12, { align: 'right' });
    doc.setTextColor(0);
  };

  drawHeader();

  autoTable(doc, {
    startY: 34,
    margin: { left: margin, right: margin },
    head: [data.columns.map((c) => c.label)],
    body: data.rows.map((r) => data.columns.map((c) => r[c.key])),
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [240, 240, 240], textColor: 50, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 32, fontStyle: 'bold' },
    },
    didDrawPage: () => {
      drawHeader();
    },
  });

  if (data.observaciones && data.observaciones.trim()) {
    const finalY = doc.lastAutoTable.finalY || 34;
    const startY = finalY + 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Observaciones –', margin, startY);
    doc.setFont(undefined, 'normal');
    const lines = doc.splitTextToSize(data.observaciones, pageWidth - margin * 2);
    doc.text(lines, margin, startY + 6);
  }

  doc.save(formatFilename('informe', data.teamName, data.temporada, 'pdf'));
}
```

- [ ] **Step 2: Lint check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Verificación manual**

(Esta verificación se hace después de wirearlo en la UI, en Task 9. Por ahora basta con que lint y build pasen.)

Run:

```bash
npm run build
```

Expected: build succeed; aviso ok si vite warning sobre dynamic imports.

- [ ] **Step 4: Commit**

```bash
git add src/services/exporters/informeExporter.js
git commit -m "feat(exporters): add exportInformeToPdf with jspdf"
```

---

## Task 8: `informeExporter.js` — `exportInformeToWord`

**Files:**

- Modify: `src/services/exporters/informeExporter.js`

Lazy-loaded `docx`. Mismo patrón: no unit test, verificación manual al wirear.

- [ ] **Step 1: Implementar `exportInformeToWord`**

Añadir al final de `informeExporter.js`:

```js
export async function exportInformeToWord(data) {
  const docx = await import('docx');
  const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    HeadingLevel,
    WidthType,
    AlignmentType,
    BorderStyle,
    PageOrientation,
    ImageRun,
  } = docx;

  const tableHeader = new TableRow({
    tableHeader: true,
    children: data.columns.map(
      (col) =>
        new TableCell({
          shading: { fill: 'F2F2F2' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: col.label, bold: true })],
            }),
          ],
        }),
    ),
  });

  const dataRows = data.rows.map(
    (row) =>
      new TableRow({
        children: data.columns.map(
          (col) =>
            new TableCell({
              children: (row[col.key] || '').split('\n').map(
                (line) =>
                  new Paragraph({
                    children: [new TextRun({ text: line, size: 16 })],
                  }),
              ),
            }),
        ),
      }),
  );

  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
  };

  const headerChildren = [];
  if (data.logoDataUrl) {
    try {
      const base64 = data.logoDataUrl.split(',')[1] || '';
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      headerChildren.push(
        new Paragraph({
          children: [new ImageRun({ data: binary, transformation: { width: 60, height: 60 } })],
        }),
      );
    } catch {
      // skip image
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { size: { orientation: PageOrientation.LANDSCAPE } },
        },
        children: [
          ...headerChildren,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: data.title, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Equipo - ${data.teamName}` })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `Temporada ${data.temporada}`, italics: true, size: 18, color: '777777' })],
          }),
          new Paragraph(''),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [tableHeader, ...dataRows],
          }),
          ...(data.observaciones && data.observaciones.trim()
            ? [
                new Paragraph(''),
                new Paragraph({
                  children: [new TextRun({ text: 'Observaciones –', bold: true })],
                }),
                ...data.observaciones
                  .split('\n')
                  .map((line) => new Paragraph({ children: [new TextRun({ text: line })] })),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, formatFilename('informe', data.teamName, data.temporada, 'docx'));
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
```

- [ ] **Step 2: Lint + build**

Run:

```bash
npm run lint && npm run build
```

Expected: PASS, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/services/exporters/informeExporter.js
git commit -m "feat(exporters): add exportInformeToWord with docx"
```

---

## Task 9: Wire `ExportMenu` en `InformeJugadoresScreen`

**Files:**

- Modify: `src/screens/cuaderno/InformeJugadoresScreen.jsx`

Reemplaza el botón "Imprimir A4" por `<ExportMenu>` con 3 opciones (Imprimir, PDF, Word). Añade los handlers.

- [ ] **Step 1: Imports**

Al inicio del archivo, en el bloque de imports:

- Añadir `FileText` y `FileType` al import de `lucide-react`.
- Añadir `import ExportMenu from '../../components/cuaderno/ExportMenu';`
- Añadir `import { useToast } from '../../contexts/ToastContext';`
- Añadir `import { buildInformeData, exportInformeToPdf, exportInformeToWord } from '../../services/exporters/informeExporter';`

- [ ] **Step 2: Hook de toast**

Dentro del componente `InformeJugadoresScreen`, añadir:

```jsx
const toast = useToast();
```

Justo después de `const { profile } = useProfile();`.

- [ ] **Step 3: Handlers**

Antes del `return (...)`, añadir:

```jsx
async function handleExportPdf() {
  try {
    const data = await buildInformeData({ team, profile, rows, observaciones, temporada });
    await exportInformeToPdf(data);
    toast?.('PDF descargado', 'success');
  } catch (err) {
    console.error(err);
    toast?.('No se pudo generar el PDF', 'error');
  }
}

async function handleExportWord() {
  try {
    const data = await buildInformeData({ team, profile, rows, observaciones, temporada });
    await exportInformeToWord(data);
    toast?.('Word descargado', 'success');
  } catch (err) {
    console.error(err);
    toast?.('No se pudo generar el Word', 'error');
  }
}
```

- [ ] **Step 4: Sustituir botón Imprimir**

En la toolbar (alrededor de la línea 304), localizar el bloque que contiene los botones "Limpiar" y "Imprimir A4":

```jsx
<div className="flex items-center gap-3">
  <span className="text-xs font-semibold text-slate-400">...</span>
  <button onClick={resetAll}>...</button>
  <button onClick={() => window.print()}>...Imprimir A4</button>
</div>
```

Reemplazar el `<span>` del status y el `<button>` de Imprimir A4 (manteniendo el de "Limpiar") por:

```jsx
<div className="flex items-center gap-3">
  <button
    onClick={resetAll}
    className="flex items-center px-3 py-1 bg-white border border-gray-400 text-gray-700 text-sm hover:bg-gray-50 transition shadow-sm rounded"
  >
    <RotateCcw className="w-4 h-4 mr-1" aria-hidden="true" /> Limpiar
  </button>
  <ExportMenu
    status={saveStatus}
    items={[
      {
        key: 'print',
        label: 'Imprimir A4',
        icon: <Printer size={15} aria-hidden="true" />,
        onClick: () => window.print(),
      },
      { key: 'pdf', label: 'Descargar PDF', icon: <FileText size={15} aria-hidden="true" />, onClick: handleExportPdf },
      {
        key: 'word',
        label: 'Descargar Word',
        icon: <FileType size={15} aria-hidden="true" />,
        onClick: handleExportWord,
      },
    ]}
  />
</div>
```

- [ ] **Step 5: Verificación manual — PDF**

Run:

```bash
npm run dev
```

Navegar al informe de un equipo, rellenar 2-3 filas y observaciones. Pulsar Exportar → Descargar PDF. Verificar:

- El archivo se descarga con nombre `Informe-jugadores-<slug>-<temp>.pdf`.
- Abrir el PDF: el texto es seleccionable, la tabla se ve bien, el logo del club aparece en la esquina superior izquierda (si el equipo tiene logo configurado), las observaciones aparecen debajo.

- [ ] **Step 6: Verificación manual — Word**

Pulsar Exportar → Descargar Word. Verificar:

- Archivo se descarga con extensión `.docx`.
- Abrir en Word/LibreOffice: tabla editable, columnas con fondo gris claro en header, texto correcto.

- [ ] **Step 7: Verificación manual — Imprimir**

Pulsar Exportar → Imprimir A4. Verificar que abre el diálogo de impresión del navegador y la vista previa es igual que antes.

- [ ] **Step 8: Lint + tests**

Run:

```bash
npm run lint && npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/screens/cuaderno/InformeJugadoresScreen.jsx
git commit -m "feat(cuaderno): replace print button with ExportMenu in informe jugadores"
```

---

## Task 10: `asistenciaExporter.js` — helpers puros (`groupSessionsByMonth`, `computeMonthTotals`, `computeYearTotals`)

**Files:**

- Create: `src/services/exporters/asistenciaExporter.js`
- Test: `src/services/exporters/asistenciaExporter.test.js`

Funciones puras que arman las estructuras de datos de las hojas, antes de pasar a exceljs.

- [ ] **Step 1: Test de `groupSessionsByMonth`**

Crear `src/services/exporters/asistenciaExporter.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { groupSessionsByMonth, computeMonthTotals, computeYearTotals } from './asistenciaExporter';

describe('groupSessionsByMonth', () => {
  it('groups calendar and manual sessions per month with correct labels', () => {
    const calSessions = [
      { id: 'c1', fecha: '2025-09-03' }, // X-3
      { id: 'c2', fecha: '2025-09-08' }, // L-8
      { id: 'c3', fecha: '2025-10-06' }, // L-6
    ];
    const manualSessions = {
      septiembre: [{ id: 'm1', label: 'X-1' }],
    };
    const result = groupSessionsByMonth(calSessions, manualSessions);
    expect(result.septiembre).toEqual([
      { id: 'c1', label: 'X-3', isCalendar: true },
      { id: 'c2', label: 'L-8', isCalendar: true },
      { id: 'm1', label: 'X-1', isCalendar: false },
    ]);
    expect(result.octubre).toEqual([{ id: 'c3', label: 'L-6', isCalendar: true }]);
    expect(result.agosto).toEqual([]);
  });

  it('sorts calendar sessions by date', () => {
    const calSessions = [
      { id: 'b', fecha: '2025-09-15' },
      { id: 'a', fecha: '2025-09-03' },
    ];
    const result = groupSessionsByMonth(calSessions, {});
    expect(result.septiembre.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('returns one entry per month in EXPORT_MONTHS, even when empty', () => {
    const result = groupSessionsByMonth([], {});
    const keys = Object.keys(result);
    expect(keys).toContain('agosto');
    expect(keys).toContain('junio');
    expect(keys).toHaveLength(11);
  });
});

describe('computeMonthTotals', () => {
  it('counts F+L+ as F, r+R as R, - as -', () => {
    const member = { id: 'm1', nombre: 'X' };
    const sessions = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }];
    const attendance = {
      s1: { m1: 'F' },
      s2: { m1: 'L+' },
      s3: { m1: 'r' },
      s4: { m1: '-' },
    };
    expect(computeMonthTotals(member, sessions, attendance)).toEqual({ f: 2, r: 1, minus: 1 });
  });

  it('returns zeros when no sessions match', () => {
    expect(computeMonthTotals({ id: 'm1' }, [], {})).toEqual({ f: 0, r: 0, minus: 0 });
  });
});

describe('computeYearTotals', () => {
  it('sums monthly F totals (excluding agosto, per reference)', () => {
    const member = { id: 'm1', nombre: 'X' };
    const sessionsByMonth = {
      agosto: [{ id: 'a1' }],
      septiembre: [{ id: 's1' }],
      octubre: [{ id: 'o1' }, { id: 'o2' }],
    };
    const attendance = {
      a1: { m1: 'F' }, // agosto NO se cuenta en el yearly
      s1: { m1: 'F' },
      o1: { m1: 'L+' },
      o2: { m1: 'r' },
    };
    const result = computeYearTotals(member, sessionsByMonth, attendance);
    expect(result.byMonth.agosto).toBe(0); // excluded
    expect(result.byMonth.septiembre).toBe(1);
    expect(result.byMonth.octubre).toBe(1);
    expect(result.year).toEqual({ f: 2, r: 1, minus: 0 });
  });
});
```

- [ ] **Step 2: Run tests — fail**

Run:

```bash
npx vitest run src/services/exporters/asistenciaExporter.test.js
```

Expected: FAIL — "Cannot find module".

- [ ] **Step 3: Implementar los helpers puros**

Crear `src/services/exporters/asistenciaExporter.js`:

```js
import { EXPORT_MONTHS, monthKeyForExport, sessionLabelForDate } from './exportUtils';

const RESUMEN_MONTHS = EXPORT_MONTHS.filter((m) => m.key !== 'agosto');

export function groupSessionsByMonth(calSessions, manualSessions) {
  const result = {};
  for (const m of EXPORT_MONTHS) result[m.key] = [];

  const sortedCal = [...(calSessions || [])].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  for (const s of sortedCal) {
    const key = monthKeyForExport(s.fecha);
    if (!key) continue;
    result[key].push({ id: s.id, label: sessionLabelForDate(s.fecha), isCalendar: true });
  }

  for (const key of Object.keys(manualSessions || {})) {
    if (!result[key]) continue;
    for (const ms of manualSessions[key]) {
      result[key].push({ id: ms.id, label: ms.label || '', isCalendar: false });
    }
  }
  return result;
}

export function computeMonthTotals(member, sessions, attendance) {
  let f = 0;
  let r = 0;
  let minus = 0;
  for (const sess of sessions) {
    const code = attendance?.[sess.id]?.[member.id] || '';
    if (code === 'F' || code === 'L+') f++;
    else if (code === 'r' || code === 'R') r++;
    else if (code === '-') minus++;
  }
  return { f, r, minus };
}

export function computeYearTotals(member, sessionsByMonth, attendance) {
  const byMonth = {};
  let totalF = 0;
  let totalR = 0;
  let totalMinus = 0;
  for (const m of EXPORT_MONTHS) {
    const totals = computeMonthTotals(member, sessionsByMonth[m.key] || [], attendance);
    byMonth[m.key] = totals.f;
    if (m.key === 'agosto') continue; // referencia: agosto no entra en el resumen anual
    totalF += totals.f;
    totalR += totals.r;
    totalMinus += totals.minus;
  }
  return { byMonth, year: { f: totalF, r: totalR, minus: totalMinus } };
}

export { RESUMEN_MONTHS };
```

- [ ] **Step 4: Run tests — pass**

Run:

```bash
npx vitest run src/services/exporters/asistenciaExporter.test.js
```

Expected: 6 PASS (3 for groupSessionsByMonth, 2 for computeMonthTotals, 1 for computeYearTotals).

- [ ] **Step 5: Commit**

```bash
git add src/services/exporters/asistenciaExporter.js src/services/exporters/asistenciaExporter.test.js
git commit -m "feat(exporters): add pure helpers for asistencia month grouping and totals"
```

---

## Task 11: `asistenciaExporter.js` — `exportAsistenciaToExcel`

**Files:**

- Modify: `src/services/exporters/asistenciaExporter.js`

Construye el workbook de 13 hojas con `exceljs`. No unit-testeado: verificación manual.

- [ ] **Step 1: Helpers para construir filas estándar de jugadores**

Antes de exportar, añadimos un helper interno que produce 16 nombres "padded" igual que la referencia (los reales primero, luego "Jugador/a 13", etc.).

Añadir al final de `asistenciaExporter.js` (antes del `export function exportAsistenciaToExcel`):

```js
const MAX_PLAYERS = 16;
const MAX_SESSIONS = 16;

function paddedMembers(members) {
  const out = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const real = members[i];
    out.push({
      id: real?.id || `_pad_${i}`,
      nombre: real?.nombre || `Jugador/a ${i + 1}`,
      isReal: !!real,
    });
  }
  return out;
}

const COLOR_FILLS = {
  F: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } },
  r: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } },
  R: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } },
  '-': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } },
  'L+': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF60A5FA' } },
};

const COLOR_TEXT = {
  F: { argb: 'FFFFFFFF' },
  '-': { argb: 'FFFFFFFF' },
  'L+': { argb: 'FFFFFFFF' },
};
```

- [ ] **Step 2: Implementar `exportAsistenciaToExcel`**

Añadir al final de `asistenciaExporter.js`:

```js
import { formatFilename, fetchLogoAsDataUrl } from './exportUtils';

export async function exportAsistenciaToExcel({
  team,
  profile,
  members,
  attendance,
  calSessions,
  manualSessions,
  temporada,
}) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const teamName = team?.nombre || 'Equipo';
  const padded = paddedMembers(members || []);
  const sessionsByMonth = groupSessionsByMonth(calSessions || [], manualSessions || {});
  const logoDataUrl = await fetchLogoAsDataUrl(profile?.logoClub);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Playoff Creator';
  wb.created = new Date();

  let logoId = null;
  if (logoDataUrl) {
    try {
      logoId = wb.addImage({ base64: logoDataUrl, extension: 'png' });
    } catch {
      logoId = null;
    }
  }

  buildInstruccionesSheet(wb, padded, teamName, logoId);

  for (const m of EXPORT_MONTHS) {
    buildMonthSheet(wb, m, padded, sessionsByMonth[m.key], attendance, teamName, logoId);
  }

  buildResumenSheet(wb, padded, sessionsByMonth, attendance, teamName, temporada, logoId);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownloadBlob(blob, formatFilename('asistencia', teamName, temporada, 'xlsx'));
}

function triggerDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function buildInstruccionesSheet(wb, padded, teamName, logoId) {
  const ws = wb.addWorksheet('Instrucciones');
  ws.columns = [{ width: 4 }, { width: 26 }, { width: 4 }, { width: 4 }, { width: 60 }];
  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 80, height: 80 } });
  }
  ws.getCell('C2').value = 'Instrucciones';
  ws.getCell('C2').font = { size: 14, bold: true };
  ws.getCell('B3').value = 'Nombre del equipo';
  ws.getCell('E3').value = teamName;
  ws.getCell('E3').font = { bold: true };

  for (let i = 0; i < MAX_PLAYERS; i++) {
    ws.getCell(`A${5 + i}`).value = i + 1;
    ws.getCell(`B${5 + i}`).value = padded[i].nombre;
  }

  const notes = [
    'Nomenclatura para cumplimentar las hojas:',
    'F  = Ha faltado (rojo)',
    'r  = Un poco tarde, ≤10 min (amarillo)',
    'R  = Muy tarde, >10 min (amarillo)',
    '-  = Mala actitud (negro)',
    'L  = Lesionado y no viene',
    'L+ = Lesionado pero viene (azul)',
    '',
    'En las celdas "Totales" de la derecha se irán sumando automáticamente las F, las R y los -.',
    'En las celdas "Totales" de abajo, se sumarán las faltas en el día del equipo.',
    'En la última hoja "Resumen" se acumulan las faltas mensuales por jugador.',
  ];
  notes.forEach((text, i) => {
    ws.getCell(`E${5 + i}`).value = text;
  });
}

function buildMonthSheet(wb, month, padded, sessions, attendance, teamName, logoId) {
  const ws = wb.addWorksheet(month.full);
  ws.columns = [
    { width: 4 },
    { width: 30 },
    ...Array.from({ length: MAX_SESSIONS }, () => ({ width: 6 })),
    { width: 2 },
    { width: 6 },
    { width: 6 },
    { width: 6 },
  ];
  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });
  }

  ws.getCell('C2').value = month.full;
  ws.getCell('C2').font = { size: 14, bold: true };
  ws.getCell('E3').value = teamName;
  ws.getCell('E3').font = { bold: true };
  ws.mergeCells('E3:P3');
  ws.getCell('T4').value = 'Totales';
  ws.getCell('T4').alignment = { horizontal: 'center' };
  ws.getCell('T4').font = { bold: true };
  ws.mergeCells('T4:V4');

  // Header row 5
  const limited = (sessions || []).slice(0, MAX_SESSIONS);
  for (let i = 0; i < limited.length; i++) {
    const cell = ws.getCell(5, 3 + i); // col C = 3
    cell.value = limited[i].label || '';
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    cell.border = {
      bottom: { style: 'thin' },
      top: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  }
  ws.getCell('T5').value = 'F';
  ws.getCell('U5').value = 'R';
  ws.getCell('V5').value = '-';
  ['T5', 'U5', 'V5'].forEach((addr) => {
    const c = ws.getCell(addr);
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    c.border = { bottom: { style: 'thin' }, top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  // Player rows 6-21
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const rowIdx = 6 + i;
    ws.getCell(rowIdx, 1).value = i + 1;
    ws.getCell(rowIdx, 1).alignment = { horizontal: 'center' };
    ws.getCell(rowIdx, 2).value = padded[i].nombre;
    ws.getCell(rowIdx, 2).font = { bold: padded[i].isReal };

    for (let s = 0; s < limited.length; s++) {
      const code = padded[i].isReal ? attendance?.[limited[s].id]?.[padded[i].id] || '' : '';
      const cell = ws.getCell(rowIdx, 3 + s);
      cell.value = code;
      cell.alignment = { horizontal: 'center' };
      cell.font = { bold: !!code, color: COLOR_TEXT[code] };
      if (COLOR_FILLS[code]) cell.fill = COLOR_FILLS[code];
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    }

    // Totals (formula + cached result)
    const totals = computeMonthTotals(padded[i], limited, attendance);
    const rangeStart = `C${rowIdx}`;
    const rangeEnd = `${columnLetter(2 + MAX_SESSIONS)}${rowIdx}`; // R{rowIdx}
    ws.getCell(rowIdx, 20).value = {
      formula: `COUNTIF(${rangeStart}:${rangeEnd},"F")+COUNTIF(${rangeStart}:${rangeEnd},"L+")`,
      result: totals.f,
    };
    ws.getCell(rowIdx, 21).value = {
      formula: `COUNTIF(${rangeStart}:${rangeEnd},"r")+COUNTIF(${rangeStart}:${rangeEnd},"R")`,
      result: totals.r,
    };
    ws.getCell(rowIdx, 22).value = {
      formula: `COUNTIF(${rangeStart}:${rangeEnd},"-")`,
      result: totals.minus,
    };
    ['T', 'U', 'V'].forEach((col) => {
      const c = ws.getCell(`${col}${rowIdx}`);
      c.alignment = { horizontal: 'center' };
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      c.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }

  // Totals row 22
  ws.getCell('B22').value = 'Totales';
  ws.getCell('B22').font = { bold: true };
  for (let s = 0; s < limited.length; s++) {
    const colIdx = 3 + s;
    const colLetter = columnLetter(colIdx);
    ws.getCell(22, colIdx).value = {
      formula: `COUNTIF(${colLetter}6:${colLetter}21,"F")`,
      result: limited[s] ? sumFForDay(padded, limited[s].id, attendance) : 0,
    };
    ws.getCell(22, colIdx).alignment = { horizontal: 'center' };
    ws.getCell(22, colIdx).font = { bold: true };
  }
}

function sumFForDay(padded, sessionId, attendance) {
  let total = 0;
  for (const m of padded) {
    if (!m.isReal) continue;
    if (attendance?.[sessionId]?.[m.id] === 'F') total++;
  }
  return total;
}

function columnLetter(idx) {
  // 1 → A, 2 → B, ...
  let s = '';
  let n = idx;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildResumenSheet(wb, padded, sessionsByMonth, attendance, teamName, temporada, logoId) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [
    { width: 4 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    ...Array.from({ length: 10 }, () => ({ width: 6 })),
    { width: 6 },
    { width: 6 },
    { width: 6 },
  ];
  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });
  }

  ws.getCell('A2').value = `Resumen Asistencia ${temporada}`;
  ws.getCell('A2').font = { size: 14, bold: true };
  ws.mergeCells('A2:R2');
  ws.getCell('F3').value = teamName;
  ws.getCell('F3').font = { bold: true };
  ws.mergeCells('F3:N3');
  ws.getCell('P4').value = 'Totales';
  ws.getCell('P4').alignment = { horizontal: 'center' };
  ws.getCell('P4').font = { bold: true };
  ws.mergeCells('P4:R4');

  // Header row 5
  RESUMEN_MONTHS.forEach((m, i) => {
    const cell = ws.getCell(5, 6 + i); // col F=6
    cell.value = m.label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  });
  ws.getCell('P5').value = 'F';
  ws.getCell('Q5').value = 'R';
  ws.getCell('R5').value = '-';
  ['P5', 'Q5', 'R5'].forEach((a) => {
    const c = ws.getCell(a);
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  });

  // Player rows 6-21
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const rowIdx = 6 + i;
    ws.getCell(rowIdx, 1).value = i + 1;
    ws.getCell(rowIdx, 1).alignment = { horizontal: 'center' };
    ws.getCell(rowIdx, 2).value = padded[i].nombre;
    ws.getCell(rowIdx, 2).font = { bold: padded[i].isReal };
    ws.mergeCells(`B${rowIdx}:E${rowIdx}`);

    const totals = computeYearTotals(padded[i], sessionsByMonth, attendance);
    RESUMEN_MONTHS.forEach((m, j) => {
      const cell = ws.getCell(rowIdx, 6 + j);
      cell.value = totals.byMonth[m.key];
      cell.alignment = { horizontal: 'center' };
    });
    ws.getCell(rowIdx, 16).value = totals.year.f;
    ws.getCell(rowIdx, 17).value = totals.year.r;
    ws.getCell(rowIdx, 18).value = totals.year.minus;
    ['P', 'Q', 'R'].forEach((col) => {
      const c = ws.getCell(`${col}${rowIdx}`);
      c.alignment = { horizontal: 'center' };
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    });
  }

  // Totals equipo row 22
  ws.getCell('B22').value = 'Totales equipo';
  ws.getCell('B22').font = { bold: true };
  ws.mergeCells('B22:E22');
  RESUMEN_MONTHS.forEach((m, j) => {
    let total = 0;
    for (const member of padded) {
      if (!member.isReal) continue;
      const monthSessions = sessionsByMonth[m.key] || [];
      total += computeMonthTotals(member, monthSessions, attendance).f;
    }
    ws.getCell(22, 6 + j).value = total;
    ws.getCell(22, 6 + j).alignment = { horizontal: 'center' };
    ws.getCell(22, 6 + j).font = { bold: true };
  });
}
```

- [ ] **Step 3: Lint + build**

Run:

```bash
npm run lint && npm run build
```

Expected: PASS, build succeeds.

- [ ] **Step 4: Tests siguen pasando**

Run:

```bash
npx vitest run src/services/exporters/
```

Expected: PASS (los tests de helpers puros siguen funcionando — no se han tocado).

- [ ] **Step 5: Commit**

```bash
git add src/services/exporters/asistenciaExporter.js
git commit -m "feat(exporters): add exportAsistenciaToExcel with exceljs (13 sheets)"
```

---

## Task 12: Wire `ExportMenu` en `AsistenciaScreen`

**Files:**

- Modify: `src/screens/cuaderno/AsistenciaScreen.jsx`

Reemplaza el botón "Imprimir A4" por `<ExportMenu>` con 2 opciones (Imprimir, Excel).

- [ ] **Step 1: Imports**

Al inicio del archivo:

- Añadir `FileSpreadsheet` al import de `lucide-react`.
- `import ExportMenu from '../../components/cuaderno/ExportMenu';`
- `import { useToast } from '../../contexts/ToastContext';`
- `import { exportAsistenciaToExcel } from '../../services/exporters/asistenciaExporter';`

- [ ] **Step 2: Hook + handler**

Dentro del componente, justo después del destructuring de `useAttendance`, añadir:

```jsx
const toast = useToast();

async function handleExportExcel() {
  try {
    await exportAsistenciaToExcel({
      team,
      profile,
      members,
      attendance,
      calSessions,
      manualSessions,
      temporada,
    });
    toast?.('Excel descargado', 'success');
  } catch (err) {
    console.error(err);
    toast?.('No se pudo generar el Excel', 'error');
  }
}
```

- [ ] **Step 3: Sustituir botón Imprimir**

En la toolbar (alrededor de la línea 259-277), localizar el bloque `<div className="flex items-center gap-3">` que contiene el span de status, "Limpiar" y "Imprimir A4". Sustituirlo por:

```jsx
<div className="flex items-center gap-3">
  <button
    onClick={() => setShowResetConfirm(true)}
    className="flex items-center px-3 py-1 bg-white border border-gray-400 text-gray-700 text-sm hover:bg-gray-50 transition shadow-sm rounded"
  >
    <RotateCcw className="w-4 h-4 mr-1" aria-hidden="true" /> Limpiar
  </button>
  <ExportMenu
    status={saveStatus}
    items={[
      {
        key: 'print',
        label: 'Imprimir A4',
        icon: <Printer size={15} aria-hidden="true" />,
        onClick: () => window.print(),
      },
      {
        key: 'excel',
        label: 'Descargar Excel',
        icon: <FileSpreadsheet size={15} aria-hidden="true" />,
        onClick: handleExportExcel,
      },
    ]}
  />
</div>
```

- [ ] **Step 4: Verificación manual**

Run:

```bash
npm run dev
```

- Navegar a la asistencia de un equipo con sesiones en al menos 1 mes.
- Pulsar Exportar → Descargar Excel.
- Abrir el archivo (Excel o LibreOffice). Verificar:
  - 13 hojas: Instrucciones + Agosto..Junio + Resumen.
  - Una de las hojas mensuales tiene los nombres de jugadores, etiquetas de sesión, y celdas coloreadas para F (rojo), r (amarillo), - (negro), L+ (azul) si las hay.
  - Hoja Resumen tiene la tabla con totales por mes y F/R/- anuales.
  - Editar una celda con "F" en una hoja mensual: el total a la derecha debería actualizarse (formula COUNTIF).
- Pulsar Exportar → Imprimir A4: debería abrir el diálogo de impresión normal.

- [ ] **Step 5: Lint + tests**

Run:

```bash
npm run lint && npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/cuaderno/AsistenciaScreen.jsx
git commit -m "feat(cuaderno): replace print button with ExportMenu in asistencia"
```

---

## Task 13: Verificación final + ajustes de bundle

**Files:**

- Modify: posible ajuste menor en `vite.config.*` si build avisa.

- [ ] **Step 1: Build de producción**

Run:

```bash
npm run build
```

Expected: build succeeds. En la salida deberías ver chunks separados para `jspdf*`, `docx`, `exceljs` (lazy-loaded). Si Vite avisa por chunks > 500 KB en `exceljs`/`docx`, está esperado y se puede ignorar (las libs solo se cargan al pulsar exportar).

- [ ] **Step 2: Tamaño del bundle inicial**

Inspeccionar `dist/assets/`. Verificar que `index-*.js` (entry inicial) **no** importa exceljs/docx/jspdf. Estas libs deben aparecer en chunks separados con prefijos como `informeExporter-*.js`.

Run:

```bash
ls dist/assets | grep -E "(exceljs|docx|jspdf|informeExporter|asistenciaExporter)"
```

Expected: archivos lazy-chunks visibles.

- [ ] **Step 3: Suite completa**

Run:

```bash
npm run lint && npm test && npm run build
```

Expected: todo PASS.

- [ ] **Step 4: Smoke test cruzado**

`npm run dev` y verificar en navegador:

- [ ] Informe: PDF descarga ok, Word descarga ok, Imprimir abre diálogo.
- [ ] Asistencia: Excel descarga ok, Imprimir abre diálogo.
- [ ] El equipo sin logo configurado exporta también (sin imagen, sin error).
- [ ] Refresh del navegador conserva las observaciones recién introducidas.

- [ ] **Step 5: Commit final si hubo ajustes**

Solo si Step 1-4 requirieron cambios:

```bash
git add <archivos>
git commit -m "chore(exporters): finalize bundle config and verify exports"
```

---

## Self-Review

**1. Spec coverage:**

| Sección del spec                                                            | Task que la implementa                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Arquitectura (estructura de archivos, lazy-load, función pura compartida)   | Tasks 4, 6, 7, 8, 10, 11                                                                                                           |
| UI: ExportMenu                                                              | Task 5                                                                                                                             |
| Bug fix Observaciones (state, save, migración soft)                         | Tasks 2, 3                                                                                                                         |
| Exportador Informe PDF                                                      | Task 7                                                                                                                             |
| Exportador Informe Word                                                     | Task 8                                                                                                                             |
| Wire ExportMenu en InformeJugadoresScreen                                   | Task 9                                                                                                                             |
| Exportador Asistencia Excel (13 hojas, colores, fórmulas)                   | Tasks 10, 11                                                                                                                       |
| Wire ExportMenu en AsistenciaScreen                                         | Task 12                                                                                                                            |
| Tests de helpers puros (Vitest)                                             | Tasks 2 (teamsService), 4 (exportUtils), 5 (ExportMenu), 6 (buildInformeData), 10 (asistencia helpers)                             |
| Verificación manual checklist                                               | Tasks 9, 12, 13                                                                                                                    |
| Edge cases (logo null, > 16 jugadores, > 16 sesiones, observaciones vacías) | Cubiertos en código de Task 7, 8, 11 (truncación con `.slice(0, MAX_*)`, condición en observaciones, fallback `try/catch` en logo) |
| Filenames                                                                   | Task 4 (`formatFilename`)                                                                                                          |
| Lazy-load de libs                                                           | Task 7, 8, 11 (todos `await import(...)`)                                                                                          |

**2. Placeholder scan:** ningún "TBD"/"TODO"/"implement later". Todo el código está completo. Cada step muestra el código exacto, no descripciones genéricas.

**3. Type consistency:**

- `buildInformeData` retorna `{ clubName, teamName, temporada, logoDataUrl, title, columns, rows, observaciones }` — usado idénticamente en Tasks 7 y 8.
- `groupSessionsByMonth` retorna `{ [monthKey]: [{ id, label, isCalendar }] }` — consumido en `buildMonthSheet` y `buildResumenSheet` con el mismo shape.
- `computeMonthTotals(member, sessions, attendance)` retorna `{ f, r, minus }` — consistente.
- `computeYearTotals(member, sessionsByMonth, attendance)` retorna `{ byMonth, year: { f, r, minus } }` — consistente.
- ExportMenu props: `{ items: [{ key, label, icon?, onClick, disabled? }], status? }` — consistente entre Tasks 5, 9, 12.
- `subscribeToInformeJugadores` callback recibe `{ rows, observaciones }` — consistente entre Tasks 2 y 3.
- `saveInformeJugadores(teamId, payload, ctx)` payload = `{ rows, observaciones }` — consistente.

Plan listo.
