// Fase 2-testplan — persistent replay-lagring (IndexedDB).
//
// Kjører med Node's innebygde test runner:
//   node --test src/lib/e2ee/indexed-db-store.test.js
//
// IndexedDB polyfilles med `fake-indexeddb` (in-memory, persistens på tvers av
// instanser med samme dbName — simulerer reload). Hver test bruker unikt
// dbName for isolasjon.
//
// Disse testene verifiserer KUN lagringslaget. Modulen er fortsatt ikke
// koblet til produksjonsmeldinger.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeIndexedDB, FDBKeyRange } from 'fake-indexeddb';

import { createIndexedDbStore } from './indexed-db-store.js';
import {
  generateIdentityKeyPair,
  createSessionState,
  deriveMessageKey,
  sealMessage,
  openMessage,
} from './index.js';

// Gjør IndexedDB tilgjengelig for store-modulen i Node.
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = FDBKeyRange;

const CONVO = 'convo-fase2';
const CONVO2 = 'convo-other';
const ALICE = 'user-alice';
const BOB = 'user-bob';

const A = generateIdentityKeyPair();
const B = generateIdentityKeyPair();

async function makeSession(convo = CONVO) {
  return {
    alice: await createSessionState({
      mySecretKey: A.secretKey, myPublicKey: A.publicKey, theirPublicKey: B.publicKey,
      conversationId: convo, myUserId: ALICE, theirUserId: BOB,
    }),
    bob: await createSessionState({
      mySecretKey: B.secretKey, myPublicKey: B.publicKey, theirPublicKey: A.publicKey,
      conversationId: convo, myUserId: BOB, theirUserId: ALICE,
    }),
  };
}

// ---------------------------------------------------------------------------
// N. INDEXEDDB-PERSISTENT REPLAY-LAGRING
// ---------------------------------------------------------------------------

test('N1. markSeen returnerer false første gang, true ved repetisjon', async () => {
  const store = createIndexedDbStore({ dbName: 'test-n1' });
  assert.equal(await store.markSeen(CONVO, 'm1'), false);
  assert.equal(await store.markSeen(CONVO, 'm1'), true);
  assert.equal(await store.markSeen(CONVO, 'm2'), false);
  assert.equal(await store.hasSeen(CONVO, 'm1'), true);
  assert.equal(await store.hasSeen(CONVO, 'm2'), true);
  assert.equal(await store.hasSeen(CONVO, 'm3'), false);
});

test('N2. persistens på tvers av instanser (simulert reload)', async () => {
  const dbName = 'test-n2';
  const store1 = createIndexedDbStore({ dbName });
  await store1.markSeen(CONVO, 'msg-a');
  await store1.markSeen(CONVO, 'msg-b');

  // Ny instans, samme DB = "reload"
  const store2 = createIndexedDbStore({ dbName });
  assert.equal(await store2.hasSeen(CONVO, 'msg-a'), true, 'msg-a overlever reload');
  assert.equal(await store2.hasSeen(CONVO, 'msg-b'), true, 'msg-b overlever reload');
  assert.equal(await store2.hasSeen(CONVO, 'msg-c'), false, 'usett id er fortsatt usett');
});

test('N3. loadSeenSet hydrerer cache fra IndexedDB', async () => {
  const dbName = 'test-n3';
  const store1 = createIndexedDbStore({ dbName });
  await store1.markSeen(CONVO, 'x1');
  await store1.markSeen(CONVO, 'x2');
  await store1.markSeen(CONVO2, 'y1');

  const store2 = createIndexedDbStore({ dbName });
  const seenConv = await store2.loadSeenSet(CONVO);
  assert.ok(seenConv.has('x1'));
  assert.ok(seenConv.has('x2'));
  assert.equal(seenConv.size, 2, 'kun ID-er for denne samtalen hydreres');

  const seenOther = await store2.loadSeenSet(CONVO2);
  assert.ok(seenOther.has('y1'));
  assert.equal(seenOther.size, 1);
});

