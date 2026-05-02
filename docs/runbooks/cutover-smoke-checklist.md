# Cutover smoke checklist — Sub-proyectos 1 + 1.5

Tras el cutover de la migración a `workspaces/{wsId}/`, ejecutar este runbook + checklist sobre 3 cuentas reales (la del dev + 2 conocidos) en una ventana de mantenimiento dominical (~04:00 hora España).

## Runbook (orden definitivo, sub-proyecto 1.5)

```
1. Backup Firestore export → Cloud Storage:
   gcloud firestore export gs://<backup-bucket>/pre-cutover-$(date -u +%Y%m%d-%H%M%S) \
     --project <PROJECT_ID>

2. Banner read-only ON:
   - Set hosting env var VITE_READ_ONLY_MODE=true
   - firebase deploy --only hosting --project <PROJECT_ID>

3. Run migration:
   node scripts/migration/migrateToWorkspaces.js \
     --app-id <APP_ID> \
     --project <PROJECT_ID> \
     --credentials path/to/sa.json

4. Verify counts en migration.log — sin failed entries

5. Deploy nuevo código + reglas + onCreate trigger:
   firebase deploy --only hosting,functions,firestore:rules,firestore:indexes \
     --project <PROJECT_ID>

6. Smoke tests sobre 3 cuentas reales (lista abajo)

7. Banner OFF:
   - Unset VITE_READ_ONLY_MODE
   - firebase deploy --only hosting --project <PROJECT_ID>
```

**Diferencia vs el runbook original (sub-proyecto 1)**: la migración corre ANTES del deploy del código nuevo, evitando la ventana awkward "código nuevo lee paths que aún no existen".

## Smoke checklist (manual, 5–10 min)

Sobre cada una de 3 cuentas reales:

- [ ] Login funciona, redirect a `/area-privada/`.
- [ ] `HomeScreen` carga, lista de teams visible, contador de jugadores correcto.
- [ ] Abrir un team → cuaderno completo carga: jugadores, test-tiro, asistencia, informe-jugadores, notas, pilares, normas.
- [ ] Calendario carga sesiones (entrenamientos + partidos + playoffs virtuales).
- [ ] Abrir un bracket existente, ver matches y winners propagados correctamente.
- [ ] Crear un nuevo team. Verificar en Firestore Console que el doc se ha creado en `workspaces/{wsId}/teams/`, no en `users/{uid}/teams/`.
- [ ] Abrir Pick → enviar mensaje rápido → recibir respuesta. **Verificar que el orchestrator log incluye `wsId` y que la respuesta refleja datos del workspace activo (no datos viejos).**
- [ ] Mandar una convocatoria desde el calendario → marca `convocatoriaSentAt`. Verificar el path nuevo.
- [ ] `/pendientes` muestra los items correctos. Confirmar que los notifs proactivos siguen filtrados por `wsId`.
- [ ] Settings (`profile/main`) sigue funcionando, sin cambios visibles.
- [ ] Logout y re-login → `activeWsId` se restaura desde localStorage al workspace personal.

### Smoke 1.5 (sub-proyecto 1.5 specific)

- [ ] **Borrar un team desde la UI** → confirmar en Firestore Console que el doc desaparece de `workspaces/{wsId}/teams/{teamId}` (no solo del path viejo).
- [ ] **Crear cuenta nueva con email distinto** → verificar que aterriza en `HomeScreen` directamente (no en `WorkspaceProvisioningState`); confirmar en Firestore que `workspaces/{newWsId}` + `members/{uid}` + `users/{uid}/memberships/{newWsId}` se han creado automáticamente.
- [ ] **Esperar a las 08:00 del día siguiente** (o trigger manualmente la `proactiveDailyBriefing` Cloud Function en Console) → confirmar que el notif generado tiene el campo `wsId` poblado y aparece en `/pendientes`.

## Si algún punto falla

1. Anotar el path Firestore exacto del doc problemático.
2. Decisión binaria:
   - **Rollback**: redeploy del código previo + reglas previas. Datos antiguos en `users/{uid}/...` están intactos. Investigar offline.
   - **Fix-forward**: si es trivial (un path mal en un servicio), patch+deploy en caliente. Solo si la confianza es alta.
3. Banner de mantenimiento se mantiene hasta resolver.

## Cleanup a 30 días

Si tras 30 días no han aparecido bugs, ejecutar:

```bash
node scripts/cleanupOldPaths.js --dry-run --app-id <APP_ID>
node scripts/cleanupOldPaths.js --app-id <APP_ID>
```
