# Export del Cuaderno: Informe Jugadores y Asistencia

**Fecha**: 2026-04-29
**Estado**: Aprobado, pendiente de plan de implementación
**Autor**: Sergio Paradela (con Claude)

## Resumen

Las pantallas `InformeJugadoresScreen` y `AsistenciaScreen` del cuaderno hoy solo permiten imprimir vía `window.print()`. Necesitamos añadir descarga de archivos:

- **Informe de jugadores** → PDF + Word (`.docx`).
- **Asistencia** → Excel (`.xlsx`).

Los archivos exportados deben replicar el formato de los referentes que el club usa (PDF/DOC del informe y XLSX de asistencia con 13 hojas). Toda la generación es client-side, lazy-loaded para no inflar el bundle inicial.

Como parte del alcance se arregla un bug detectado en la `<textarea>` de "Observaciones" del informe (no persistía).

## Decisiones tomadas durante el brainstorming

| Pregunta                 | Decisión                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| UX del botón de exportar | Reemplazar `Imprimir A4` por dropdown único `Exportar` con opciones Imprimir / PDF / Word (o Excel). |
| Contenido del PDF/Word   | Solo tabla + observaciones. Sin la explicación de columnas.                                          |
| Estructura del Excel     | Idéntica al referente: 13 hojas (Instrucciones + Agosto–Junio + Resumen), incluso meses vacíos.      |
| Bug de Observaciones     | Incluido en el alcance: persistir en Firestore junto al resto del informe.                           |
| Enfoque técnico          | Generación programática con `jspdf`+`jspdf-autotable`, `docx` y `exceljs`. Nada de HTML→imagen.      |
| Colores del Excel        | Sí. Reproducir paleta del referente con `exceljs`.                                                   |

## Arquitectura

```
src/
  services/exporters/
    informeExporter.js      # buildInformeData / exportInformeToPdf / exportInformeToWord
    asistenciaExporter.js   # exportAsistenciaToExcel
    exportUtils.js          # formatFilename, fetchLogoAsDataUrl, slugify, mes helpers
  components/cuaderno/
    ExportMenu.jsx          # Dropdown reutilizable
```

### Principios

- **Lazy-load** de las libs pesadas con `await import('jspdf')`, `await import('docx')`, `await import('exceljs')` dentro de cada `export*` async. El bundle inicial **no crece**: las libs solo se cargan al pulsar exportar.
- **Función pura `buildInformeData()`** produce un objeto neutro `{ clubName, teamName, temporada, logoDataUrl, columns, rows, observaciones }` que comparten PDF y Word — un solo punto de verdad para datos y orden.
- Funciones de export son `async` y retornan `Promise<void>`. Errores se propagan como excepciones, capturadas en el handler de UI y mostradas con `useToast`.
- Todas las funciones puras testeables sin invocar las libs reales.

## UI: ExportMenu

Componente nuevo `src/components/cuaderno/ExportMenu.jsx`.

```jsx
<ExportMenu
  status={saveStatus} // 'saving' | 'saved' (opcional, para badge a la izquierda)
  items={[
    { key: 'print', label: 'Imprimir A4', icon: <Printer />, onClick: handlePrint },
    { key: 'pdf', label: 'Descargar PDF', icon: <FileText />, onClick: handlePdf },
    { key: 'word', label: 'Descargar Word', icon: <FileType />, onClick: handleWord },
  ]}
/>
```

### Comportamiento

- Botón principal "Exportar" (icono `Download`, estilo igual al actual de `Imprimir A4`: `bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg`).
- Click abre dropdown alineado a la derecha (`absolute right-0 mt-1`) con los items.
- Cierra al click fuera (handler en `document` con cleanup), tecla `Escape`, o tras seleccionar un item.
- Cada item muestra `[icono] [label]` y dispara su `onClick`.
- Mantiene el badge `Guardando.../✓ Guardado` a la izquierda del botón si `status` viene definido.
- Estilo accesible: `role="menu"`, items `role="menuitem"`, navegación con flechas y `Enter`.
- En `print:hidden` para que no aparezca al imprimir.

### Integración en InformeJugadoresScreen.jsx