test('N4. dedup overlever reload — persistSeen + openMessage', async () => {
  const dbName = 'test-n4';
  const { alice, bob } = await makeSession();
  const aliceKey = await deriveMessageKey(alice);
  const bobKey = await deriveMessageKey(bob);

  // Første økt: Alice sender, Bob mottar og persisterer
  const store1 = createIndexedDbStore({ dbName });
  const env = await sealMessage({
    conversation_id: CONVO, sender_id: ALICE, sequence_number: 1,
    plaintext: 'hei bob', key: aliceKey, message_id: 'msg-1',
  });
  const seen1 = await store1.loadSeenSet(CONVO);
  const opened = await openMessage({
    envelope: env, expectedConversationId: CONVO, expectedSenderId: ALICE,
    key: bobKey, seenMessageIds: seen1,
  });
  assert.equal(opened.plaintext, 'hei bob');
  await store1.persistSeen(CONVO, env.message_id);

  // Andre økt (reload): ny store, samme DB — dedup-sett hydreres
  const store2 = createIndexedDbStore({ dbName });
  const seen2 = await store2.loadSeenSet(CONVO);
  assert.ok(seen2.has('msg-1'), 'persistert id hydrert etter reload');
  // Replay av samme kuvert → avvises
  await assert.rejects(
    openMessage({
      envelope: env, expectedConversationId: CONVO, expectedSenderId: ALICE,
      key: bobKey, seenMessageIds: seen2,
    }),
    (e) => e.code === 'REPLAY'
  );
});

test('N5. saveSession / loadSession round-trip + persistens', async () => {
  const dbName = 'test-n5';
  const { alice } = await makeSession();
  const state = { conversationKey: alice.conversationKey, messageNumber: 7, rotationReady: false };
  const store1 = createIndexedDbStore({ dbName });
  await store1.saveSession(CONVO, state);

  const store2 = createIndexedDbStore({ dbName });
  const loaded = await store2.loadSession(CONVO);
  assert.deepEqual(loaded, state, 'sesjon overlever reload');
  assert.equal(await store2.loadSession(CONVO2), null, 'ukjent samtale gir null');
});

test('N6. saveIdentity / loadIdentity / clearIdentity', async () => {
  const dbName = 'test-n6';
  const blob = { salt: 'abc', ciphertext: 'hemmelig' };
  const store1 = createIndexedDbStore({ dbName });
  await store1.saveIdentity(blob);
  assert.equal(await store1.loadIdentity(), null, 'samme instans returnerer ikke cachet blob (persistens kun IDB)');
  const store2 = createIndexedDbStore({ dbName });
  const loaded = await store2.loadIdentity();
  assert.deepEqual(loaded, blob, 'identitet overlever reload');
  await store2.clearIdentity();
  const store3 = createIndexedDbStore({ dbName });
  assert.equal(await store3.loadIdentity(), null, 'identitet slettet');
});

test('N7. clearAll tømmer seen + sessions + identity', async () => {
  const dbName = 'test-n7';
  const store1 = createIndexedDbStore({ dbName });
  await store1.markSeen(CONVO, 'a');
  await store1.saveSession(CONVO, { foo: 1 });
  await store1.saveIdentity({ x: 1 });
  await store1.clearAll();

  const store2 = createIndexedDbStore({ dbName });
  assert.equal(await store2.hasSeen(CONVO, 'a'), false);
  assert.equal(await store2.loadSession(CONVO), null);
  assert.equal(await store2.loadIdentity(), null);
});

test('N8. clearSeen tømmer kun én samtale', async () => {
  const dbName = 'test-n8';
  const store1 = createIndexedDbStore({ dbName });
  await store1.markSeen(CONVO, 'a');
  await store1.markSeen(CONVO, 'b');
  await store1.markSeen(CONVO2, 'c');
  await store1.clearSeen(CONVO);

  const store2 = createIndexedDbStore({ dbName });
  assert.equal(await store2.hasSeen(CONVO, 'a'), false, 'CONVO tømt');
  assert.equal(await store2.hasSeen(CONVO, 'b'), false, 'CONVO tømt');
  assert.equal(await store2.hasSeen(CONVO2, 'c'), true, 'CONVO2 uberørt');
});

test('N9. getSeenSet returnerer live cache-sett; persistSeen holder det synkronisert', async () => {
  const dbName = 'test-n9';
  const store1 = createIndexedDbStore({ dbName });
  await store1.markSeen(CONVO, 'g1');
  const live = store1.getSeenSet(CONVO);
  assert.ok(live instanceof Set);
  assert.ok(live.has('g1'), 'cache reflekterer markSeen');

  const store2 = createIndexedDbStore({ dbName });
  const seen2 = await store2.loadSeenSet(CONVO);
  await store2.persistSeen(CONVO, 'g2');
  const live2 = store2.getSeenSet(CONVO);
  assert.ok(live2.has('g2'), 'persistSeen oppdaterer live cache');

  const store3 = createIndexedDbStore({ dbName });
  assert.equal(await store3.hasSeen(CONVO, 'g2'), true, 'persistSeen skrev til IDB');
});