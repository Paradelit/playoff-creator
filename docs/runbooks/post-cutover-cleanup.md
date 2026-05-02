# Post-cutover cleanup — Sub-proyecto 1

Lista de items que sólo existen para soportar la **migración** y deberían retirarse después de que la cutover haya estabilizado (≥ 30 días sin rollback ni regresiones bloqueantes).

JSON puro no admite comentarios, así que este doc actúa como anclaje vivo de los items que conviene revisar cuando llegue el momento de la limpieza.

## Cuándo ejecutar

1. La smoke checklist (`docs/runbooks/cutover-smoke-checklist.md`) pasa al 100% sobre 3 cuentas reales.
2. Han pasado ≥ 30 días desde el deploy de cutover sin rollback.
3. `node scripts/cleanupOldPaths.js --dry-run` se ha lanzado y el conteo es razonable.

## Items a retirar

### 1. Composite index `workspaces (type, ownerId)` (`firestore.indexes.json`)

Este índice se añadió **únicamente** para que la migración pudiera consultar `where type == 'personal' AND where ownerId == uid` (ver `scripts/migration/lib/migrateUser.js`, funciones `findCompletedPersonal` y `findAnyPersonal`).

Una vez migrados todos los usuarios y removida la entrada `migrateToWorkspaces.js` de la rotación, el índice no se utiliza desde el cliente: el lookup en runtime ocurre por `ownerId` desde `users/{uid}/memberships/`, no por scan a `workspaces/`.

**Acción**: borrar la tercera entrada de `firestore.indexes.json` (la que combina `type` + `ownerId` sobre `workspaces`) y desplegar con `firebase deploy --only firestore:indexes`.

### 2. Script `scripts/cleanupOldPaths.js`

Tras la ejecución exitosa (no dry-run) sobre todos los usuarios, el script ya no tiene utilidad. Conviene **conservarlo** durante un par de releases por si aparece un usuario no migrado, pero queda fuera del flujo normal.

**Acción**: mover a `scripts/migration/_archive/` (o similar) cuando el equipo esté seguro de que no hay usuarios pendientes.

### 3. Script `scripts/migration/migrateToWorkspaces.js` y librerías relacionadas

Igual que (2): se conservan para soportar un re-run forzado, pero pueden archivarse pasados 60 días.

### 4. Helpers/funciones obsoletas en `src/`

Cuando todos los servicios apunten a `workspaceDocRef`/`workspaceColRef`, revisar si quedan llamadas residuales a `userDocRef`/`userColRef` para datos de producto (deberían estar limpias después de Commit 4 + revisiones). Cualquier helper que sólo sirviera al modelo viejo se elimina.

**Comando útil**:

```bash
git grep -n "userDocRef\|userColRef" -- src/
```

## Cómo cerrar

Cuando los items 1-3 estén archivados y los tests siguen verdes, abrir un PR `chore(cleanup): retire migration-only artefacts` cuyo único objetivo sea borrar/archivar la lista de arriba. El PR debería ser pequeño y obvio; cualquier "se llama todavía desde X" indica que la limpieza es prematura.