Reemplaza el bloque actual del botón "Imprimir A4" (líneas ~315–321):

```jsx
<ExportMenu
  status={saveStatus}
  items={[
    { key: 'print', label: 'Imprimir A4', icon: <Printer size={15} />, onClick: () => window.print() },
    { key: 'pdf', label: 'Descargar PDF', icon: <FileText size={15} />, onClick: handleExportPdf },
    { key: 'word', label: 'Descargar Word', icon: <FileType size={15} />, onClick: handleExportWord },
  ]}
/>
```

`handleExportPdf` y `handleExportWord` viven en el componente, llaman a `buildInformeData()` con los datos actuales y luego al exporter correspondiente; capturan errores y disparan `useToast`.

### Integración en AsistenciaScreen.jsx

Mismo patrón pero items `Imprimir` + `Descargar Excel`. Solo un handler nuevo: `handleExportExcel`.

## Bug fix: persistencia de Observaciones del informe

### Estado actual

`InformeJugadoresScreen.jsx:444-449` tiene una `<textarea>` sin `value` ni `onChange`. Lo que escriba el usuario se pierde al refrescar.

### Cambio

1. **State**: añadir `const [observaciones, setObservaciones] = useState('')` en el componente.
2. **Wire-up**: `<textarea value={observaciones} onChange={e => updateObservaciones(e.target.value)} />`.
3. **Save**: nueva función `updateObservaciones(text)` que actualiza state y dispara `triggerSave({ rows, observaciones: text })`.
4. **Reset**: `confirmReset()` también pone `setObservaciones('')`.

### Migración soft del modelo de datos

`subscribeToInformeJugadores` y `saveInformeJugadores` viven en `services/teamsService.js`. Hoy guardan/devuelven un array plano de filas. Cambio:

- **`subscribeToInformeJugadores(callback)`**: el callback recibe `{ rows, observaciones }`. Si el doc en Firestore es array (legacy), el wrapper lo normaliza a `{ rows: legacyArray, observaciones: '' }`. Si es objeto, lo pasa tal cual.
- **`saveInformeJugadores(teamId, payload, ctx)`**: `payload` siempre es `{ rows, observaciones }`. Escribe el objeto. Los docs antiguos se sobreescriben con el nuevo formato la primera vez que se modifica el informe.
- Las firmas se actualizan en una sola línea cada una; los tests existentes se ajustan.

### Estructura Firestore

```
artifacts/{appId}/users/{uid}/teams/{teamId}/cuaderno/informeJugadores
  {
    rows: [{ id, ranking, nombre, compromiso, actitud, aptitudes, capAprender, calidad, tiro }, ...],
    observaciones: '...'
  }
```

(Mismo path que ya usa el código; cambia solo el shape del valor.)

## Exportador de Informe (PDF + Word)

### `buildInformeData(team, profile, rows, observaciones, temporada): InformeData`

Función pura. Devuelve:

```ts
{
  clubName: string; // profile.nombreClub || 'Uros de Rivas'
  teamName: string; // teamDisplayName(team)
  temporada: string; // ej. '2025-26'
  logoDataUrl: string | null; // dataURL del logo, o null si no hay/falla
  title: string; // 'INFORME JUGADORES/AS 2025-26'
  columns: [{ key, label }]; // Las 8 columnas en orden
  rows: [{ ranking, nombre, compromiso, actitud, aptitudes, capAprender, calidad, tiro }];
  observaciones: string; // puede ser ''
}
```

`logoDataUrl` se obtiene con `fetchLogoAsDataUrl(profile.logoClub)` (helper en `exportUtils.js`): hace `fetch(url)` + `blob.arrayBuffer` + base64. Si falla (CORS, 404, URL vacía), retorna `null` sin lanzar.

### `exportInformeToPdf(data: InformeData): Promise<void>`

Usa `jspdf` + `jspdf-autotable`. Lazy-loaded.

**Layout (A4 landscape, márgenes 14mm)**:

