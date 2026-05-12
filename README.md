# Pick&Coach

Copiloto IA para entrenadores de baloncesto. SPA React 19 + Vite + Firebase (Auth, Firestore, Cloud Functions, Hosting) con integración Stripe para B2C (Pro €4,99/mes) y B2B per-seat (Pro Club).

## Quick start

```bash
npm install                              # frontend deps
cd functions && npm install && cd ..     # backend deps
npm run dev                              # vite dev server (apunta a Firebase prod)
```

Cuidado con writes en dev: el frontend apunta al backend de producción. No hay emulador configurado para el flujo principal.

## Comandos

| Tarea            | Comando                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| Dev server       | `npm run dev`                                                          |
| Build prod       | `npm run build` (vite + prerender + sitemap)                           |
| Lint             | `npm run lint`                                                         |
| Format           | `npm run format` / `npm run format:check`                              |
| Tests frontend   | `npm test` (vitest, single run)                                        |
| Tests rules      | `npm run test:rules` (firebase emulator + vitest)                      |
| Tests functions  | `cd functions && npm test`                                             |
| Deploy hosting   | `npm run deploy`                                                       |
| Deploy functions | `npx firebase deploy --only functions --project playoff-creator`       |
| Deploy rules     | `npx firebase deploy --only firestore:rules --project playoff-creator` |

## Arquitectura

Ver `CLAUDE.md` para guía completa (data model post-workspace migration, provider stack, AI agent tools, billing, historia de los 8 sub-proyectos shipped).

Resumen:

- **Frontend**: React 19 + Vite 8 + Tailwind 3 + react-router-dom v7. Mayoritariamente JSX; TS estratégico en `src/billing/`, `src/components/pick/`, `src/services/aiClient.ts`.
- **Backend**: Cloud Functions v2 (TS) en `europe-west1`. Callables auth-gated + onSchedule + Firestore triggers (`onMemberDelete`, `onTeamCreate/Delete`, `onUserCreate/Delete`). Stripe webhook idempotente vía `stripeEvents/{eventId}` marker.
- **Datos**: `artifacts/{appId}/workspaces/{wsId}/...` modelo workspace-as-entity (sub-proyecto 1). Personal y club bajo el mismo schema, diferenciados por `type`.
- **AI agent (Pick)**: orchestrator con tool registry (read/write/agent/memory/navigation/knowledge/userContext). Modelo Gemini con fallback OpenRouter. Observabilidad Langfuse.
- **Billing**: Stripe Test Mode operativo. B2C €4,99/mes o €49/año; B2B per-seat placeholder €3,99. Display strings en `src/billing/displayPrices.js` (sincronizar manualmente con Stripe Dashboard).

## Producción

Hosting live en `https://playoff-creator.web.app` (auto-deploy desde main vía GitHub Actions). Cloud Functions + rules requieren deploy manual hasta que la SA tenga los roles IAM correctos.

## Pre-deploy / pre-launch steps pendientes (acción del usuario)

Documentados en `docs/runbooks/`:

1. Crear bucket `gs://playoff-creator-firestore-backups` para backups diarios automatizados.
2. Grant a la SA `FIREBASE_SERVICE_ACCOUNT`: Cloud Functions Developer + Service Account User + Service Usage Consumer + Cloud Datastore Owner.
3. (Comercial) Crear Stripe Product "Pro Club" + Price per-seat real. Sincronizar `STRIPE_PRICE_B2B_PER_SEAT` secret + GitHub `VITE_STRIPE_PRICE_B2B_PER_SEAT` + `src/billing/displayPrices.js`.
4. (Comercial) Switch Stripe a Live Mode: rotar 4 firebase secrets + 3 GitHub secrets (ver `docs/runbooks/sub-proyecto-5-smoke.md`).
5. (Comercial) Decidir abrir allowlist de `createClub` (hoy en super-admin only).
6. **Operativo**: ejecutar `node scripts/cleanupOldPaths.js` el 2026-05-24 para borrar los datos legacy `users/{uid}/...` tras soak limpio del cutover sub-1.

## Convenciones

- Path helpers obligatorios: `workspaceDocRef` / `workspaceColRef` (frontend) y equivalentes (functions). Nunca paths raw.
- Hooks de datos scope-aware (`'all'` owner, `'assigned'` coach). Esperar `activeMember` antes de subscribir si no eres owner.
- Servicios como capa intermedia: hooks → services → SDK Firestore. Sin SDK directo en componentes.
- A11y target: funcional (no WCAG formal). Respetar `prefers-reduced-motion`, mantener landmarks y `aria-label` en botones-icono.
- Tests vitest (no Jest). `expectNoA11yViolations` disponible para componentes interactivos.

## Licencia

Privada. Todos los derechos reservados.
