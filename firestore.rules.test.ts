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

  it('non-owner member cannot write members subcollection', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' });
    });
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_X`).set({ role: 'coach' }));
  });

  it('non-owner member cannot promote themselves to owner', async () => {
    // Seed U_C as a regular coach member of WS_A.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' });
    });
    // U_C tries to upgrade their own membership doc to role: 'owner'.
    // This must fail: only the workspace owner can write to members/.
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).update({ role: 'owner' }));
  });

  it('member can list workspace members collection', async () => {
    // Seed U_C as a member of WS_A so the read rule applies.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' });
    });
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertSucceeds(db.collection(`artifacts/${APP_ID}/workspaces/WS_A/members`).get());
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

describe('firestore.rules — workspaces/{wsId}/usage/{monthId}', () => {
  it('member can read usage doc', async () => {
    // Seed usage doc via security-rules-disabled context
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/workspaces/WS_A/usage/2026-05`)
        .set({ requestCount: 42, updatedAt: '2026-05-01' });
    });
    // U_A is owner/member of WS_A — should be able to read
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(
      db.doc(`artifacts/${APP_ID}/workspaces/WS_A/usage/2026-05`).get(),
    );
  });

  it('non-member cannot read usage doc', async () => {
    // Seed usage doc
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/workspaces/WS_A/usage/2026-05`)
        .set({ requestCount: 42, updatedAt: '2026-05-01' });
    });
    // U_B is NOT a member of WS_A — should be denied
    const db = testEnv.authenticatedContext('U_B').firestore();
    await assertFails(
      db.doc(`artifacts/${APP_ID}/workspaces/WS_A/usage/2026-05`).get(),
    );
  });

  it('nobody can write usage from client (set/update/delete)', async () => {
    // Seed usage doc so update/delete have a target
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/workspaces/WS_A/usage/2026-05`)
        .set({ requestCount: 42, updatedAt: '2026-05-01' });
    });
    // U_A is owner of WS_A — writes must still fail (client writes forbidden)
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(
      db
        .doc(`artifacts/${APP_ID}/workspaces/WS_A/usage/2026-05`)
        .set({ requestCount: 100 }),
    );
    await assertFails(
      db
        .doc(`artifacts/${APP_ID}/workspaces/WS_A/usage/2026-05`)
        .update({ requestCount: 100 }),
    );
    await assertFails(
      db.doc(`artifacts/${APP_ID}/workspaces/WS_A/usage/2026-05`).delete(),
    );
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

// ─────────────────────────────────────────────────────────────────────────
// Sub-proyecto 2 — permisos y scoping (rules sub-2)
// ─────────────────────────────────────────────────────────────────────────

