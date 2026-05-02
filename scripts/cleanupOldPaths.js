#!/usr/bin/env node
// Post-cutover cleanup: recursively delete legacy collections under
// `artifacts/{appId}/users/{uid}/...` that have already been migrated to
// `artifacts/{appId}/workspaces/{wsId}/...`.
//
// Idempotent: safe to re-run. A second run iterates the same uids but finds
// nothing to delete and returns 0.
//
// Usage:
//   node scripts/cleanupOldPaths.js --dry-run                      # only counts
//   node scripts/cleanupOldPaths.js --project pickncoach-prod      # production
//   node scripts/cleanupOldPaths.js --credentials ./sa.json        # explicit SA
//   node scripts/cleanupOldPaths.js --app-id uros-fbm-app          # override appId
//
// Run AFTER the smoke checklist (docs/runbooks/cutover-smoke-checklist.md) has
// passed and the 30-day monitoring window has elapsed without rollback.
import { initAdmin, getDb, getAuth } from './migration/lib/admin.js';

const OLD_COLLECTIONS_TO_DELETE = [
  'teams',
  'brackets',
  'calendarSessions',
  'playoffConvocatorias',
  'exercises',
  'conversations',
  'ragIndex',
  'digest',
  'copilotMemory',
];

function parseArgs(argv) {
  const args = { dryRun: false, project: null, credentials: null, appId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--credentials') args.credentials = argv[++i];
    else if (a === '--app-id') args.appId = argv[++i];
  }

  if (!args.appId) {
    console.error('Error: --app-id is required (no default; foot-gun protection)');
    process.exit(2);
  }

  return args;
}

async function deleteCollectionRecursive(db, path, dryRun) {
  const snap = await db.collection(path).get();
  let deleted = 0;
  for (const docSnap of snap.docs) {
    const subcols = await docSnap.ref.listCollections();
    for (const sub of subcols) {
      deleted += await deleteCollectionRecursive(db, `${path}/${docSnap.id}/${sub.id}`, dryRun);
    }
    if (!dryRun) await docSnap.ref.delete();
    deleted++;
  }
  return deleted;
}

async function listUserUids() {
  const auth = getAuth();
  const all = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    all.push(...page.users.map((u) => u.uid));
    pageToken = page.pageToken;
  } while (pageToken);
  return all;
}

async function main() {
  const args = parseArgs(process.argv);
  initAdmin({ project: args.project, credentialsPath: args.credentials });
  const db = getDb();

  const uids = await listUserUids();
  console.log(`[cleanup] target users: ${uids.length}${args.dryRun ? ' [DRY-RUN]' : ''}`);

  let totalDeleted = 0;
  for (const uid of uids) {
    let perUser = 0;
    for (const col of OLD_COLLECTIONS_TO_DELETE) {
      const path = `artifacts/${args.appId}/users/${uid}/${col}`;
      const count = await deleteCollectionRecursive(db, path, args.dryRun);
      perUser += count;
    }
    totalDeleted += perUser;
    console.log(`[${uid}] ${args.dryRun ? 'would delete' : 'deleted'} ${perUser} docs`);
  }
  console.log(`\nTotal ${args.dryRun ? 'would delete' : 'deleted'}: ${totalDeleted} docs`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
