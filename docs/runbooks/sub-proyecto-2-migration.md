# Sub-proyecto 2 — Migration runbook

## Ejecución 2026-05-04 (PR #1 deployed)

PR #1 (commit `55c6694`) desplegó `migrateToSubproyecto2` y `verifySubproyecto2Migration` en europe-west1. La ejecución se hizo localmente con Admin SDK (service account · bypassea la onCall layer) usando un script one-shot equivalente. Resultado idéntico al deployed callable.

### Run 1 — backfill createdBy

```
workspacesProcessed:   36
membershipsBackfilled:  0  ← sub-1 ya pobló role + assignedTeamIds
docsBackfilled:       490
durationMs:         38854
```

### Run 2 — normalize 'owner' → 'dt'

Tras Run 1 se descubrió que sub-1 había puesto `role: 'owner'` en las memberships personales. Esto chocaba con la taxonomía sub-2 (donde 'owner' es propiedad del workspace, NO valor de membership.role). Se actualizó la lógica de migración para tratar `role === 'owner'` como `undefined` y normalizar a `'dt'`. Re-run:

```
workspacesProcessed:   36
membershipsBackfilled: 36  ← todas convertidas owner → dt
docsBackfilled:         0  ← Run 1 ya las cubrió
durationMs:         12096
```

### Verificación post-migración (final)

```
membershipsMissingRole:            0  ← ahora "missing" significa role ∉ {dt, coach}
membershipsMissingAssignedTeamIds: 0
docsMissingCreatedBy:              0
ok:                             true
```

**Lectura final:** todas las 36 memberships personales tienen `role: 'dt'` + `assignedTeamIds` populated (vacío en personal workspaces, cubierto por bypass `isPersonalWorkspaceOwner`). 490 docs (ejercicios + brackets + calendar sessions + trainings + jugadores) firmados con `createdBy = workspace.ownerId`. Cuaderno no se toca (singleton state).

## Próximos pasos

- [ ] PR #2 — desplegar `firestore.rules` rewriteado con la matriz de permisos sub-2.
- [ ] Soak 1-2 semanas. Monitorizar errores `PERMISSION_DENIED` en Cloud Logging por encima de baseline.
- [ ] PR #3 (cleanup) — eliminar `migrateToSubproyecto2`/`verifySubproyecto2Migration` y este runbook tras soak limpio.

## Re-run plan

Si necesitas re-correr la migración (debería ser innecesario: idempotente), opciones:

1. **Vía Cloud Console UI** (Firebase Console → Functions → migrateToSubproyecto2 → Test, autenticado con `serpa2003@gmail.com`).
2. **Vía Admin SDK local** con service account JSON en `GOOGLE_APPLICATION_CREDENTIALS`. El script driver vive transitoriamente en `scripts/runSub2Migration.mjs` durante la ejecución (no se commitea).

`verifySubproyecto2Migration` puede correrse las veces que haga falta para chequear estado actual.
