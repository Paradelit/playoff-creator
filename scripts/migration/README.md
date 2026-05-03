# Migration scripts

Scripts para la migración del modelo `users/{uid}/...` → `workspaces/{wsId}/...`.

## Uso

```bash
# Dry-run (cuenta docs, no escribe)
node scripts/migration/migrateToWorkspaces.js --dry-run

# Un solo user (testing)
node scripts/migration/migrateToWorkspaces.js --user UID

# Producción
node scripts/migration/migrateToWorkspaces.js --project pickncoach-prod
```

Service account JSON apuntado por `GOOGLE_APPLICATION_CREDENTIALS` o flag `--credentials`.

Diseño detallado: `docs/superpowers/specs/2026-05-01-sub-proyecto-1-modelo-cuenta-workspace-migracion-design.md` sección 4.
