# Fase 1 — Web pública de Pick&Coach (landing + centro de ayuda)

**Fecha:** 2026-04-25
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Sucesora:** Fase 2 — CMS (spec separada, no incluida aquí)

---

## 1. Contexto, alcance y no-alcance

### Qué construimos

- Landing pública one-pager en `/` con SEO y CTA a registro.
- Centro de ayuda público en `/ayuda` (índice con buscador client-side) y `/ayuda/:slug` (detalle por artículo).
- Una **única fuente de verdad de contenido** que alimenta tanto la ayuda pública como la knowledge base del agente IA. Sin divergencia posible entre lo que el agente sabe y lo que el usuario puede consultar públicamente.
- Rename completo del producto a **Pick&Coach** (sustituye "Urocoach", "FBM Brackets" y "CoachApp"). El asistente IA se renombra de "Copilot/Copiloto" a **Pick** — narrativamente: _Pick_ es la IA y _Coach_ eres tú.
- Restructuración de rutas: app autenticada bajo `/area-privada/*`, con redirects de rutas antiguas para no romper bookmarks.
- Pipeline de static prerender en build-time para SEO (HTML indexable por ruta pública).

### Qué NO entra en Fase 1

- CMS (admin UI para editar contenido desde el navegador) — Fase 2, spec propia.
- Modelo de precios / pricing page — aún no definido.
- Páginas tipo `/funcionalidades`, `/precios`, `/blog`, `/demo` — solo one-pager.
- Internacionalización — solo español.
- URLs de categoría (`/ayuda/categoria/:cat`) — el schema y breadcrumb se preparan para soportarlo en el futuro (cambio aditivo), pero no se implementan.
- Búsqueda semántica server-side en la ayuda — el buscador es client-side con upgrade path documentado.
- og:images dinámicas por artículo (queda con una imagen genérica).
- Términos de servicio / política de privacidad — añadir cuando legalmente aplique.
- Analytics — decisión separada cuando haya tráfico.

### Principios de diseño

1. **Determinismo en build**: el HTML prerenderizado no depende de red (contenido desde archivo TS versionado en Fase 1).
2. **Aditividad futura**: añadir página de categoría, migrar a Firestore (CMS), o añadir más rutas públicas no requiere refactor del código ya escrito.
3. **Una sola fuente para todo contenido editorial** (humano y agente IA).

---

## 2. Estructura de URLs y routing

### Mapa completo de rutas

