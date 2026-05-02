import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

let testEnv: RulesTestEnvironment;
const APP_ID = 'app1';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pickncoach-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => testEnv.cleanup());

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed: workspace WS_A owned by U_A; workspace WS_B owned by U_B
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).set({
      type: 'personal',
      name: 'Mi cuenta',
      ownerId: 'U_A',
      plan: 'free',
      billing: null,
    });
    await db.doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_A`).set({ role: 'owner' });
    await db.doc(`artifacts/${APP_ID}/workspaces/WS_B`).set({
      type: 'personal',
      name: 'Otra',
      ownerId: 'U_B',
      plan: 'free',
      billing: null,
    });
    await db.doc(`artifacts/${APP_ID}/workspaces/WS_B/members/U_B`).set({ role: 'owner' });
  });
});

describe('firestore.rules — workspaces', () => {
  it('member can read their workspace doc', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).get());
  });

  it('non-member cannot read workspace doc', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_B`).get());
  });

  it('unauthenticated cannot read workspace doc', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).get());
  });

  it('member can read+write subcollections of their workspace', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/teams/t1`).set({ name: 'X' }));
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/teams/t1/cuaderno/jugadores`).set({ rows: [] }));
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/brackets/b1`).set({ name: 'BR' }));
  });

  it('non-member cannot read+write subcollections of another workspace', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_B/teams/t1`).set({ name: 'X' }));
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_B/brackets/b1`).get());
  });

  it('user can create a workspace where they are owner', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(
      db.doc(`artifacts/${APP_ID}/workspaces/WS_NEW`).set({
        type: 'personal',
        name: 'New',
        ownerId: 'U_A',
        plan: 'free',
        billing: null,
      }),
    );
  });

  it('user cannot create a workspace where ownerId is someone else', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(
      db.doc(`artifacts/${APP_ID}/workspaces/WS_FAKE`).set({
        type: 'personal',
        name: 'Fake',
        ownerId: 'U_B',
        plan: 'free',
        billing: null,
      }),
    );
  });

  it('owner can update workspace doc', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).update({ name: 'Renamed' }));
  });

  it('non-owner member cannot update workspace doc (V1 lock)', async () => {
    // Add U_C as a member of WS_A (not owner)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' });
    });
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).update({ name: 'Hacked' }));
  });

  it('owner can write members subcollection (add member)', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' }));
  });

  it('non-owner member cannot write members subcollection', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' });
    });
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_X`).set({ role: 'coach' }));
  });
});

describe('firestore.rules — users (private data, unchanged effect)', () => {
  it('user reads their own private data', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/users/U_A/profile/main`).set({ theme: 'light' });
    });
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/users/U_A/profile/main`).get());
  });

  it('user cannot read another users private data', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/users/U_B/profile/main`).set({ theme: 'dark' });
    });
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/users/U_B/profile/main`).get());
  });

  it('user reads their memberships', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/users/U_A/memberships/WS_A`).set({ role: 'owner' });
    });
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/users/U_A/memberships/WS_A`).get());
  });
});

describe('firestore.rules — shared (unchanged)', () => {
  it('shared bracket with linkAccess=view is readable by signed-in user', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/shared/SHARE1`)
        .set({
          shareConfig: { ownerId: 'U_A', linkAccess: 'view' },
        });
    });
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/shared/SHARE1`).get());
  });
});
