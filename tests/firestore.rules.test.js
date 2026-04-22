import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

let testEnv;

describe('Firestore Rules (Shared Brackets)', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'playoff-creator-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  const APP_ID = 'test-app';

  it('permite a cualquier usuario autenticado leer un shared bracket', async () => {
    const randomDb = testEnv.authenticatedContext('random_user').firestore();
    
    // Primero, creamos el doc con bypass (usando el contexto admin)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'view',
          invites: {}
        },
        data: 'secret'
      });
    });

    const docRef = randomDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertSucceeds(docRef.get());
  });

  it('permite al owner modificar el shared bracket', async () => {
    const ownerDb = testEnv.authenticatedContext('owner123').firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'view',
          invites: {}
        }
      });
    });

    const docRef = ownerDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertSucceeds(docRef.update({ data: 'modificado' }));
  });

  it('no permite a un usuario no autenticado modificar el shared bracket', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'view',
          invites: {}
        }
      });
    });

    const docRef = unauthedDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertFails(docRef.update({ data: 'hacked' }));
  });

  it('permite modificar si linkAccess es edit y el usuario esta autenticado', async () => {
    const authedDb = testEnv.authenticatedContext('random_user').firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'edit',
          invites: {}
        }
      });
    });

    const docRef = authedDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertSucceeds(docRef.update({ data: 'modificado_por_random' }));
  });

  it('rechaza modificar si linkAccess es view y no esta en invites', async () => {
    const authedDb = testEnv.authenticatedContext('random_user', { email: 'random@test.com' }).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'view',
          invites: {}
        }
      });
    });

    const docRef = authedDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertFails(docRef.update({ data: 'modificado_por_random' }));
  });

  it('permite modificar si el email del usuario esta en invites con permiso edit', async () => {
    const authedDb = testEnv.authenticatedContext('invited_user', { email: 'invite@test.com' }).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'view',
          invites: {
            'invite@test.com': 'edit'
          }
        }
      });
    });

    const docRef = authedDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertSucceeds(docRef.update({ data: 'modificado_por_invite' }));
  });

  it('impide cambiar el ownerId al actualizar', async () => {
    const ownerDb = testEnv.authenticatedContext('owner123').firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'view',
          invites: {}
        }
      });
    });

    const docRef = ownerDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertFails(docRef.update({
      'shareConfig.ownerId': 'hacker'
    }));
  });

  it('solo permite al owner borrar el documento', async () => {
    const randomDb = testEnv.authenticatedContext('random_user').firestore();
    const ownerDb = testEnv.authenticatedContext('owner123').firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'view',
          invites: {}
        }
      });
    });

    const randomDocRef = randomDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertFails(randomDocRef.delete());

    const ownerDocRef = ownerDb.collection('artifacts').doc(APP_ID).collection('shared').doc('1234');
    await assertSucceeds(ownerDocRef.delete());
  });

  it('permite a un invitado crear presence si puede leer el doc', async () => {
    const authedDb = testEnv.authenticatedContext('random_user').firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('artifacts').doc(APP_ID).collection('shared').doc('1234').set({
        shareConfig: {
          ownerId: 'owner123',
          linkAccess: 'view',
          invites: {}
        }
      });
    });

    const presenceRef = authedDb.collection('artifacts').doc(APP_ID).collection('presence').doc('1234').collection('cursors').doc('random_user');
    await assertSucceeds(presenceRef.set({ x: 10, y: 10 }));
  });
});