| Ruta                                                                                                                                      | Acceso    | Componente                         | Notas                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/`                                                                                                                                       | Público   | `LandingScreen` (nuevo)            | One-pager. Prerenderizado. Visible para usuarios logueados y anónimos (CTA cambia según auth). |
| `/ayuda`                                                                                                                                  | Público   | `HelpIndexScreen` (nuevo)          | Lista de artículos por categoría + buscador. Prerenderizado.                                   |
| `/ayuda/:slug`                                                                                                                            | Público   | `HelpArticleScreen` (nuevo)        | Detalle del artículo. Una ruta prerenderizada por artículo.                                    |
| `/login`                                                                                                                                  | Público   | `LoginScreen` (existente)          | Sin cambios funcionales, solo rename de branding.                                              |
| `/s/:code`                                                                                                                                | Público   | `ShareRedirect` (existente)        | Redirige a `/area-privada/playoffs?share=...`.                                                 |
| `/exercise/:shareCode`                                                                                                                    | Público   | `SharedExerciseScreen` (existente) | Sin cambios.                                                                                   |
| `/area-privada`                                                                                                                           | Protegido | `HomeScreen` (movido desde `/`)    | Dashboard autenticado.                                                                         |
| `/area-privada/teams`, `/area-privada/teams/:teamId`, `/area-privada/teams/:teamId/cuaderno/*`, `/area-privada/teams/:teamId/trainings/*` | Protegido | Pantallas existentes               | Solo cambia el prefijo.                                                                        |
| `/area-privada/playoffs`                                                                                                                  | Protegido | `PlayoffCreatorModule`             |                                                                                                |
| `/area-privada/exercises`                                                                                                                 | Protegido | `ExerciseLibraryScreen`            |                                                                                                |
| `/area-privada/calendar`, `/area-privada/calendar/:sessionId/{planilla,scouting,analysis}`                                                | Protegido | Pantallas existentes               |                                                                                                |
| `/area-privada/settings`                                                                                                                  | Protegido | `SettingsScreen`                   |                                                                                                |

### Guardas y redirects

- **`AuthGuard`**: aplicado a `/area-privada/*`. Si no hay usuario autenticado → `/login?redirect=/area-privada/...` (preserva intent).
- **`/login` con usuario activo**: redirige a `/area-privada` (antes iba a `/`).
- **Deep-links antiguos**: nuevo componente `LegacyPathRedirect` en el router, antes del catch-all:
  - `/teams*` → `/area-privada/teams*`
  - `/playoffs` → `/area-privada/playoffs`
  - `/calendar*` → `/area-privada/calendar*`
  - `/settings` → `/area-privada/settings`
  - `/exercises*` → `/area-privada/exercises*`
- **Logout**: redirige a `/` (landing pública).
- **Catch-all `*`**: redirige a `/`.

### Impacto en el agente IA (navigation tool)

`functions/src/shared/appRouteCatalog.ts` es el único sitio donde el agente conoce los paths. Todos los path builders (`home()`, `teams()`, `teamDetail(id)`, etc.) añaden el prefijo `/area-privada`. Los **target ids no cambian** (`home`, `teams`, `team_detail`, …) — solo cambia el path que devuelven. El contrato del tool `suggest_navigation` para el LLM es idéntico. Test `appRouteCatalog.test.ts` actualizado para reflejar nuevos paths.

### Impacto en código existente

- ~30 llamadas hardcoded a `navigate('/teams')`, `navigate('/calendar')`, etc. → actualizadas.
- `CoachesNav.jsx`, `DesktopSidebar.jsx` — mismos reemplazos.
- `AppShell.jsx` — el check `isLogin = location.pathname === '/login'` se amplía a una función `isPublicPath()` que cubre `/`, `/ayuda`, `/ayuda/*`, `/login`. Estos paths no muestran sidebar ni bottom nav.
- Detección de auth en `LandingScreen` para cambiar CTA principal:
  - Anónimo: "Empezar gratis" → `/login`
  - Autenticado: "Ir a tu área privada" → `/area-privada` (+ pequeño badge "Sesión activa como {email}")

---

## 3. Modelo de contenido (single source of truth)

### Ubicación

`src/content/helpArticles.ts` — en el paquete de la web. El indexer de embeddings (`functions/scripts/indexKnowledge.ts`) importa desde ahí con path relativo. En Fase 2 (CMS), la fuente migrará a Firestore.

### Schema

```ts
// src/content/helpArticles.ts

export type HelpCategory = 'app-usage' | 'competition-rules' | 'bracket-engine' | 'basketball-concepts';

export interface HelpArticle {
  id: string; // identificador interno estable (p.ej. "app-create-team")
  // sirve también como Firestore doc id en el índice del agente
  slug: string; // URL-facing, SEO-friendly en español (p.ej. "como-crear-equipo")
  category: HelpCategory;
  title: string; // mostrado en listas y en <title>
  summary: string; // 1-2 frases (120-160 chars). Alimenta: <meta description>,
  // tarjetas del índice, y preview del agente
  body: string; // Markdown. Renderizado en página de detalle y embebido para
  // búsqueda semántica del agente
  tags?: string[]; // opcional — boost en buscador client-side
  order?: number; // opcional — orden dentro de la categoría
  updatedAt: string; // ISO date — mostrado como "Última actualización: 25 abr 2026"
}

export const HELP_ARTICLES: HelpArticle[] = [
  /* ... migrado y curado */
];

