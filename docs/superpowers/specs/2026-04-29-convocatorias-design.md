# Convocatorias de partido — diseño

> Fecha: 2026-04-29
> Estado: spec aprobado por usuario, pendiente de plan de implementación

## Contexto

Los entrenadores de baloncesto envían un mensaje pre-partido a jugadores y familias por WhatsApp con la información logística del partido (fase/jornada, rival, hora, lugar, hora de cita). Hoy lo redactan a mano cada vez. Esta entrega añade generación asistida del mensaje desde los datos del partido, configuración del equipo, y recordatorios en la app para evitar olvidos.

Mensajes de referencia que el sistema debe poder reproducir:

```
Buenas noches.

*Fase 1 (2ª vuelta)*

_Jornada 15 vs Movistar Estudiantes_

Jugamos mañana a las 9:30 en https://maps.app.goo.gl/Sc93PwU8kxUgzKty8. Han cambiado la pista, jugamos en el *Ramiro de Maeztu*.

Quedamos allí a las 8:45.

Nos vemos mañana!
🏀💪🏻🐃
```

```
Buenas tardes.

*Playoffs 1/8*

_Jornada 1 vs Saltium Alcorcón Basket_

Citamos a los chicos a las 17:30 en https://maps.app.goo.gl/VYnCPhvV94o5iphNA, para empezar a las 18:30.

Importarte llevar ambas equipaciones.

Nos vemos mañana 🐃🏀💪🏻
```

## Objetivos

1. Generar el mensaje de convocatoria desde los datos estructurados del partido, con encabezado contextual (liga / playoff / amistoso).
2. Permitir personalizar la plantilla por equipo y añadir notas extra por partido.
3. Copiar al portapapeles o compartir por WhatsApp vía share-sheet del SO (sin gestión de contactos en la app, sin APIs de pago).
4. Recordar al entrenador en `Pendientes` los partidos próximos con convocatoria sin enviar y los cumpleaños del día.
5. Hacer la feature accesible vía Pick (chat) con paridad funcional (principio de PRODUCT.md).
6. Resolver dependencias de datos: modelar competiciones del equipo, ubicación con maps URL, hora de cita, hora-fin auto-estimada por categoría.

## No objetivos (explícitos)

- Agenda de contactos del equipo con teléfonos guardados.
- WhatsApp Business API o envío automático sin intervención del usuario.
- Plantilla de mensaje para cumpleaños (cumpleaños son recordatorio pasivo).
- Cumpleaños del propio entrenador en `Pendientes`.
- Autocomplete de pabellones vía Google Places API.
- Migración batch del campo `convocatoria` antiguo.
- Notificaciones push del recordatorio (no hay infra de push hoy).

## Decisiones de producto (resumen)

| #   | Decisión                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Modelo de competición por equipo de **dos niveles**: `competition.fases[].jornadas`. La "vuelta" se infiere por posición de la jornada en la fase (mitad inferior = 1ª vuelta, mitad superior = 2ª vuelta) cuando `jornadas` es par. Si es impar, se omite la vuelta. |
| 2   | Partidos amistosos no llevan `competitionId` y se renderizan con encabezado "Amistoso vs {rival}".                                                                                                                                                                    |
| 3   | Ubicación: dos campos paralelos `lugar` (texto) y `lugarMapsUrl` (URL). Auto-derivación del nombre desde shortlinks `maps.app.goo.gl/*` vía Cloud Function.                                                                                                           |
| 4   | Pabellones recurrentes guardados a nivel equipo (array `pabellones`); en partido como local no se incluye URL en el mensaje (el equipo conoce el sitio).                                                                                                              |
| 5   | Hora de cita: `team.citaOffsetMinutos` (default 45) calcula `horaCita = horaInicio - offset`. Override por partido `session.horaCita` posible.                                                                                                                        |
| 6   | `horaFin` para partidos: oculto en el formulario, auto-estimado por `team.categoria` desde tabla constante (`DURACION_PARTIDO_MINUTOS`). Editable bajo "Ajustar". Para entrenamientos sigue como hoy.                                                                 |
| 7   | Plantilla del mensaje: una por equipo (`team.plantillaConvocatoria`) con default global, configurable. Encabezado generado por motor (no editable como variable suelta).                                                                                              |
| 8   | Personalización por partido: campo opcional `session.notaExtra` que se inyecta en la plantilla.                                                                                                                                                                       |
| 9   | Envío: solo `Copiar` al portapapeles + `Compartir por WhatsApp` (share-sheet del SO). Cero gestión de contactos.                                                                                                                                                      |
| 10  | Trigger del modal: desde `SessionDetailModal`, desde mini-icono en celda del calendario, y desde Pick.                                                                                                                                                                |
| 11  | Recordatorio "convocatoria pendiente": ventana configurable por equipo (`team.convocatoriaReminderHours`, default 72). Severidad `high` cuando `<24h`.                                                                                                                |
| 12  | Cumpleaños: pasivos, sin acción de mensaje. Cubren todos los `members` (jugadores y staff) de todos los equipos del usuario. Día-de = `high`, día-anterior = normal. Cumple del propio entrenador no se muestra.                                                      |
| 13  | Pick: tools `mandarConvocatoria` y `listarPartidosPendientesConvocatoria`, ambas en esta entrega. Render del mensaje en `ConvocatoriaBlock` (no markdown plano).                                                                                                      |
| 14  | Naming: `session.jugadoresConvocados` (renombrado del actual `session.convocatoria`), `session.mensajeConvocatoria` (snapshot del mensaje enviado). Lectura tolerante indefinida del campo viejo.                                                                     |
| 15  | Vista `/pendientes` completa para overflow de la lista del home.                                                                                                                                                                                                      |