describe('sub-proyecto 2 — Cat A workspace meta (club)', () => {
  const WS = 'WS_CLUB';
  const OWNER = 'CLUB_OWNER';
  const DT = 'CLUB_DT';
  const COACH = 'CLUB_COACH';
  const STRANGER = 'NO_MEMBER';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}`).set({
        type: 'club',
        name: 'Club Test',
        ownerId: OWNER,
        plan: 'pro',
        billing: { stripeCustomerId: 'cus_x', status: 'active' },
      });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${OWNER}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${DT}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${COACH}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
    });
  });

  it('owner edita settings del workspace', async () => {
    const owner = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(
      owner.doc(`artifacts/${APP_ID}/workspaces/${WS}`).update({ name: 'Renamed' }),
    );
  });

  it('DT no-owner NO puede tocar plan/billing/ownerId', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertFails(owner_update_plan(dt));
    await assertFails(owner_update_billing(dt));
    await assertFails(owner_update_owner(dt));

    function owner_update_plan(db: ReturnType<typeof testEnv.authenticatedContext>['firestore']) {
      return db.doc(`artifacts/${APP_ID}/workspaces/${WS}`).update({ plan: 'max' });
    }
    function owner_update_billing(
      db: ReturnType<typeof testEnv.authenticatedContext>['firestore'],
    ) {
      return db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}`)
        .update({ billing: { stripeCustomerId: 'cus_hacked' } });
    }
    function owner_update_owner(
      db: ReturnType<typeof testEnv.authenticatedContext>['firestore'],
    ) {
      return db.doc(`artifacts/${APP_ID}/workspaces/${WS}`).update({ ownerId: DT });
    }
  });

  it('coach denegado para editar workspace doc', async () => {
    const coach = testEnv.authenticatedContext(COACH).firestore();
    await assertFails(
      coach.doc(`artifacts/${APP_ID}/workspaces/${WS}`).update({ name: 'Coach edit' }),
    );
  });

  it('DT NO puede tocar la membership del ownerId', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertFails(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${OWNER}`).update({ role: 'coach' }),
    );
  });

  it('transfer ownership a uid no-member es denegado', async () => {
    const owner = testEnv.authenticatedContext(OWNER).firestore();
    await assertFails(
      owner.doc(`artifacts/${APP_ID}/workspaces/${WS}`).update({ ownerId: STRANGER }),
    );
  });
});

describe('sub-proyecto 2 — Cat B workspace-wide DT-curated (club)', () => {
  const WS = 'WS_CLUB_B';
  const DT = 'B_DT';
  const COACH = 'B_COACH';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}`)
        .set({ type: 'club', ownerId: DT });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${DT}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${COACH}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/exercises/ex-dt`)
        .set({ name: 'Batería defensiva', createdBy: DT });
    });
  });

  it('DT crea ejercicio en biblioteca club', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertSucceeds(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/exercises/ex-new`)
        .set({ name: 'X', createdBy: DT }),
    );
  });

  it('coach lee biblioteca club pero NO escribe', async () => {
    const coach = testEnv.authenticatedContext(COACH).firestore();
    await assertSucceeds(coach.doc(`artifacts/${APP_ID}/workspaces/${WS}/exercises/ex-dt`).get());
    await assertFails(
      coach
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/exercises/ex-coach`)
        .set({ name: 'Y', createdBy: COACH }),
    );
  });

  it('coach NO edita ejercicio creado por DT', async () => {
    const coach = testEnv.authenticatedContext(COACH).firestore();
    await assertFails(
      coach
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/exercises/ex-dt`)
        .update({ name: 'Renamed' }),
    );
  });

  it('DT edita su propia creación pero NO puede cambiar createdBy', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertSucceeds(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/exercises/ex-dt`)
        .update({ name: 'Renamed by DT' }),
    );
    await assertFails(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/exercises/ex-dt`)
        .update({ createdBy: 'ghost-uid' }),
    );
  });

  it('DT escribe en cuadernoTemplate; coach lee pero no escribe', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    const coach = testEnv.authenticatedContext(COACH).firestore();
    await assertSucceeds(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/cuadernoTemplate/main`)
        .set({ clubLogoUrl: 'x', clubName: 'Test club' }),
    );
    await assertSucceeds(
      coach.doc(`artifacts/${APP_ID}/workspaces/${WS}/cuadernoTemplate/main`).get(),
    );
    await assertFails(
      coach
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/cuadernoTemplate/main`)
        .set({ clubName: 'Coach takeover' }),
    );
  });
});

