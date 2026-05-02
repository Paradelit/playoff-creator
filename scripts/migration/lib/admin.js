import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

let initialized = false;

export function initAdmin({ project, credentialsPath } = {}) {
  if (initialized) return admin;

  const credentials = credentialsPath ? JSON.parse(readFileSync(credentialsPath, 'utf8')) : null;

  admin.initializeApp({
    credential: credentials ? admin.credential.cert(credentials) : admin.credential.applicationDefault(),
    projectId: project ?? process.env.GCLOUD_PROJECT,
  });
  initialized = true;
  return admin;
}

export function getDb() {
  return admin.firestore();
}

export function getAuth() {
  return admin.auth();
}