## Arquitectura

```
                              ┌──────────────────────────────────┐
                              │  src/utils/convocatoriaTemplate  │  motor puro
                              │  (re-export desde shared TS)     │
                              └────────────┬─────────────────────┘
                                           │ usa
        ┌──────────────────────────────────┼──────────────────────────────────┐
        │                                  │                                  │
┌───────▼────────┐         ┌────────────────▼─────────────┐         ┌─────────▼────────┐
│ ConvocatoriaModal│         │ functions/ai/tools           │         │ ConvocatoriaBlock│
│ (sub-modal UI)  │         │   mandarConvocatoria         │         │ (chat block)     │
│                 │         │   listarPartidosPendientes   │         │                  │
└─────────────────┘         └──────────────────────────────┘         └──────────────────┘
        ▲                                  ▲                                  ▲
        │ abre desde                       │ Pick invoca                      │ Pick devuelve
        │                                  │                                  │
┌───────┴────────────────┐         ┌───────┴──────────────┐         ┌─────────┴────────┐
│ SessionDetailModal     │         │ Pick chat (ScreenCtx)│         │ PickRoot         │
│ Calendar mini-icon     │         │                      │         │                  │
│ /pendientes route      │         └──────────────────────┘         └──────────────────┘
└────────────────────────┘
```

**Capas:**

1. **Motor puro** (`src/utils/convocatoriaTemplate.js`, espejado en `functions/src/shared/convocatoriaTemplate.ts`): funciones puras `renderConvocatoria({ session, team, competition, members, now })` → `{ encabezado, mensaje, variablesResueltas }`. Sin React, sin Firestore. Cubre las tres ramas (liga / playoff / amistoso). Reutilizado por UI cliente y Pick tool.
2. **Cloud Function `resolveMapsUrl`** (HTTPS callable): sigue redirects de `maps.app.goo.gl/*` con timeout de 5s, parsea `place/<nombre>` del URL final, decodifica URL-encoding, devuelve `{ resolvedUrl, placeName }`. Cache en memoria 24h por `shortUrl`. Requiere `request.auth`.
3. **UI**:
   - `src/components/calendar/ConvocatoriaModal.jsx` — sub-modal de generación.
   - `src/components/pick/blocks/ConvocatoriaBlock.tsx` — render dentro del chat de Pick (mismo contenido del modal, distinto contenedor).
   - Pestañas nuevas en `TeamDetailScreen`: `Convocatorias` y `Competiciones`.
   - Ruta nueva `/pendientes` con la vista completa.
4. **Pick tools** en `functions/src/ai/tools/writeTools.ts`:
   - `mandarConvocatoria` — invoca el motor puro y devuelve el mensaje. NO escribe `convocatoriaSentAt`.
   - `listarPartidosPendientesConvocatoria` — query de partidos en ventana del equipo sin envío registrado.
5. **Pendientes** — extender `PendingActionsList` y `homeUtils.js` con dos generadores nuevos (`buildConvocatoriaPendientes`, `buildCumpleañosDelDia`).