describe('sub-proyecto 2 — Cat C team-scoped strict (club)', () => {
  const WS = 'WS_CLUB_C';
  const OWNER = 'C_OWNER';
  const DT = 'C_DT';
  const COACH_T1 = 'C_COACH_T1';
  const COACH_T2 = 'C_COACH_T2';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}`)
        .set({ type: 'club', ownerId: OWNER });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${OWNER}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${DT}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${COACH_T1}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${COACH_T2}`)
        .set({ role: 'coach', assignedTeamIds: ['t2'] });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).set({ name: 'T1' });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2`).set({ name: 'T2' });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/notas`)
        .set({ items: [{ text: 'nota t1' }] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b1`)
        .set({ teamId: 't1', createdBy: COACH_T1 });
    });
  });

  it('coach-t1 R/W en cuaderno/notas (singleton) de t1', async () => {
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertSucceeds(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/notas`).get());
    await assertSucceeds(
      c
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/notas`)
        .update({ items: [{ text: 'updated' }] }),
    );
  });

  it('coach-t1 denegado para leer cuaderno/notas de t2', async () => {
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertFails(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2/cuaderno/notas`).get());
  });

  it('DT denegado para leer cuaderno (sin asignación, sin grant)', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertFails(dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/notas`).get());
  });

  it('DT puede CREATE training en cualquier team aunque no esté asignado', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertSucceeds(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/trainings/tr-dt`)
        .set({ name: 'Sesión defensiva', createdBy: DT }),
    );
  });

  it('DT mantiene R/W de su propia creación de training vía createdBy', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/trainings/tr-dt`)
        .set({ name: 'Sesión X', createdBy: DT });
    });
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertSucceeds(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/trainings/tr-dt`).get(),
    );
    await assertSucceeds(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/trainings/tr-dt`)
        .update({ name: 'Sesión X v2' }),
    );
  });

  it('non-member denegado lectura de cuaderno', async () => {
    const stranger = testEnv.authenticatedContext('STRANGER').firestore();
    await assertFails(
      stranger.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/notas`).get(),
    );
  });

  it('coach-t1 R/W en bracket de t1', async () => {
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertSucceeds(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b1`).get());
    await assertSucceeds(
      c.doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b1`).update({ name: 'Updated' }),
    );
  });

  it('coach-t1 NO puede reparentear bracket de t1 a t2', async () => {
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertFails(
      c.doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b1`).update({ teamId: 't2' }),
    );
  });

  it('DT crea bracket en cualquier team aunque no esté asignado', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertSucceeds(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b-new`)
        .set({ teamId: 't2', createdBy: DT }),
    );
  });
});

describe('sub-proyecto 3 — team metadata visibility scoping', () => {
  // Modelo: owner del workspace ve TODOS los teams. Cualquier otro member
  // (DT no-owner, coach) ve únicamente los teams en su assignedTeamIds.
  const WS = 'WS_SCOPE';
  const OWNER = 'S_OWNER';
  const DT_RAMA = 'S_DT_RAMA'; // DT no-owner asignado solo a t1
  const COACH = 'S_COACH'; // coach asignado solo a t1

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}`)
        .set({ type: 'club', ownerId: OWNER });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${OWNER}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${DT_RAMA}`)
        .set({ role: 'dt', assignedTeamIds: ['t1'] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${COACH}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).set({ name: 'T1' });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2`).set({ name: 'T2' });
    });
  });

  it('owner lee CUALQUIER team del club', async () => {
    const o = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(o.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).get());
    await assertSucceeds(o.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2`).get());
  });

  it('DT no-owner solo lee teams de assignedTeamIds', async () => {
    const dt = testEnv.authenticatedContext(DT_RAMA).firestore();
    await assertSucceeds(dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).get());
    await assertFails(dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2`).get());
  });

  it('coach solo lee teams de assignedTeamIds', async () => {
    const c = testEnv.authenticatedContext(COACH).firestore();
    await assertSucceeds(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).get());
    await assertFails(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2`).get());
  });

  it('non-member denegado lectura', async () => {
    const stranger = testEnv.authenticatedContext('STRANGER').firestore();
    await assertFails(stranger.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).get());
  });

  it('DT no-owner NO puede update team al que NO está asignado', async () => {
    const dt = testEnv.authenticatedContext(DT_RAMA).firestore();
    await assertFails(dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2`).update({ name: 'X' }));
  });

  it('DT no-owner SÍ puede update team al que está asignado', async () => {
    const dt = testEnv.authenticatedContext(DT_RAMA).firestore();
    await assertSucceeds(dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).update({ name: 'X' }));
  });

  it('owner puede update CUALQUIER team', async () => {
    const o = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(o.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2`).update({ name: 'X' }));
  });
});

