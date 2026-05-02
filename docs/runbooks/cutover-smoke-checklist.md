# Cutover smoke checklist — Sub-proyecto 1

Tras el cutover de la migración a `workspaces/{wsId}/`, ejecutar este checklist sobre 3 cuentas reales (la del dev + 2 conocidos) antes de quitar el banner de mantenimiento. Tiempo estimado: 5–10 min.

## Sobre cada cuenta

- [ ] Login funciona, redirect a `/area-privada/`.
- [ ] `HomeScreen` carga, lista de teams visible, contador de jugadores correcto.
- [ ] Abrir un team → cuaderno completo carga: jugadores, test-tiro, asistencia, informe-jugadores, notas, pilares, normas.
- [ ] Calendario carga sesiones (entrenamientos + partidos + playoffs virtuales).
- [ ] Abrir un bracket existente, ver matches y winners propagados correctamente.
- [ ] Crear un nuevo team. Verificar en Firestore Console que el doc se ha creado en `workspaces/{wsId}/teams/`, no en `users/{uid}/teams/`.
- [ ] Abrir Pick → enviar mensaje rápido → recibir respuesta. Verificar en Firestore Console que la conversación está en `users/{uid}/pickHistory/{wsId}/conversations/`.
- [ ] Mandar una convocatoria desde el calendario → marca `convocatoriaSentAt`. Verificar el path nuevo.
- [ ] `/pendientes` muestra los items correctos. Confirmar que los notifs proactivos siguen filtrados por `wsId`.
- [ ] Settings (`profile/main`) sigue funcionando, sin cambios visibles.
- [ ] Logout y re-login → `activeWsId` se restaura desde localStorage al workspace personal.

## Si algún punto falla

1. Anotar el path Firestore exacto del doc problemático.
2. Decisión binaria:
   - **Rollback**: redeploy del código previo + reglas previas. Datos antiguos en `users/{uid}/...` están intactos. Investigar offline.
   - **Fix-forward**: si es trivial (un path mal en un servicio), patch+deploy en caliente. Solo si la confianza es alta.
3. Banner de mantenimiento se mantiene hasta resolver.

## Cleanup a 30 días

Si tras 30 días no han aparecido bugs, ejecutar:

```bash
node scripts/cleanupOldPaths.js --dry-run    # verifica conteos
node scripts/cleanupOldPaths.js              # elimina paths antiguos
```