## Modelo de datos

### Subcolección nueva: competitions

```
artifacts/{appId}/users/{uid}/teams/{teamId}/competitions/{competitionId}
```

Schema:

```ts
{
  id: string,
  nombre: string,                 // ej. "Liga Cadete A Madrid"
  fases: Array<{
    id: string,
    nombre: string,               // ej. "Fase 1", "Permanencia"
    jornadas: number              // 22 → renderiza 1ª/2ª vuelta si par
  }>,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

Múltiples competiciones por equipo permitidas (liga + copa). Sin restricción de exclusividad.

### Campos nuevos en `team`

```ts
{
  // ... existentes
  plantillaConvocatoria?: string,            // null = usar default global
  citaOffsetMinutos?: number,                // null = 45
  convocatoriaReminderHours?: number,        // null = 72
  pabellones?: Array<{                        // null = []
    nombre: string,
    mapsUrl: string,
  }>,
}
```

### Cambios en `calendarSessions`

```ts
{
  // ... existentes (fecha, horaInicio, horaFin, lugar, rival, esLocal, tipo, etc.)

  // RENOMBRADO
  jugadoresConvocados?: string,              // antes: convocatoria
  // El campo `convocatoria` antiguo se sigue leyendo pero ya no se escribe

  // NUEVOS
  competitionId?: string | null,             // null = amistoso (para tipo='partido')
  faseId?: string | null,
  jornadaNumero?: number | null,
  jornadaNumeroManual?: boolean,             // true = no recalcular auto
  lugarMapsUrl?: string | null,
  horaCita?: string | null,                  // override del offset del equipo
  notaExtra?: string | null,                 // texto extra del partido
  mensajeConvocatoria?: string | null,       // snapshot del último mensaje enviado
  convocatoriaSentAt?: Timestamp | null,
}
```

### Doc lateral para playoffs virtuales

```
artifacts/{appId}/users/{uid}/playoffConvocatorias/{playoffSessionId}
```

Schema:

```ts
{
  sessionId: string,                         // mismo id que la session virtual
  bracketId: string,
  bracketMatchId: string,
  gameIndex: number,
  mensajeConvocatoria: string,
  convocatoriaSentAt: Timestamp,
  notaExtra?: string,
  horaCita?: string,
}
```

Razón: las sesiones de playoff son virtuales (generadas en runtime por `buildPlayoffSessions`) y no persisten en `calendarSessions`. Este doc lateral guarda solo lo añadido por la feature de convocatoria, sin duplicar el resto.

### Reglas Firestore

```
match /artifacts/{appId}/users/{uid}/teams/{teamId}/competitions/{competitionId} {
  allow read, write: if request.auth.uid == uid;
}
match /artifacts/{appId}/users/{uid}/playoffConvocatorias/{docId} {
  allow read, write: if request.auth.uid == uid;
}
```

## Motor del template

### Encabezado contextual

| Tipo de partido                                        | Render                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Liga, fase con jornadas par, jornada en mitad inferior | `*{competition.nombre} — {fase.nombre} (1ª vuelta)*\n_Jornada {jornadaNumero} vs {rival}_` |
| Liga, fase con jornadas par, jornada en mitad superior | `*{competition.nombre} — {fase.nombre} (2ª vuelta)*\n_Jornada {jornadaNumero} vs {rival}_` |
| Liga, fase con jornadas impar                          | `*{competition.nombre} — {fase.nombre}*\n_Jornada {jornadaNumero} vs {rival}_`             |
| Playoff                                                | `*Playoffs {matchTitle}*\n_Jornada {gameIndex+1} vs {rival}_`                              |
| Amistoso                                               | `*Amistoso*\n_vs {rival}_`                                                                 |

Regla de vuelta: `vuelta = jornadaNumero <= floor(jornadasFase / 2) ? '1ª' : '2ª'` aplicado solo si `jornadasFase % 2 === 0`.

### Variables del cuerpo

| Variable                  | Valor                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{saludo}`                | Según hora de render: `>=18:00` → "Buenas noches", `>=14:00` → "Buenas tardes", resto → "Buenos días"                                               |
| `{ENCABEZADO}`            | Bloque generado (no editable como variable suelta — se inyecta entero)                                                                              |
| `{rival}`                 | `session.rival`                                                                                                                                     |
| `{fechaRelativa}`         | Distancia desde `now`: hoy → "hoy", +1d → "mañana", +2..+6d → nombre del día (`"el sábado"`), +7d en adelante → fecha completa (`"el 15 de marzo"`) |
| `{horaInicio}`            | `session.horaInicio` formato `HH:mm`                                                                                                                |
| `{horaCita}`              | `session.horaCita` si existe, si no calculado desde `horaInicio - team.citaOffsetMinutos`                                                           |
| `{lugar}`                 | `session.lugar`                                                                                                                                     |
| `{lugarUrlSiVisitante}`   | Si `esLocal === false` y `lugarMapsUrl != null` → ` ${lugarMapsUrl}`, si no → `""`                                                                  |
| `{citaSiVisitante}`       | Si `esLocal === false` → `"allí"`, si no → `"en el pabellón"`                                                                                       |
| `{notaExtra}`             | `session.notaExtra`. Si vacío, la línea entera se elide                                                                                             |
| `{fechaRelativaNosVemos}` | Igual que `{fechaRelativa}`                                                                                                                         |