describe('sub-proyecto 4 — owner bypass para brackets + calendarSessions', () => {
  // Sub-4: club owner debe ver TODAS las brackets y calendarSessions del
  // workspace sin necesidad de auto-asignación a cada team.
  const WS = 'WS_OWNER_BYPASS';
  const OWNER = 'OB_OWNER';
  const COACH_T1 = 'OB_COACH_T1';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}`).set({ type: 'club', ownerId: OWNER });
      // Owner está SIN auto-asignar a ningún team (caso del DT principal del
      // club que NO entrenam personalmente).
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${OWNER}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${COACH_T1}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).set({ name: 'T1' });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t2`).set({ name: 'T2' });
      // Creator es un user random, no el COACH_T1 ni el OWNER, para que las
      // assertions sobre coach se basen sólo en isAssignedToTeam y las del
      // owner se basen sólo en isWorkspaceOwner (no en isCreator).
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b1`)
        .set({ teamId: 't1', createdBy: 'OB_RANDOM' });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b2`)
        .set({ teamId: 't2', createdBy: 'OB_RANDOM' });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/calendarSessions/s1`)
        .set({ teamId: 't1', fecha: '2026-05-04', createdBy: 'OB_RANDOM' });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/calendarSessions/s2`)
        .set({ teamId: 't2', fecha: '2026-05-05', createdBy: 'OB_RANDOM' });
    });
  });

  it('owner sin auto-asignación lee CUALQUIER bracket del club', async () => {
    const o = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(o.doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b1`).get());
    await assertSucceeds(o.doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b2`).get());
  });

  it('owner sin auto-asignación lee CUALQUIER calendarSession del club', async () => {
    const o = testEnv.authenticatedContext(OWNER).firestore();
    await assertSucceeds(o.doc(`artifacts/${APP_ID}/workspaces/${WS}/calendarSessions/s1`).get());
    await assertSucceeds(o.doc(`artifacts/${APP_ID}/workspaces/${WS}/calendarSessions/s2`).get());
  });

  it('coach sigue limitado a calendarSessions de teams asignados', async () => {
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertSucceeds(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/calendarSessions/s1`).get());
    await assertFails(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/calendarSessions/s2`).get());
  });

  it('coach sigue limitado a brackets de teams asignados', async () => {
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertSucceeds(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b1`).get());
    await assertFails(c.doc(`artifacts/${APP_ID}/workspaces/${WS}/brackets/b2`).get());
  });
});

describe('sub-proyecto 2 — Cat C sharing primitive (grants)', () => {
  const WS = 'WS_CLUB_G';
  const DT = 'G_DT';
  const COACH_T1 = 'G_COACH_T1';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}`)
        .set({ type: 'club', ownerId: DT });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${DT}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${COACH_T1}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1`).set({ name: 'T1' });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/asistencia`)
        .set({ records: [{ date: '2026-04-15' }] });
    });
  });

  it('coach-t1 grants asistencia a DT; DT lee asistencia', async () => {
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertSucceeds(
      c
        .doc(
          `artifacts/${APP_ID}/workspaces/${WS}/teams/t1/grants/asistencia/grantees/${DT}`,
        )
        .set({
          grantedBy: COACH_T1,
          grantedTo: DT,
          collectionType: 'asistencia',
          grantedAt: '2026-05-04',
        }),
    );
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertSucceeds(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/asistencia`).get(),
    );
  });

  it('DT sin grant denegado para asistencia', async () => {
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertFails(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/asistencia`).get(),
    );
  });

  it('coach revoca grant; DT vuelve a estar denegado', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(
          `artifacts/${APP_ID}/workspaces/${WS}/teams/t1/grants/asistencia/grantees/${DT}`,
        )
        .set({
          grantedBy: COACH_T1,
          grantedTo: DT,
          collectionType: 'asistencia',
        });
    });
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertSucceeds(
      c
        .doc(
          `artifacts/${APP_ID}/workspaces/${WS}/teams/t1/grants/asistencia/grantees/${DT}`,
        )
        .delete(),
    );
    const dt = testEnv.authenticatedContext(DT).firestore();
    await assertFails(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS}/teams/t1/cuaderno/asistencia`).get(),
    );
  });

  it('update de grant prohibido (recreate-only)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(
          `artifacts/${APP_ID}/workspaces/${WS}/teams/t1/grants/asistencia/grantees/${DT}`,
        )
        .set({
          grantedBy: COACH_T1,
          grantedTo: DT,
          collectionType: 'asistencia',
        });
    });
    const c = testEnv.authenticatedContext(COACH_T1).firestore();
    await assertFails(
      c
        .doc(
          `artifacts/${APP_ID}/workspaces/${WS}/teams/t1/grants/asistencia/grantees/${DT}`,
        )
        .update({ grantedAt: '2026-05-05' }),
    );
  });

  it('coach NO asignado al team NO puede crear grant', async () => {
    const otherCoach = 'OUT_COACH';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/workspaces/${WS}/members/${otherCoach}`)
        .set({ role: 'coach', assignedTeamIds: ['t2'] });
    });
    const c = testEnv.authenticatedContext(otherCoach).firestore();
    await assertFails(
      c
        .doc(
          `artifacts/${APP_ID}/workspaces/${WS}/teams/t1/grants/asistencia/grantees/${DT}`,
        )
        .set({
          grantedBy: otherCoach,
          grantedTo: DT,
          collectionType: 'asistencia',
        }),
    );
  });
});

