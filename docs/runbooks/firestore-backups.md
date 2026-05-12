# Firestore backups (sub-7 batch infra)

Sub-7 batch CI añadió `scheduledFirestoreBackup` (functions/src/maintenance/) que corre 03:00 Madrid daily y exporta Firestore a Cloud Storage. Antes los exports eran 100% manuales y limitados al cutover de sub-1.

## Setup pre-operativo (usuario, una vez)

1. **Crear el bucket** (en `europe-west1` para colocation con functions y Firestore):

   ```powershell
   gcloud storage buckets create gs://playoff-creator-firestore-backups `
     --location=europe-west1 `
     --project=playoff-creator `
     --uniform-bucket-level-access
   ```

   Si `gcloud` no está instalado: desde Firebase Console → Cloud Storage → crear bucket manualmente con el mismo nombre y location.

2. **Grant al Firestore Service Agent** los permisos para escribir al bucket. El SA tiene formato:

   ```
   service-<PROJECT_NUMBER>@gcp-sa-firestore.iam.gserviceaccount.com
   ```

   Encontrar el PROJECT_NUMBER en Firebase Console → settings → project ID. Luego:

   ```powershell
   gcloud storage buckets add-iam-policy-binding gs://playoff-creator-firestore-backups `
     --member="serviceAccount:service-<PROJECT_NUMBER>@gcp-sa-firestore.iam.gserviceaccount.com" `
     --role="roles/storage.admin"
   ```

3. **Lifecycle rule** (opcional pero recomendada — retención 30 días):

   Crear `lifecycle.json`:

   ```json
   {
     "lifecycle": {
       "rule": [
         {
           "action": { "type": "Delete" },
           "condition": { "age": 30 }
         }
       ]
     }
   }
   ```

   Aplicar:

   ```powershell
   gcloud storage buckets update gs://playoff-creator-firestore-backups --lifecycle-file=lifecycle.json
   ```

## Verificación

Tras setup, esperar al primer run (próximo 03:00 Madrid) o disparar manualmente desde Cloud Console → Cloud Scheduler → encontrar `scheduledFirestoreBackup` → "Run now".

Logs en Cloud Logging filtrar por `resource.labels.function_name="scheduledFirestoreBackup"`. Esperar línea `[scheduledFirestoreBackup] export queued` con un `outputUriPrefix`.

Verificar el bucket:

```powershell
gcloud storage ls gs://playoff-creator-firestore-backups/auto/
```

Debería listar carpetas con timestamp `YYYY-MM-DDTHH-mm-ss-...`.

## Restore

Si toca restaurar (recuperar un workspace borrado por accidente, recuperar de incidente):

```powershell
gcloud firestore import gs://playoff-creator-firestore-backups/auto/<TIMESTAMP_FOLDER>/ `
  --project=playoff-creator
```

**ADVERTENCIA**: `firestore import` **sobreescribe** los documentos existentes que coincidan con paths del backup. Si el incidente afectó solo a un subconjunto, considerar:

- Importar a un proyecto staging primero
- Comparar diffs
- Importar selectivamente con `--collection-ids="teams,calendarSessions"` para limitar el scope

## Política de retención

V1: 30 días via lifecycle rule.

Si toca mantener más por compliance/legal: subir la condition.age, o moverlos a Coldline Storage class para abaratar.

## Coste estimado

A volumen actual (~36 workspaces, ~10K docs total): export ≈ 50MB. Coste mensual de 30 backups acumulados ≈ €0.01 (Standard storage europe-west1). Despreciable.