### Default global de plantilla

```
{saludo}.

{ENCABEZADO}

Jugamos {fechaRelativa} a las {horaInicio} en {lugar}{lugarUrlSiVisitante}.

Quedamos {citaSiVisitante} a las {horaCita}.

{notaExtra}

Nos vemos {fechaRelativaNosVemos}!
🏀💪🏻
```

Variables sin valor → la línea entera se elide. El motor procesa línea a línea y descarta las que tras sustituir queden con todas sus variables vacías.

### Auto-numeración de jornadas

Al asignar `competitionId` y `faseId` a un partido sin override manual, `jornadaNumero` se calcula así:

1. Listar todos los partidos del equipo con esa misma `competitionId` + `faseId`, ordenados por `fecha`.
2. La posición ordinal del partido en esa lista es su `jornadaNumero`.
3. Validación: si esa posición excede `fase.jornadas`, el form muestra un warning.

**Override manual:** el form de partido permite editar `jornadaNumero` directamente. Al hacerlo, se marca `session.jornadaNumeroManual = true`. Los partidos con flag manual quedan fijados y el recálculo automático los respeta (los excluye del set a renumerar y mantiene su valor).

Reprogramaciones: si la fecha de un partido (no manual) cambia, el motor recalcula al guardar todas las jornadas no-manuales de su `(competitionId, faseId)`. Operación idempotente.

## UI

### `TeamDetailScreen` — pestaña "Competiciones"

CRUD de competiciones del equipo. Lista con cards por competición, cada una mostrando sus fases y nº de jornadas. Botón "Añadir competición" abre form con: nombre + builder de fases (añadir fase / nombrar / nº jornadas / quitar). Edición y borrado por card. Borrado de competición muestra confirmación si hay partidos vinculados.

### `TeamDetailScreen` — pestaña "Convocatorias"

Cuatro secciones:

1. **Plantilla del mensaje**: textarea grande + panel lateral con chips de variables clicables (insertan en cursor) + preview en vivo abajo (el motor renderiza con un partido de ejemplo: rival "Movistar Estudiantes", liga ficticia). Botones "Restaurar default" y "Guardar".
2. **Hora de cita**: input numérico para `citaOffsetMinutos` con label "Citamos X minutos antes del partido" + texto auxiliar "Puedes ajustarlo en cada partido si lo necesitas".
3. **Recordatorio**: input numérico para `convocatoriaReminderHours` con label "Avísame X horas antes del partido si no he mandado la convocatoria".
4. **Pabellones recurrentes**: lista editable de `{ nombre, mapsUrl }` con botón "Añadir pabellón". Vacío al crear el equipo. Se rellenan también automáticamente al guardar un partido como local con un pabellón nuevo (con confirmación discreta tipo "Guardar este pabellón para próximas veces").

### `SessionFormModal` — cambios

Para `tipo === 'partido'`:

