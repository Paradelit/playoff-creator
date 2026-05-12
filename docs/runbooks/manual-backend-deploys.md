# Manual backend deploys

Hasta que la SA `FIREBASE_SERVICE_ACCOUNT` tenga los roles IAM completos en GCP, el deploy automático de Cloud Functions + Firestore rules vía CI **falla silenciosamente** (`continue-on-error: true` en `.github/workflows/deploy.yml`). Hosting sí auto-deploya.

Este runbook cubre los deploys manuales tras cada merge a main que toque `functions/src/`, `firestore.rules`, o cualquier referencia a callables.

## Setup local one-time

Asegurar que `firebase-tools` está disponible y autenticado:

```powershell
npm install -g firebase-tools
npx firebase login:list   # debe mostrar tu cuenta autenticada
```

Si no autenticado: `npx firebase login` (abre browser).

## Deploy de Cloud Functions

Tras mergear cualquier PR que toque `functions/src/`:

```powershell
npx firebase deploy --only functions --project playoff-creator --force --non-interactive
```

Tiempo: 2-5 min para 25 funciones. El flag `--force` evita el prompt interactivo de confirmación.

**Errores comunes:**

- **"Missing permissions ... iam.serviceAccounts.ActAs"**: tu cuenta no tiene Service Account User. Resolver desde otra cuenta con admin, o asignarte el rol en GCP IAM Console.
- **"In non-interactive mode but have no value for the secret: X"**: el secret declarado en código no está en Secret Manager. Crearlo con `echo "value" | npx firebase functions:secrets:set X --project playoff-creator --data-file -`.

## Deploy de Firestore rules

Tras mergear cualquier PR que toque `firestore.rules` o `firestore.indexes.json`:

```powershell
npx firebase deploy --only firestore:rules --project playoff-creator
npx firebase deploy --only firestore:indexes --project playoff-creator   # solo si indexes.json cambió
```

Tiempo: ~10 segundos rules; índices pueden tardar minutos en construirse.

## Fix permanente (cuando quieras eliminar este runbook)

En GCP Console → IAM & Admin → IAM → encontrar la service account de `FIREBASE_SERVICE_ACCOUNT` (formato típico: `playoff-creator@playoff-creator.iam.gserviceaccount.com` o similar). Granting:

| Rol                                        | Habilita                              |
| ------------------------------------------ | ------------------------------------- |
| `Cloud Functions Developer`                | Deploy de Cloud Functions             |
| `Service Account User`                     | actAs sobre la default compute SA     |
| `Service Usage Consumer`                   | Consumir APIs de funciones            |
| `Cloud Datastore Owner`                    | Deploy de Firestore rules + indexes   |
| `Firebase Hosting Admin`                   | (ya granted) Deploy de Hosting        |
| `Storage Admin` sobre el bucket de backups | Permite a la backup function escribir |

Una vez granted, el step `Deploy Cloud Functions` de `deploy.yml` pasará de yellow warning a green. Quitar entonces el `continue-on-error: true` para que un fallo futuro sea visible.

## Verificación post-deploy

```powershell
npx firebase functions:list --project playoff-creator
```

Comparar contra lo esperado del PR mergeado. Funciones nuevas aparecen como "v2 callable" recién creadas; eliminadas no aparecen.

Si un PR borró una función pero sigue listada: el comando `firebase deploy --only functions --force` debería purgarla. Si persiste, borrar manual: `npx firebase functions:delete NOMBRE --project playoff-creator --force`.
