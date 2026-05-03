# Sub-proyecto 2 — Migration runbook

## Ejecución 2026-05-04 (PR #1 deployed)

PR #1 (commit `55c6694`) desplegó `migrateToSubproyecto2` y `verifySubproyecto2Migration` en europe-west1. La ejecución se hizo localmente con Admin SDK (service account · bypassea la onCall layer) usando un script one-shot equivalente. El resultado es idéntico al deployed callable.

**Resultado de la migración:**

```
workspacesProcessed:   36
membershipsBackfilled:  0
docsBackfilled:       490
durationMs:         38854
```

**Verificación post-migración:**

```
membershipsMissingRole:           0
membershipsMissingAssignedTeamIds: 0
docsMissingCreatedBy:              0
ok:                             true
```

**Lectura:** `membershipsBackfilled = 0` indica que sub-1 (`bootstrapPersonalWorkspace` Cloud Function trigger) ya estaba poblando `role: 'dt'` y `assignedTeamIds` desde la creación del workspace personal. Los 490 docs backfilleados son de colecciones de items (ejercicios, brackets, calendarSessions, trainings, jugadores) que sub-1 dejó sin `createdBy` y que ahora pasan a estar firmados como `createdBy = workspace.ownerId`. Cuaderno docs no se tocan (singleton state, sin createdBy semantic).

## Próximos pasos

- [ ] PR #2 — desplegar `firestore.rules` rewriteado con la matriz de permisos sub-2.
- [ ] Soak 1-2 semanas. Monitorizar errores `PERMISSION_DENIED` en Cloud Logging por encima de baseline.
- [ ] PR #3 (cleanup) — eliminar `migrateToSubproyecto2`/`verifySubproyecto2Migration` y este runbook tras soak limpio.

## Re-run plan

Si necesitas re-correr la migración (debería ser innecesario: idempotente), opciones:

1. **Vía Cloud Console UI** (Firebase Console → Functions → migrateToSubproyecto2 → Test, autenticado con `serpa2003@gmail.com`).
2. **Vía Admin SDK local** con service account JSON en `GOOGLE_APPLICATION_CREDENTIALS`. El script driver vive transitoriamente en `scripts/runSub2Migration.mjs` durante la ejecución (no se commitea).

`verifySubproyecto2Migration` puede correrse las veces que haga falta para chequear estado actual.