- **Tipo de partido**: nuevo selector "Liga / Amistoso" arriba del campo Rival. Si "Liga": muestra dropdown de competiciones del equipo + dropdown de fases + número de jornada (auto-calculado al guardar, override editable).
- **Hora fin**: oculto por defecto. Detalle pequeño _"Duración estimada: 90 min · Ajustar"_ que despliega el input al pulsar "Ajustar". Al guardar, si `horaFin` es null se calcula como `horaInicio + DURACION_PARTIDO_MINUTOS[team.categoria]`.
- **Lugar**: dos campos paralelos, `lugar` (texto) y `lugarMapsUrl` (URL). Al pegar URL en `lugarMapsUrl`, se invoca `resolveMapsUrl` Cloud Function y `lugar` se auto-rellena con el placeName extraído (editable después). Para partido como local, dropdown con `team.pabellones` que prerellena ambos campos al elegir uno.
- **Nota extra para la convocatoria** (campo nuevo, opcional): textarea pequeño con label "Algo extra que avisar al grupo (ej. llevar ambas equipaciones)".
- **Convocados** (campo renombrado): el textarea actual de "Convocatoria (opcional)" pasa a llamarse "Jugadores convocados". Persiste como `jugadoresConvocados`.

Para `tipo === 'entrenamiento'`: sin cambios.

### `SessionDetailModal` — botón nuevo

En la columna de acciones (donde hoy aparecen "Scouting", "Análisis", "Planilla"), añadir botón **"Mandar convocatoria"** (icono `Send`, paleta rosa). Solo visible para `tipo === 'partido' | 'playoff'`. Si `convocatoriaSentAt != null`, el botón muestra estado "✓ Convocatoria enviada — reenviar".

Comportamiento al re-abrir un partido ya enviado: el modal se abre con el `mensajeConvocatoria` snapshot persistido (no re-renderiza con datos actuales). Es editable. Al confirmar copia/compartir, sobrescribe `mensajeConvocatoria` y `convocatoriaSentAt`. Hay un botón secundario "Regenerar desde plantilla" que descarta el snapshot y re-renderiza con los datos actuales del partido (útil si el partido cambió de fecha/lugar después del envío inicial).

### `ConvocatoriaModal`

Sub-modal con:

- Header: nombre del partido + chip de tipo (Liga "{competition.nombre}" / Playoff / Amistoso) + fecha relativa.
- Inputs rápidos arriba: `notaExtra` (input que actualiza el render al instante) + `horaCita` (override del calculado).
- Textarea grande con el mensaje renderizado, totalmente editable.
- Footer: botón `Copiar` (clipboard.writeText) + botón `Compartir por WhatsApp` (`whatsapp://send?text=${encodeURIComponent(mensaje)}` con fallback a `navigator.share({ text })` y a copia silenciosa con toast).
- Al confirmar copia/compartir: marca `convocatoriaSentAt = serverTimestamp()` y guarda `mensajeConvocatoria` con el texto final. Para playoff virtual, escribe en `playoffConvocatorias/{sessionId}`. El item desaparece de Pendientes.

### Calendario — mini-icono `Send`

En `MonthGrid`, `WeekView` y `DayView`, cada celda de partido (no playoff con fecha pasada) muestra un mini-icono `Send` superpuesto cuando `convocatoriaSentAt == null`. Click en el icono abre directamente el `ConvocatoriaModal` sin pasar por `SessionDetailModal`. El icono se oculta para partidos pasados y para los ya enviados.

### Ruta `/pendientes`

Vista completa con todos los items de `PendingActionsList` sin truncado. Filtros por equipo (multi-select) y por tipo (`result` / `convocatoria` / `cumpleaños`). Layout vertical, una columna en móvil, dos en desktop.

Item de cumpleaños abre un mini-modal pasivo con avatar, nombre, equipo, rol/dorsal, edad, sin acciones de mensaje (decidido). Botón "Marcar como visto" persiste en `localStorage` (`cumpleañosSeen-{memberId}-{año}`) para que no aparezca el resto del día.

## Pendientes — lógica

```
buildConvocatoriaPendientes(sessions, teams, now):
  result = []
  for each session in sessions where tipo in ['partido', 'playoff']:
    if session.convocatoriaSentAt != null: continue
    if (session.fecha + session.horaInicio) < now: continue
    horas = (session.fecha + session.horaInicio - now) / 3600000
    team = teams.find(t.id === session.teamId)
    ventana = team.convocatoriaReminderHours ?? 72
    if horas > ventana: continue
    severity = horas < 24 ? 'high' : 'normal'
    result.push({
      id: `convocatoria-${session.id}`,
      type: 'convocatoria',
      session, team,
      label: `Mandar convocatoria — vs ${session.rival}`,
      severity,
    })
  return result.sortBy(severity desc, fecha asc)

buildCumpleañosDelDia(members, teams, now):
  result = []
  for each member in all teams' members:
    if !member.fechaNacimiento: continue
    if cumpleHoy(member, now):
      result.push({ ..., severity: 'high', label: `Hoy cumple ${member.nombre}` })
    else if cumpleManana(member, now):
      result.push({ ..., severity: 'normal', label: `Mañana cumple ${member.nombre}` })
  return result
```