```
[Logo 25mm × 25mm en (14, 8)]   [INFORME JUGADORES/AS 2025-26]   [Temporada 2025-26]
                                [Equipo - {teamName}]            (texto pequeño gris der)

[Tabla autotable]
  - theme: 'grid'
  - headStyles: fillColor [240,240,240], textColor [50,50,50], fontStyle 'bold', halign 'center'
  - bodyStyles: fontSize 8, valign 'top', cellPadding 1.5
  - columnStyles: ranking { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
                  nombre { cellWidth: 32, fontStyle: 'bold' },
                  resto: cellWidth 'auto' (autotable distribuye)

[Observaciones - solo si .trim() != '']
  Línea en blanco
  "Observaciones –" en bold
  Texto multiline (jsPDF.splitTextToSize para wrap)
```

Header callback: en cada página, dibujar logo + temporada arriba (excepto título completo, que va solo en página 1). Footer: número de página `{n} / {total}` abajo-derecha.

Descarga: `doc.save(filename)`. Filename = `Informe-jugadores-{slug(teamName)}-{temporada}.pdf`.

### `exportInformeToWord(data: InformeData): Promise<void>`

Usa la lib `docx`. Lazy-loaded.

**Estructura**:

```
Document {
  sections: [{
    properties: { page: { size: { orientation: 'landscape' } } },
    headers: {
      default: new Header({
        children: [tabla 3 cols sin bordes: logo | título 2 líneas | temporada]
      })
    },
    children: [
      new Table({
        width: { size: 100, type: PERCENTAGE },
        rows: [
          headerRow (8 celdas con fill #F2F2F2, bold),
          ...dataRows  // borde gris, alineación top
        ]
      }),
      // Solo si observaciones no vacío:
      new Paragraph(''),
      new Paragraph({ children: [new TextRun({ text: 'Observaciones –', bold: true })] }),
      new Paragraph(observaciones)  // \n se manejan splitting en \n y mapeando a múltiples Paragraph
    ]
  }]
}
```

Anchos de columna en docx: ranking 600 dxa, nombre 1800 dxa, resto reparto equitativo del resto del ancho. Bordes: `single` 4 dxa color `auto`.

Descarga: `Packer.toBlob(doc)` → `URL.createObjectURL` → click en `<a download>`.

Filename: `Informe-jugadores-{slug(teamName)}-{temporada}.docx`.

### Edge cases

- `logoDataUrl === null`: PDF y Word omiten la imagen. La columna del logo queda en blanco; no hay layout shift (la celda existe).
- Filas con `nombre === ''`: se exportan igual (la referencia las tiene como filas vacías al final).
- Texto largo en celdas: `jspdf-autotable` hace word-wrap automático; `docx` también con `text-wrap` por defecto.
- `observaciones === ''` o solo whitespace: no se incluye el bloque (no se añade párrafo en blanco al final).
- `temporada` no calculable: fallback a `getTemporada()` (que ya devuelve la actual del año).

## Exportador de Asistencia (Excel)

### `exportAsistenciaToExcel(team, profile, members, attendance, calSessions, manualSessions, temporada): Promise<void>`

Usa `exceljs`. Lazy-loaded.

Internamente compone 13 worksheets en este orden:

#### 1. `Instrucciones`

- Logo arriba-izquierda (`workbook.addImage` + `worksheet.addImage`). Si no hay logo, se omite.
- A1: vacío. C2: "Instrucciones" (font 14 bold).
- B3: "Nombre del equipo". E3: `teamName`.
- A5..B20 (16 filas): `[i, member.nombre || 'Jugador/a {i}']` para i en 1..16.
- D-X de las filas 5-21: bullets con la nomenclatura y celdas demo coloreadas (fill F=red, r=yellow, etc).
- Notas finales sobre totales y sesiones (texto plano).

#### 2-12. Hojas mensuales: `Agosto`, `Septiembre`, `Octubre`, `Noviembre`, `Diciembre`, `Enero`, `Febrero`, `Marzo`, `Abril`, `Mayo`, `Junio`

Layout idéntico a la referencia (`Range A1:V22`):

