// functions/src/maintenance/scheduledFirestoreBackup.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

/**
 * Export diario de Firestore a Cloud Storage. Cierra el hallazgo "no backup
 * automatizado" del audit (BLOCKER) — pre sub-7 batch, los exports solo se
 * hacían a mano en el cutover de sub-1.
 *
 * Pre-requisitos OPERATIVOS (no automatizables vía código):
 *
 * 1. Crear el bucket: `gcloud storage buckets create gs://playoff-creator-firestore-backups
 *      --location=europe-west1 --project=playoff-creator`
 * 2. Grant al Firestore Service Agent permisos de escritura:
 *    El SA tiene formato `service-{PROJECT_NUMBER}@gcp-sa-firestore.iam.gserviceaccount.com`.
 *    Asignarle el rol `Storage Admin` (`roles/storage.admin`) sobre el bucket.
 * 3. Definir el secret `FIRESTORE_BACKUP_BUCKET` con valor `gs://playoff-creator-firestore-backups`
 *    si quieres rotarlo en el futuro (opcional — por defecto va al canonical).
 *
 * Si los pre-requisitos no están: la función intenta el export, loguea el
 * error, y el siguiente día reintenta. No bloquea ninguna otra ruta.
 *
 * Política de retención: ninguna automatizada en V1. Los exports se acumulan
 * indefinidamente. Configurar lifecycle rules en el bucket si toca:
 * `gcloud storage buckets update gs://playoff-creator-firestore-backups
 *    --lifecycle-file=lifecycle.json` donde lifecycle.json define `age > 30d → DELETE`.
 *
 * Restore: `gcloud firestore import gs://playoff-creator-firestore-backups/<EXPORT_PREFIX>`
 * (ver docs/runbooks/firestore-backups.md cuando se cree).
 */
export const scheduledFirestoreBackup = onSchedule(
  {
    // 03:00 Madrid (UTC+1/+2 según DST). Cron en UTC: 02:00 invierno / 01:00 verano.
    // Usamos timeZone explícita para evitar confusión.
    schedule: "0 3 * * *",
    timeZone: "Europe/Madrid",
    region: "europe-west1",
    timeoutSeconds: 540, // exports grandes pueden tardar; 9 min margin.
    memory: "512MiB",
  },
  async () => {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
      logger.error("[scheduledFirestoreBackup] no projectId in env; aborting");
      return;
    }
    const bucket =
      process.env.FIRESTORE_BACKUP_BUCKET ||
      `gs://${projectId}-firestore-backups`;

    // Usamos la Firestore Admin REST API directamente — el cliente @google-cloud
    // /firestore no expone exportDocuments en alto nivel. Auth con la SA del
    // entorno (functions corre con la default service account del proyecto).
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/datastore"],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) {
      logger.error("[scheduledFirestoreBackup] failed to acquire access token");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputUriPrefix = `${bucket}/auto/${timestamp}`;

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ outputUriPrefix }),
      });
      if (!res.ok) {
        const text = await res.text();
        logger.error("[scheduledFirestoreBackup] export request failed", {
          status: res.status,
          body: text.slice(0, 500),
        });
        return;
      }
      const data = (await res.json()) as { name?: string };
      logger.info("[scheduledFirestoreBackup] export queued", {
        operation: data.name,
        outputUriPrefix,
      });
    } catch (err) {
      logger.error("[scheduledFirestoreBackup] unexpected error", {
        err: (err as Error).message,
      });
    }
  },
);