Edge cases:

- Cumpleaños 29-feb en años no bisiestos → matchea 28-feb (regla legal española).
- Múltiples cumpleaños mismo día → items separados, sin agrupar.
- Sesión de playoff virtual → `convocatoriaSentAt` se lee del doc lateral `playoffConvocatorias/{sessionId}` mergeado en runtime.
- Coordinador con muchos items → `PendingActionsList` del home trunca a 10 con CTA "+X más" → ruta `/pendientes`.

## Pick — tools

### `mandarConvocatoria`

```ts
{
  name: 'mandarConvocatoria',
  description: 'Genera el mensaje de convocatoria de un partido próximo del usuario. Devuelve el texto listo para que el entrenador lo copie/comparta. NO envía nada.',
  input: {
    sessionId: string,
    notaExtra?: string,
    horaCitaOverride?: string,
  },
  output: {
    mensaje: string,
    encabezado: string,
    sessionRef: { tipo, fecha, rival, lugar },
  }
}
```

### `listarPartidosPendientesConvocatoria`

```ts
{
  name: 'listarPartidosPendientesConvocatoria',
  description: 'Lista los partidos próximos del usuario que aún no tienen convocatoria enviada, dentro de la ventana de aviso del equipo.',
  input: { teamId?: string, limit?: number },
  output: {
    items: Array<{ sessionId, fecha, rival, horaInicio, severity }>
  }
}
```

### `ConvocatoriaBlock`

Bloque de chat custom (`src/components/pick/blocks/ConvocatoriaBlock.tsx`) que renderiza el output de `mandarConvocatoria` con la misma estética del `ConvocatoriaModal`. Acciones (Copiar, Compartir) marcan `convocatoriaSentAt` por la misma vía cliente. Es el `ConvocatoriaModal` re-encapsulado dentro de un contenedor de chat.

### Actualizaciones de prompt

- `functions/src/ai/promptManager.ts` aprende:
  - Cuándo invocar `mandarConvocatoria` (intenciones: "convocatoria", "mensaje del partido", "avisar al grupo", "cita del sábado", etc.).
  - Cuándo invocar `listarPartidosPendientesConvocatoria` (intención: "qué tengo pendiente esta semana", "qué convocatorias me faltan").
  - Devolver siempre el resultado a través del bloque `ConvocatoriaBlock`, nunca como texto plano.
  - Si `sessionId` no se identifica unívocamente, preguntar antes de invocar (no inventar).

### Contrato Pick

`functions/src/shared/pickContracts.ts` añade el bloque `ConvocatoriaBlock` con el shape del output.

## Cloud Function `resolveMapsUrl`

```ts
type Input = { shortUrl: string };
type Output = { resolvedUrl: string; placeName: string | null };

export const resolveMapsUrl = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '...');
  const { shortUrl } = request.data;
  if (!isMapsShortUrl(shortUrl)) throw new HttpsError('invalid-argument', '...');

  const cached = cache.get(shortUrl);
  if (cached) return cached;

  const resolvedUrl = await fetchRedirect(shortUrl, { timeoutMs: 5000 });
  const placeName = extractPlaceFromMapsUrl(resolvedUrl);
  const result = { resolvedUrl, placeName };
  cache.set(shortUrl, result, 24 * 3600);
  return result;
});
```

`extractPlaceFromMapsUrl` parsea segmentos `/maps/place/<encoded-name>/...` del URL final, hace `decodeURIComponent` y limpia separadores (`+` → ` `).

Errores degradan grácilmente: la UI permite seguir adelante con `lugar` vacío y el entrenador puede escribirlo a mano.

## Constantes nuevas

`src/utils/constants.js`:

```js
// Lookup case-insensitive con normalización (sin tildes, lowercase).
// Las claves cubren las categorías que devuelve formatTeamDisplayName.
export const DURACION_PARTIDO_MINUTOS = {
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

export const DURACION_PARTIDO_FALLBACK = 90;

// Helper:
// estimarDuracionPartido(team) → minutos
//   normaliza team.categoria (lowercase + sin tildes) y busca en la tabla;
//   si no hay match, devuelve DURACION_PARTIDO_FALLBACK
```