```
fila 1: vacía
fila 2: C2 = nombre del mes (font 14 bold)
fila 3: E3 = nombre del equipo (cell merge si hace falta)
fila 4: T4 = "Totales" (merge T4:V4)
fila 5: A5='', B5='', C5..R5 = etiquetas de sesiones (`X-20`, `J-21`, …, hasta 16 columnas), T5='F', U5='R', V5='-'
filas 6-21: A=índice (1..16), B=nombre, C..R=código de asistencia, T=COUNTIF F+L+, U=COUNTIF r+R, V=COUNTIF -
fila 22: A='', B='Totales', C..R=COUNTIF F del día (suma de la columna)
```

**Etiquetas de sesiones**:

- Sesiones del calendario primero, ordenadas por fecha; luego sesiones manuales, también por fecha si tienen, o por orden de creación.
- Etiqueta = primera letra del día semana (L/M/X/J/V/S/D) + '-' + día del mes. Helper compartido con la pantalla.
- Si hay más de 16 sesiones en un mes (raro), el header queda en `Range A1:V22` igual que la referencia y se truncan las extra (con warning console). [Decisión: documentar pero no manejar; los meses reales siempre tienen ≤ 16.]

**Colores de celda** (aplicados al guardar, no condicional):
| Código | Fill | Texto |
| --- | --- | --- |
| `F` | `FFEF4444` (rojo) | blanco bold |
| `r`, `R` | `FFFDE047` (amarillo) | negro bold |
| `-` | `FF111827` (negro) | blanco bold |
| `L+` | `FF60A5FA` (azul) | blanco bold |
| `L` | sin fill | gris |
| `''` | sin fill | — |

Anchos: A=4, B=30, C..R=6, T..V=6.

**Hojas vacías**: se crean igual con la estructura completa, fila 5 con etiquetas vacías y filas 6-21 con nombres pero celdas C..R en blanco. Igual que la referencia para Agosto.

**Fórmulas vs valores**: las celdas de totales (T, U, V por jugador y fila 22 por día) se escriben como **fórmulas COUNTIF** con `result` cacheado, para que si el usuario edita la asistencia en Excel los totales recalculen. Ej.: `T6 = { formula: 'COUNTIF(C6:R6,"F")+COUNTIF(C6:R6,"L+")', result: 3 }`.

#### 13. `Resumen`

```
fila 1: vacía
fila 2: A2 = 'Resumen Asistencia 2025-26' (font 14 bold, merge A2:R2)
fila 3: F3 = nombre del equipo (merge F3:N3)
fila 4: P4 = 'Totales' (merge P4:R4)
fila 5: A5='', B5='', F5='Sep', G5='Oct', H5='Nov', I5='Dic', J5='Ene', K5='Feb', L5='Mar', M5='Abr', N5='May', O5='Jun', P5='F', Q5='R', R5='-'
filas 6-21: A=índice, B=nombre (merge B:E por fila), F..O=total faltas mensuales (F+L+ del mes), P=total F año, Q=total R año, R=total - año
fila 22: B22='Totales equipo' (merge B22:E22), F..O=suma F del equipo por mes
```

(Reproduce exactamente el layout del referente. Nota: el referente NO incluye Agosto en el Resumen — sigue esa convención.)

**Valores vs fórmulas en Resumen**: los totales del Resumen se escriben como **valores estáticos** (calculados al exportar). Las fórmulas cross-sheet (`=Diciembre!T6+Enero!T6+...`) son frágiles si el usuario reordena hojas; preferimos un snapshot consistente con la app. Si el usuario edita totales en hojas mensuales, debe re-exportar para refrescar el Resumen.

### Filename

`Asistencia-{slug(teamName)}-{temporada}.xlsx`.

### Datos fuente

Pasados desde `AsistenciaScreen` al exporter, vienen del hook `useAttendance`:

- `members` — jugadores (orden = orden visual en pantalla).
- `attendance` — `{ [sessionId]: { [memberId]: code } }`.
- `calSessions` — sesiones del calendario, todas, con `fecha`, `id`, etiqueta calculada.
- `manualSessions` — `{ [monthKey]: [{ id, label }, ...] }`.

El exporter agrupa por mes con `monthKeyFromDate(sess.fecha)` (helper ya exportado por el hook).

### Edge cases