describe('firestore.rules — workspaces.ownerId refuerzo (sub-3)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).set({
        type: 'club', name: 'Club', ownerId: 'U_DT', plan: 'free', billing: null,
      });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT`).set({ role: 'dt', assignedTeamIds: [] });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT2`).set({ role: 'dt', assignedTeamIds: [] });
    });
  });

  it('owner cannot change ownerId directly anymore', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).update({ ownerId: 'U_DT2' }));
  });

  it('non-owner DT also cannot change ownerId (re-confirm sub-2 invariant)', async () => {
    const db = testEnv.authenticatedContext('U_DT2').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).update({ ownerId: 'U_DT2' }));
  });
});

describe('firestore.rules — members refuerzo (sub-3)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).set({
        type: 'club', name: 'Club', ownerId: 'U_DT', plan: 'free', billing: null,
      });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT`).set({ role: 'dt', assignedTeamIds: [] });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_COACH`).set({ role: 'coach', assignedTeamIds: ['t1'] });
    });
  });

  it('DT cannot update a coach role directly', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_COACH`).update({ role: 'dt' }));
  });

  it('DT cannot update assignedTeamIds directly', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_COACH`).update({ assignedTeamIds: ['t2'] }));
  });

  it('owner cannot update own membership directly anymore', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT`).update({ assignedTeamIds: ['t1'] }));
  });
});

describe('firestore.rules — invites (sub-3)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).set({
        type: 'club', name: 'Club', ownerId: 'U_DT', plan: 'free', billing: null,
      });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT`).set({ role: 'dt', assignedTeamIds: [] });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_COACH`).set({ role: 'coach', assignedTeamIds: ['t1'] });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).set({
        inviteId: 'inv-1', workspaceId: 'CLUB', invitedBy: 'U_DT',
        inviteEmail: null, inviteName: null, role: 'coach', assignedTeamIds: ['t1'],
        createdAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000),
      });
    });
  });

  it('DT can read invites', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).get());
  });

  it('coach can read invites (transparency)', async () => {
    const db = testEnv.authenticatedContext('U_COACH').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).get());
  });

  it('non-member denied read', async () => {
    const db = testEnv.authenticatedContext('U_OUT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).get());
  });

  it('DT cannot CREATE invite directly (must use callable)', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-NEW`).set({
      inviteId: 'inv-NEW', workspaceId: 'CLUB', invitedBy: 'U_DT',
      role: 'coach', assignedTeamIds: ['t1'], inviteEmail: null, inviteName: null,
      createdAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000),
    }));
  });

  it('DT cannot DELETE invite directly (must use callable)', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).delete());
  });
});

describe('firestore.rules — stripeEvents (Stripe webhook idempotency)', () => {
  it('signed-in user cannot read stripeEvents docs', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/stripeEvents/evt_xyz`)
        .set({ type: 'checkout.session.completed', wsId: 'WS_A' });
    });
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/stripeEvents/evt_xyz`).get());
  });

  it('signed-in user cannot write stripeEvents docs (create/update/delete)', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(
      db.doc(`artifacts/${APP_ID}/stripeEvents/evt_new`).set({ type: 'checkout.session.completed' }),
    );
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/stripeEvents/evt_existing`)
        .set({ type: 'invoice.payment_succeeded' });
    });
    await assertFails(
      db.doc(`artifacts/${APP_ID}/stripeEvents/evt_existing`).update({ type: 'tampered' }),
    );
    await assertFails(db.doc(`artifacts/${APP_ID}/stripeEvents/evt_existing`).delete());
  });

  it('signed-in user cannot list stripeEvents collection', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(db.collection(`artifacts/${APP_ID}/stripeEvents`).get());
  });
});