## Ayuda pública

`src/content/helpArticles.ts` — artículo nuevo:

- Slug: `convocatorias-de-partido`
- Cubre:
  - Cómo configurar la plantilla del equipo y qué variables existen.
  - Cómo se generan los encabezados liga / playoff / amistoso (regla de la vuelta).
  - Cómo funciona la auto-numeración de jornadas y cuándo override.
  - Cómo añadir pabellones recurrentes.
  - Cómo enviar la convocatoria (Copiar vs Compartir por WhatsApp, qué hace cada uno).
  - Recordatorios en `Pendientes` y la ventana configurable.
  - Cómo pedírselo a Pick por chat.

Actualizar también el artículo de calendario para mencionar el nuevo botón "Mandar convocatoria".

## Tests

### Motor (Vitest, puro)

- Encabezado: liga par-vuelta-1, liga par-vuelta-2, liga impar, playoff BO1, playoff BO3 game 2, amistoso.
- Variables: `{saludo}` por hora del día (mock Date), `{fechaRelativa}` con hoy/mañana/+5d/+10d, `{horaCita}` con offset y con override, `{lugar}` local sin URL, `{lugar}` visitante con URL.
- Variables sin valor → línea elidida.
- Plantilla custom del equipo se respeta sobre el default.

### Auto-numeración

- 4 partidos en una fase → jornadas 1, 2, 3, 4 por fecha.
- Reprogramación → recálculo idempotente.
- Override manual → respetado en recálculos posteriores.
- Partido nuevo en medio → recompacta el resto.

### Pendientes (Vitest)

- `buildConvocatoriaPendientes` con sesión dentro/fuera de ventana, ya enviada, en el pasado, severidad alta vs normal.
- `buildCumpleañosDelDia` con cumple hoy, mañana, miembro sin fecha, miembro de otro equipo, 29-feb en no-bisiesto.

### UI (Vitest + RTL)

- `ConvocatoriaModal` renderiza, edita `notaExtra`, copia, comparte (mock `navigator.share` y `clipboard`).
- `PendingActionsList` con types `convocatoria` y `cumpleaños`.
- `TeamDetailScreen` pestaña Convocatorias guarda plantilla y la rehidrata.
- `SessionFormModal` con liga/jornada/`lugarMapsUrl`.

### Pick (Vitest)

- `mandarConvocatoria` resuelve sessionId real, sessionId de playoff virtual, sessionId inexistente.
- `listarPartidosPendientesConvocatoria` filtra por ventana y severidad.

### Cloud Function `resolveMapsUrl`

- Resuelve shortlink válido.
- Timeout en URL inalcanzable.
- URL no-Maps rechazada.
- Cache hit no llama de nuevo.

## Migración

- **Lectura tolerante indefinida** del campo `session.convocatoria` (mapeado a `jugadoresConvocados` en runtime).
- **Sin migración batch** — el volumen de partidos por usuario no lo justifica.
- **Defaults** de campos nuevos en `team` se aplican en runtime (null → default global) y se persisten al primer guardado de la pestaña Convocatorias.

## Orden de implementación

1. Fundamentos del modelo: subcolección `competitions`, nuevos campos en `team` y `calendarSessions`, lectura tolerante de `convocatoria`.
2. Pestaña `TeamDetailScreen → Competiciones`.
3. `SessionFormModal` upgrade: liga/jornada, `lugarMapsUrl`, `horaFin` oculto, `notaExtra`, `jugadoresConvocados`.
4. Cloud Function `resolveMapsUrl` + integración en form.
5. Motor `convocatoriaTemplate.js` + tests.
6. Pestaña `TeamDetailScreen → Convocatorias` (editor de plantilla).
7. `ConvocatoriaModal` + integración en `SessionDetailModal` + mini-icono en calendario.
8. Sistema de pendientes (`PendingActionsList` extendido + ruta `/pendientes`).
9. Pick tools + `ConvocatoriaBlock` + actualización `promptManager`.
10. Artículo de ayuda + tests E2E del flujo completo.

Cada paso es un PR independiente y mergeable solo. Si la entrega se trunca, lo entregado hasta ese punto es funcional.