- Logo no embebido: la hoja `Instrucciones` simplemente no muestra imagen. Layout intacto.
- Mes con > 16 sesiones: warning console, se truncan las extra. (Asumido como caso no realista en uso normal.)
- Jugadores < 16: las filas 5-20 contienen los reales y luego "Jugador/a 13", …, "Jugador/a 16" como en la referencia.
- Jugadores > 16: warning console, se exportan los primeros 16. (Caso no realista en minibasket.)
- `attendance` vacío: las celdas quedan en blanco; totales = 0.

## Tests

### Unit tests (Vitest)

`src/services/exporters/__tests__/`:

- **`informeExporter.test.js`**:
  - `buildInformeData` — outputs correctos con/sin observaciones, con/sin logo, con teamName variado.
  - `formatFilename(type, teamName, temporada)` — slug correcto, extensiones correctas, caracteres especiales.

- **`asistenciaExporter.test.js`**:
  - `groupSessionsByMonth(calSessions, manualSessions)` — orden cronológico, mes correcto, etiquetas.
  - `computeMonthTotals(members, attendance, sessionsOfMonth)` — totales F, R, − por jugador y por día.
  - `computeYearTotals(...)` — Resumen por jugador.

**No** invocar `jspdf`/`docx`/`exceljs` reales en tests. Las funciones de export que sí los invocan (`exportInformeToPdf`, `exportInformeToWord`, `exportAsistenciaToExcel`) se prueban manualmente en navegador (no son críticos para CI; el comportamiento crítico está en las funciones puras de armado de datos).

### Test de UI

`src/components/cuaderno/__tests__/ExportMenu.test.jsx`:

- Render con items, click abre menú, click en item llama `onClick`, click fuera cierra, `Escape` cierra.
- Estado `disabled` en items.

### Verificación manual (checklist post-implementación)

- [ ] Descarga PDF → abre en lector PDF, texto es seleccionable, layout ≈ referencia.
- [ ] Descarga Word → abre en Word/LibreOffice, tabla editable, textos en celdas correctos.
- [ ] Descarga Excel → 13 hojas, colores correctos en F/r/R/−/L+, totales OK, fórmulas (si las hay) calculan.
- [ ] Imprimir sigue funcionando igual que antes.
- [ ] Observaciones se persisten al refrescar.
- [ ] Limpiar limpia también observaciones.
- [ ] Logo del club aparece en los 3 formatos cuando hay; se omite limpiamente cuando no hay.

## Dependencias nuevas

| Lib               | Tamaño gzip approx | Uso                         |
| ----------------- | ------------------ | --------------------------- |
| `jspdf`           | ~145 KB            | Generar PDF                 |
| `jspdf-autotable` | ~25 KB             | Tablas en jsPDF             |
| `docx`            | ~205 KB            | Generar `.docx`             |
| `exceljs`         | ~280 KB            | Generar `.xlsx` con estilos |

Total ~655 KB gzip añadidos solo cuando el usuario pulsa exportar. Bundle inicial sin cambios.

`xlsx` (existente) sigue usándose en `useCalendarImport.js` para leer Excel — no se quita.

## Fuera del alcance

- Ediciones inline en el archivo exportado (es one-shot generate-and-download).
- Watermarks, firmas digitales, encriptación.
- Logos por jugador (foto). Solo logo de club.
- Plantillas alternativas — el formato es fijo, igual al referente del club.
- Exportar otras pantallas del cuaderno (Pilares, Test Tiro, etc). Si en el futuro se quiere, el patrón `ExportMenu` + `services/exporters/` es reusable directamente.

## Riesgos

- **Carga de imágenes con CORS**: si el logo está en un bucket sin CORS abierto, `fetchLogoAsDataUrl` falla. Mitigación: graceful fallback (omitir logo). El logo del club hoy se sube a Firebase Storage, donde Firebase configura CORS apropiado por defecto.
- **Tamaño de bundle de las libs**: ~655 KB gzip lazy-loaded. Mitigación: solo se descargan al pulsar exportar; pre-cache del navegador entre sesiones.
- **Compatibilidad de `.docx` en LibreOffice/Pages**: `docx` produce OOXML estándar, debería abrir bien. Verificar manualmente en LibreOffice.
- **Limites de exceljs en mobile Safari**: histórico de problemas con archivos > 10MB; nuestros archivos serán <100KB.