export const HELP_CATEGORIES: Record<
  HelpCategory,
  {
    label: string;
    description: string;
    order: number;
  }
> = {
  'app-usage': { label: 'Guías de uso', description: 'Cómo usar Pick&Coach paso a paso', order: 1 },
  'competition-rules': { label: 'Reglas y formatos', description: 'Formatos de competición y series', order: 2 },
  'bracket-engine': { label: 'Motor de cuadros', description: 'Cómo funcionan los cuadros de playoffs', order: 3 },
  'basketball-concepts': {
    label: 'Conceptos de baloncesto',
    description: 'Fundamentos, posiciones y sistemas',
    order: 4,
  },
};
```

### Decisiones clave

- **`id` separado del `slug`**: `id` es estable internamente (referenciado por Firestore `knowledgeBase/{id}`); `slug` es la URL SEO-friendly. Se puede mejorar el slug sin romper el índice de embeddings.
- **`summary` obligatorio**: sirve 3 propósitos a la vez (meta description, cards del índice, preview); tener que escribirlo conscientemente mejora calidad.
- **`body` en Markdown**, renderizado con `react-markdown`. Embedding IA trata markdown sin problema.
- **Sin campo `publicInAgent`**: por el principio "ayuda pública = fuente del agente", todo artículo es ambas cosas. No hay flags.
- **Sin campo `status`** en Fase 1: todo lo que está en el array está publicado. Se añade en Fase 2 (CMS).

### Migración del contenido actual

Paso explícito del plan:

1. **Mapeo 1:1**: las 26 entradas de `KnowledgeEntry` → `HelpArticle`. Hay que rellenar `slug`, `summary`, `tags?`, `updatedAt`, y convertir `content` → `body` en markdown.
2. **Curación**: revisar cada entrada contra el filtro "¿es esto universalmente cierto y publicable?". Particularmente `competition-rules` tiene entradas redactadas como universales que no lo son — requerirán reescritura o eliminación.
3. **Checkpoint con el usuario**: se le pasa la lista propuesta (qué se queda intacto, qué se reescribe, qué se quita, con justificación). El usuario aprueba antes del commit.

### Impacto en el indexer y en el agente

- `functions/scripts/indexKnowledge.ts`: cambia el import path; el doc Firestore que escribe pasa a tener los nuevos campos (`slug`, `summary`, `body` en vez de `content`); el embedding se calcula sobre `title + \n\n + summary + \n\n + body` (mejora recall).
- `functions/src/ai/tools/knowledgeTools.ts`: el tool sigue funcionando; el resultado al LLM incluye ahora `summary` además del `body`.
- Una vez hecha la migración, **`functions/src/ai/knowledge/index.ts` se elimina**.

---

## 4. Landing one-pager (`/`)

### Comportamiento según autenticación

- **Anónimo**: CTA principal = "Empezar gratis" → `/login`. Secundario = "Ver centro de ayuda" → `/ayuda`.
- **Autenticado**: CTA principal = "Ir a tu área privada" → `/area-privada`. Secundario = "Ver centro de ayuda" → `/ayuda`. Badge "Sesión activa como {email}".

### Mensaje y tono

- Lidera con **Pick (el copiloto IA)** como diferenciador (alineado con la prioridad estratégica declarada del proyecto).
- Tono: profesional-cercano, concreto, técnico lo justo. Para entrenadores en España (español peninsular).

### Estructura (de arriba a abajo)

1. **Hero** (~85% viewport en desktop):
   - H1: _"Tu copiloto IA para entrenar baloncesto"_ (copy a afinar).
   - Subtítulo: _"Playoffs, entrenamientos, calendario y scouting. Todo en un sitio, con un copiloto IA que hace el trabajo contigo."_ (~140-160 chars, reutilizable como meta description).
   - CTAs duales (principal + secundario, según auth).
   - Visual a la derecha: **placeholder en MVP** de captura del copilot en acción. El usuario aporta la captura final.

2. **Para quién es** — tira corta (~60 palabras): entrenadores de baloncesto federado (minibasket → sénior), con una línea sobre clubes futuros: _"Pensado para entrenadores individuales. Pronto, también para clubes."_

3. **Funcionalidades clave** — grid de 6 cards (icono `lucide-react` + título + 2-3 líneas):
   - 🤖 **Pick, tu copiloto IA**
   - 🏆 **Cuadros de playoffs con IA**
   - 📅 **Calendario y entrenamientos**
   - 📒 **Cuaderno del entrenador**
   - 📚 **Biblioteca de ejercicios**
   - 🔍 **Scouting y análisis**

   Sin screenshots por tarjeta en MVP — solo iconos + tipografía + color.

4. **Cómo funciona** — 3 pasos: _"1. Crea tu cuenta. 2. Añade tu equipo. 3. Deja que Pick te ayude con el resto."_

5. **Centro de ayuda destacado** — 4-6 artículos seleccionados de `HELP_ARTICLES` (probablemente los de `app-usage` más representativos). Cards con título + summary, cada una linkando a `/ayuda/:slug`. Enlace final _"Ver todos los artículos →"_ a `/ayuda`. Refuerza SEO interno y da preview de profundidad.
   - **Implementación**: lista de slugs destacados hardcoded (p. ej. `FEATURED_HELP_SLUGS = ['como-crear-equipo', 'como-generar-entrenamiento', ...]`) en el componente `LandingScreen`. Importa `HELP_ARTICLES` y filtra. Vite tree-shake/chunking gestiona la duplicación. Si el tamaño impacta el bundle de la landing, se puede mover a un módulo derivado en F1.4.

6. **CTA final** — banda horizontal con mensaje directo + CTA repetido.

7. **Footer** (mínimo viable): logo Pick&Coach, links a `/ayuda` y `/login`, © 2026 Pick&Coach. **Sin** términos de servicio ni privacidad por ahora.

### SEO técnico

- `<title>`: _"Pick&Coach — Copiloto IA para entrenadores de baloncesto"_ (~60 chars).
- `<meta name="description">`: reutiliza el subtítulo del hero.
- `<meta property="og:*">` completos (og:title, og:description, og:image, og:url, og:type=website).
- `<meta name="twitter:card" content="summary_large_image">`.
- `<link rel="canonical">`.
- **og:image**: card 1200×630 con logo y tagline. Asset estático en `public/og-image.png`.
- JSON-LD `WebSite` o `SoftwareApplication`.

### Notas

- La landing **no muestra anonymous login** como opción visible; ya existe "Continuar como invitado" dentro de `/login` para quien lo busque.

---

## 5. Centro de ayuda (`/ayuda` y `/ayuda/:slug`)

### `/ayuda` — Index

**Layout:**

- Header con título _"Centro de ayuda"_, subtítulo, y **buscador prominente** (autofocus en desktop, siempre visible).
- **Sin query**: artículos agrupados por categoría usando `HELP_CATEGORIES`. Cada categoría = sección con label, descripción, y grid de cards de artículo (título + summary). Categorías ordenadas por `HELP_CATEGORIES[cat].order`. Artículos dentro de categoría por `article.order` (si existe) o alfabético.
- **Con query (≥2 chars)**: lista plana de resultados ordenados por relevancia. Sin resultados → mensaje claro con link al índice.

**Buscador (client-side, upgradeable):**

- `HELP_ARTICLES` se bundlea entero en el chunk lazy de `/ayuda/*` (los `body` markdown son necesarios para renderizar la página de detalle, así que ya están ahí). Tamaño estimado tras bundle: <200KB con 26 artículos. El buscador opera sobre el array en memoria; el algoritmo scorea solo `{title, summary, tags?}`, no escanea `body` (más rápido y suficiente para el caso de uso).
- Algoritmo: scoring manual ~30 líneas. Match en `title` > `summary` > `tags`. Normalización diacríticos + lowercase. Debounced 150ms. Sin librería externa para MVP.
- **Diseñado para upgrade**: el componente `HelpSearch` recibe la función de búsqueda como prop (`onSearch: (query) => Promise<Result[]>`). En MVP es client-side síncrona. Cuando se quiera búsqueda semántica, se sustituye por una Cloud Function que envuelve el tool `search_knowledge_base` existente. Cero cambios en UI.
- URL state: query persistida como `?q=...`.

### `/ayuda/:slug` — Detalle

**Layout:**

- **Breadcrumb**: `Centro de ayuda > {Categoría label} > {Título}`. La categoría no es link en MVP; cuando se añada `/ayuda/categoria/:cat` se hace clickable (cambio aditivo).
- **Header**: título (H1), categoría como pill, fecha _"Última actualización: ..."_ desde `updatedAt`.
- **Cuerpo**: render Markdown con `react-markdown`. Estilos consistentes con resto del producto. Links externos en nueva pestaña.
- **Pie**: módulo _"Otros artículos de esta categoría"_ — 3-4 relacionados. Aumenta dwell time y SEO interlinking.
- **CTA final**: card destacada _"¿Aún tienes preguntas? Pregúntale a Pick desde tu cuenta."_ → `/area-privada` (auth) o `/login` (no auth). Convierte tráfico de ayuda en uso del producto.

### SEO por artículo

- `<title>`: `"{title} — Ayuda de Pick&Coach"`.
- `<meta name="description">`: el `summary` literal.
- `<meta property="og:*">` (og:type=article).
- `<link rel="canonical">`.
- JSON-LD `Article` con `headline`, `dateModified`, `author` (organización Pick&Coach). Desbloquea rich snippets en Google.

### "Diseñado para C" — qué queda preparado

1. **Página de categoría** `/ayuda/categoria/:cat`: añadir ruta + path al prerender + clickable breadcrumb + link "Ver todos" en índice. Reusa los mismos componentes de card.
2. **Migración a Firestore**: `useHelpArticles()` hook que en MVP devuelve `HELP_ARTICLES` desde el bundle se sustituye por versión que lee Firestore. Los componentes consumidores no cambian.
3. **Búsqueda semántica**: sustituir prop `onSearch` por llamada a Cloud Function envolviendo `search_knowledge_base`.

---

## 6. SEO architecture y pipeline de prerender

### Qué se prerenderiza vs qué queda SPA

**Prerenderizadas en build-time:**

- `/`
- `/ayuda`
- `/ayuda/:slug` — una por cada artículo (~20-26 después de curación)

**Quedan SPA puras:**

- `/login`
- `/area-privada/*`
- `/s/:code`, `/exercise/:shareCode`

### Solución elegida: `vite-react-ssg`

Después de evaluar opciones (custom scripts, vike, react-snap, vite-react-ssg), se elige **`vite-react-ssg`** como solución estándar de mercado:

- Diseñada específicamente para React + React Router 6/7.
- Integra prerender + sitemap + meta tags en el mismo plugin.
- No impone reestructurar el routing.
- Mantenimiento activo en el ecosistema React + Vite.

**Spike de validación**: 0.5 día al inicio de F1.3 para validar que se integra sin fricciones con la setup actual (lazy routes, contexts, etc.). Si bloquea: caer a scripts custom (decisión reversible).

### Dependencias nuevas

- `vite-react-ssg` — SSG plugin
- `react-helmet-async` — gestión de `<head>` por ruta (~6KB gzipped)
- `react-markdown` — render de Markdown (~30KB gzipped)
- **No** se añaden Puppeteer/playwright (peso y lentitud).

### Manejo del `<head>`

- `<HelmetProvider>` envolviendo la app.
- Cada componente de página (`LandingScreen`, `HelpIndexScreen`, `HelpArticleScreen`) declara su `<Helmet>`. El SSG los recoge y los inyecta en el HTML estático.
- Hydration en cliente: helmet-async sincroniza correctamente entre SSR y cliente.

### Open Graph image (estrategia MVP)

- **Una sola og:image genérica para Fase 1**: imagen 1200×630 en `public/og-image.png` con logo y tagline. Sirve para `/`, `/ayuda` y todos los `/ayuda/:slug`.
- og:images dinámicas por artículo: queda fuera de scope MVP.

### Sitemap y robots

`sitemap.xml` generado por `vite-react-ssg` con `<lastmod>` desde `updatedAt` de cada artículo.

`robots.txt`:

```
User-agent: *
Allow: /
Allow: /ayuda
Allow: /ayuda/
Disallow: /login
Disallow: /area-privada
Disallow: /s/
Disallow: /exercise/
Sitemap: https://{dominio}/sitemap.xml
```

### Cache y headers de Firebase Hosting

Modificación a `firebase.json`:

```jsonc
"hosting": {
  "headers": [
    { "source": "**/*.html", "headers": [{ "key": "Cache-Control", "value": "public, max-age=300, s-maxage=600" }] },
    { "source": "**/*.@(js|css|webp|png|jpg|svg|woff2)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ],
  "rewrites": [
    { "source": "/area-privada/**", "destination": "/index.html" },
    { "source": "/login", "destination": "/index.html" },
    { "source": "/s/**", "destination": "/index.html" },
    { "source": "/exercise/**", "destination": "/index.html" }
  ]
}
```

El catch-all `**` → `/index.html` se sustituye por rewrites específicos para rutas SPA. Esto permite que Firebase sirva los HTML prerenderizados cuando existen y solo caiga al SPA fallback en rutas dinámicas. Los `Cross-Origin-*` headers existentes se mantienen.

### Verificación post-deploy

1. `curl` a cada ruta prerenderizada, verificar que devuelve HTML con contenido (no `<div id="root"></div>` vacío).
2. Verificar share cards en debug.twitter.com, debug.facebook.com, opengraph.xyz.
3. Google Rich Results Test del JSON-LD `Article`.
4. Submit del sitemap.xml a Google Search Console.

---

## 7. Renombrado, orden de implementación y riesgos

### A) Sweep completo de renombrado a Pick&Coach + Pick

| Lugar                                                                                                                                               | Antes                           | Después                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `index.html` `<title>`                                                                                                                              | `Urocoach`                      | `Pick&Coach`                                         |
| `src/screens/LoginScreen.jsx` H1                                                                                                                    | `FBM Brackets`                  | `Pick&Coach`                                         |
| `src/hooks/useSettings.js` (backup filename)                                                                                                        | `urocoach-backup-...`           | `pickandcoach-backup-...`                            |
| `src/hooks/useSettings.js` (error msg)                                                                                                              | `...desde Urocoach.`            | `...desde Pick&Coach.`                               |
| `src/components/settings/SettingsSections.jsx`                                                                                                      | `backup .json de Urocoach`      | `backup .json de Pick&Coach`                         |
| `functions/src/ai/promptManager.ts` (3 ocurrencias)                                                                                                 | `CoachApp`                      | `Pick&Coach`                                         |
| `functions/src/ai/knowledge/index.ts` (4 ocurrencias)                                                                                               | `CoachApp`                      | `Pick&Coach` (durante migración a `helpArticles.ts`) |
| `functions/src/ai/tools/navigationTools.ts` description                                                                                             | `CoachApp`                      | `Pick&Coach`                                         |
| `docs/copilot/*.md`                                                                                                                                 | `CoachApp`                      | `Pick&Coach`                                         |
| `functions/scripts/indexKnowledge.ts` log                                                                                                           | `🏀 CoachApp Knowledge Base`    | `🏀 Pick&Coach Help Indexer`                         |
| Componentes: `CopilotPanel`, `CopilotRoot`, `CopilotCompact`, `CopilotFeedback`, `CopilotProvider`, `useCopilotTips`, carpeta `components/copilot/` | `Copilot*` / `copilot`          | `Pick*` / `pick`                                     |
| `src/contexts/CopilotProvider.tsx` exports                                                                                                          | `CopilotProvider`, `useCopilot` | `PickProvider`, `usePick`                            |
| Strings UI con "Copiloto" / "Copilot"                                                                                                               | varios                          | `Pick`                                               |
| Prompt del agente IA: cómo se identifica                                                                                                            | _"Eres el copilot IA…"_         | _"Eres Pick, el asistente IA de Pick&Coach…"_        |
| Logo / favicon (asset)                                                                                                                              | a revisar                       | actualizar si referencia visual a un nombre          |

**Tarea de descubrimiento**: antes del sweep, grep exhaustivo (`Urocoach|FBM Brackets|CoachApp|Copilot|copilot|fbm|urocoach`) para asegurar 100% de cobertura. Cualquier hit no listado se añade antes del commit.

### B) Orden de implementación — 6 fases

Cada fase termina en un estado **deployable y verificable**. El orden minimiza riesgo (estructurales primero, contenido después).

1. **F1.0 — Sweep de renombrado** _(1-2 días)_
   - Toda la tabla A) en un solo commit/PR.
   - Cero cambio funcional. Build, lint, tests pasan.
   - Razón de ir primero: código nuevo de fases siguientes ya nace con nomenclatura correcta.

2. **F1.1 — Routing refactor a `/area-privada`** _(1-2 días)_
   - `AppRouter.jsx` reorganizado bajo `/area-privada`.
   - `LegacyPathRedirect` añadido.
   - `appRouteCatalog.ts` actualizado + tests.
   - ~30 reemplazos de `navigate('/...')` hardcoded.
   - Login/logout redirects actualizados.
   - Razón antes que landing: el CTA "Ir a tu área privada" depende de esta ruta existir.

3. **F1.2 — Migración de contenido + checkpoint de curación** _(2-3 días + revisión usuario)_
   - Crear `src/content/helpArticles.ts` con nuevo schema.
   - Migrar las 26 entradas con `id`, `slug`, `summary`, `body` (markdown), `tags?`, `updatedAt`.
   - **Checkpoint con el usuario**: lista propuesta de curación (qué se queda, reescribe, quita) con justificación. Usuario aprueba antes de commit.
   - Aplicar curación, eliminar `functions/src/ai/knowledge/index.ts`, actualizar `indexKnowledge.ts`.
   - Re-indexar Firestore.
   - Verificación: `search_knowledge_base` sigue devolviendo resultados sensatos.

4. **F1.3 — Pipeline de prerender + SEO infra** _(1-2 días)_
   - Spike inicial 0.5 día para validar `vite-react-ssg`.
   - Instalar `vite-react-ssg`, `react-helmet-async`, `react-markdown`.
   - Lista de rutas a prerenderizar enumerada desde `HELP_ARTICLES`.
   - Generar `sitemap.xml` y `robots.txt` en build.
   - Modificar `firebase.json` (rewrites específicos).
   - Páginas con placeholders simples para validar pipeline.
   - Verificación: build local genera HTMLs correctos. Deploy a entorno de pruebas.

5. **F1.4 — Landing one-pager** _(2-3 días)_
   - `LandingScreen` con todas las secciones.
   - Detección de auth para CTA del hero.
   - `<Helmet>` con meta tags + JSON-LD.
   - Asset placeholder del hero.
   - Asset `public/og-image.png` genérico.
   - Verificación: Lighthouse ≥90 en performance + SEO. Share cards.

6. **F1.5 — Centro de ayuda** _(2-3 días)_
   - `HelpIndexScreen` con render por categorías + buscador client-side.
   - `HelpArticleScreen` con Markdown + breadcrumb + relacionados + CTA final.
   - JSON-LD `Article` por artículo.
   - Cross-linking entre relacionados.
   - Verificación: cada `/ayuda/:slug` prerenderizado con contenido completo.

7. **F1.6 — Verificación post-deploy + Search Console** _(0.5 día)_
   - Submit sitemap a Google Search Console.
   - Verificar share cards con herramientas externas.
   - Rich Results Test.
   - (Opcional, fuera de scope decisión final) GA4 / Plausible.

**Total estimado**: 9-15 días de trabajo enfocado. Realista con interrupciones: 3-4 semanas calendario.

### C) Estrategia de testing

- **F1.0**: tests existentes deben seguir pasando. Cero tests nuevos.
- **F1.1**: tests nuevos para `LegacyPathRedirect`. Test del catálogo `appRouteCatalog` actualizado. Verificación manual del navigation tool del agente IA.
- **F1.2**: test de validación del array `HELP_ARTICLES` (campos requeridos, slugs únicos, ids únicos, slugs URL-safe). Indexer corre sin errores tras curación.
- **F1.3**: smoke test que verifica que `npm run build` produce los HTML esperados con contenido no vacío.
- **F1.4 + F1.5**: tests de componentes para `HelpIndexScreen` (búsqueda funciona) y `HelpArticleScreen` (markdown renderiza). Landing: smoke test (renderiza sin crashear, CTA correcto según auth). Tests visuales/E2E fuera de scope MVP.

### D) Riesgos conocidos y mitigación

| Riesgo                                                                         | Probabilidad | Impacto | Mitigación                                                                                                                |
| ------------------------------------------------------------------------------ | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `vite-react-ssg` tiene fricciones con la setup actual (lazy routes, contexts)  | Media        | Medio   | Spike de 0.5 día al inicio de F1.3. Si bloquea: caer a scripts custom.                                                    |
| Curación del contenido revela que muchas entradas no son publicables tal cual  | Alta         | Bajo    | Esperado y planificado — checkpoint con usuario absorbe esto.                                                             |
| El sweep de renombrado rompe algo no detectado por tests                       | Media        | Bajo    | Grep exhaustivo + manual smoke test antes de merge.                                                                       |
| Cambios en routing rompen flujos del agente IA                                 | Media        | Alto    | Catálogo central + tests + verificación manual de "pídele a Pick que te lleve a {sitio}".                                 |
| El `&` en "Pick&Coach" causa problemas de escaping (HTML, URL params, JSON-LD) | Baja         | Bajo    | Auditoría específica al final del sweep — verificar cada uso (`&amp;` en HTML, sin escape en text/JSON, no usar en URLs). |
| Captura de screenshot del copilot para hero requiere datos seed inexistentes   | Baja         | Bajo    | Placeholder en MVP; usuario genera screenshot final cuando pueda.                                                         |
| Google tarda en indexar nuevas URLs                                            | Alta         | Bajo    | Inevitable. Submit sitemap acelera. Esperable: 2-4 semanas.                                                               |

### E) Lo que queda EXPLÍCITAMENTE fuera de Fase 1 (recap)

- CMS / admin UI para editar contenido — Fase 2, spec propia.
- Pricing page / modelo de pago.
- Páginas `/funcionalidades`, `/precios`, `/blog`, `/demo`, `/casos-de-éxito`.
- og:images dinámicas por artículo.
- Búsqueda semántica en `/ayuda`.
- Internacionalización.
- Términos de servicio / política de privacidad.
- Analytics.
- Páginas de categoría `/ayuda/categoria/:cat`.

---

## Anexo — Decisión sobre el dominio

`Pick&Coach` contiene `&`, que **no puede ir en URLs**. Cuando se registre dominio habrá que decidir entre:

- `pickandcoach.com`
- `pickncoach.com`
- `pick-and-coach.com`

Para el MVP se usa el subdomain por defecto de Firebase Hosting. La decisión de dominio canónico queda fuera del scope de esta spec.
