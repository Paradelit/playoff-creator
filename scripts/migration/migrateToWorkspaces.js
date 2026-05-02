#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { initAdmin, getDb, getAuth } from './lib/admin.js';
import { migrateUser } from './lib/migrateUser.js';

export function parseArgs(argv) {
  const args = { dryRun: false, user: null, project: null, credentials: null, appId: 'uros-fbm-app' };

  function nextValue(currentFlag, i) {
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      console.error(`${currentFlag} requires a value`);
      process.exit(2);
    }
    return value;
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--user') {
      args.user = nextValue(a, i);
      i++;
    } else if (a === '--project') {
      args.project = nextValue(a, i);
      i++;
    } else if (a === '--credentials') {
      args.credentials = nextValue(a, i);
      i++;
    } else if (a === '--app-id') {
      args.appId = nextValue(a, i);
      i++;
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

export async function listUserUids(args) {
  if (args.user) return [args.user];
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

export async function main() {
  const args = parseArgs(process.argv);
  initAdmin({ project: args.project, credentialsPath: args.credentials });
  const db = getDb();

  const uids = await listUserUids(args);
  console.log(`[migrate] target users: ${uids.length}${args.dryRun ? ' [DRY-RUN]' : ''}`);

  const summary = { migrated: 0, skipped: 0, failed: 0, errors: [] };
  for (const uid of uids) {
    try {
      const result = await migrateUser(db, args.appId, uid, { dryRun: args.dryRun });
      summary[result.status]++;
      console.log(`[${uid}] ${result.status}: ${result.message ?? result.error ?? ''}`);
      if (result.status === 'failed') {
        summary.errors.push({ uid, error: result.error });
      }
    } catch (e) {
      summary.failed++;
      summary.errors.push({ uid, error: e.message });
      console.error(`[${uid}] FATAL: ${e.message}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
}

// Run main() only when executed directly (node scripts/migration/migrateToWorkspaces.js).
// Import-as-module (e.g. for the load test) does not trigger initAdmin() / Firestore calls,
// which would otherwise crash without service-account credentials.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  main().catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });
}
