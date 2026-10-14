// Fase 2-testplan — persistent replay-lagring (IndexedDB), KUN meldings-ID-er.
//
// Kjører med Node's innebygde test runner:
//   node --test src/lib/e2ee/indexed-db-store.test.js
//
// IndexedDB polyfilles med `fake-indexeddb` (in-memory, persistens på tvers av
// instanser med samme dbName = simulerer reload). Hver test bruker unikt dbName.
//
// Disse testene verifiserer KUN replay-lagringslaget. Ingen sesjonsnøkler eller
// identitetsdata lagres (N8). Modulen er fortsatt ikke koblet til produksjon.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';

import { createIndexedDbStore } from './indexed-db-store.js';
import { createInMemoryStore } from './store.js';

// Gjør IndexedDB tilgjengelig for store-modulen i Node.
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const CONVO = 'convo-fase2';
const CONVO2 = 'convo-other';

// Hjelpefunksjon: åpne rå DB for å inspisere skjema (objectStoreNames).
function openRawDb(dbName, version = 1) {
  return new Promise((resolve, reject) => {
    const req = fakeIndexedDB.open(dbName, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// D1. LAGRING OG GJENFINNING ETTER GJENÅPNING AV DATABASEN
// ---------------------------------------------------------------------------

test('D1. seen-ID-er overlever lukking og gjenåpning av databasen', async () => {
  const dbName = 'test-d1';
  const store1 = createIndexedDbStore({ dbName });
  await store1.markSeen(CONVO, 'msg-a');
  await store1.markSeen(CONVO, 'msg-b');

  // Ny instans, samme dbName = "reload" (database lukket og gjenåpnet)
  const store2 = createIndexedDbStore({ dbName });
  assert.equal(await store2.hasSeen(CONVO, 'msg-a'), true, 'msg-a overlever reload');
  assert.equal(await store2.hasSeen(CONVO, 'msg-b'), true, 'msg-b overlever reload');
  assert.equal(await store2.hasSeen(CONVO, 'msg-c'), false, 'usett id er fortsatt usett');

  const seen = await store2.loadSeenSet(CONVO);
  assert.equal(seen.size, 2, 'loadSeenSet hydrerer begge ID-er');
  assert.ok(seen.has('msg-a'));
  assert.ok(seen.has('msg-b'));
});

// ---------------------------------------------------------------------------
// D2. AVVISNING AV EN ALLEREDE REGISTRERT MELDINGS-ID
// ---------------------------------------------------------------------------

test('D2. markSeen returnerer true for allerede registrert ID', async () => {
  const store = createIndexedDbStore({ dbName: 'test-d2' });
  assert.equal(await store.markSeen(CONVO, 'once'), false, 'første gang = ny (false)');
  assert.equal(await store.markSeen(CONVO, 'once'), true, 'andre gang = replay (true)');
  assert.equal(await store.markSeen(CONVO, 'twice'), false, 'annen ID = ny');
  assert.equal(await store.markSeen(CONVO, 'twice'), true, 'annen ID andre gang = replay');
  assert.equal(await store.hasSeen(CONVO, 'once'), true);
  assert.equal(await store.hasSeen(CONVO, 'missing'), false);
});

// ---------------------------------------------------------------------------
// D3. TO SAMTIDIGE REGISTRERINGSFORSØK FOR SAMME ID
// ---------------------------------------------------------------------------

test('D3. to samtidige markSeen for samme ID — nøyaktig én rapporteres som ny', async () => {
  const store = createIndexedDbStore({ dbName: 'test-d3' });
  const results = await Promise.all([
    store.markSeen(CONVO, 'dup-id'),
    store.markSeen(CONVO, 'dup-id'),
  ]);
  const newCount = results.filter((r) => r === false).length;
  const seenCount = results.filter((r) => r === true).length;
  assert.equal(newCount, 1, 'nøyaktig én rapportert som ny (false)');
  assert.equal(seenCount, 1, 'nøyaktig én rapportert som allerede sett (true)');
  assert.equal(await store.hasSeen(CONVO, 'dup-id'), true, 'ID er registrert');
});

// ---------------------------------------------------------------------------
// D4. UAVHENGIGE ID-ER I FORSKJELLIGE SAMTALER
// ---------------------------------------------------------------------------

test('D4. separate samtaler har separate ID-sett', async () => {
  const store = createIndexedDbStore({ dbName: 'test-d4' });
  await store.markSeen(CONVO, 'shared-looking-id');
  assert.equal(await store.hasSeen(CONVO, 'shared-looking-id'), true);
  // Samme msgId i en annen samtale skal IKKE sees som registrert
  assert.equal(await store.hasSeen(CONVO2, 'shared-looking-id'), false, 'ulik samtale = usett');
  await store.markSeen(CONVO2, 'shared-looking-id');
  assert.equal(await store.hasSeen(CONVO2, 'shared-looking-id'), true);

  const seen1 = await store.loadSeenSet(CONVO);
  const seen2 = await store.loadSeenSet(CONVO2);
  assert.equal(seen1.size, 1, 'CONVO har kun sine ID-er');
  assert.equal(seen2.size, 1, 'CONVO2 har kun sine ID-er');

  // clearSeen tømmer kun én samtale
  await store.clearSeen(CONVO);
  assert.equal(await store.hasSeen(CONVO, 'shared-looking-id'), false, 'CONVO tømt');
  assert.equal(await store.hasSeen(CONVO2, 'shared-looking-id'), true, 'CONVO2 uberørt');
});

// ---------------------------------------------------------------------------
// D5. HÅNDTERING AV DATABASEFEIL
// ---------------------------------------------------------------------------

test('D5a. konstruksjon uten IndexedDB kaster tydelig feil', () => {
  const saved = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  try {
    assert.throws(
      () => createIndexedDbStore({ dbName: 'test-d5a' }),
      /IndexedDB is not available/
    );
  } finally {
    globalThis.indexedDB = saved;
  }
});

test('D5b. operasjon avvises (rejects) når DB-åpning feiler', async () => {
  const saved = globalThis.indexedDB;
  const brokenIDB = {
    open() {
      const req = {
        onupgradeneeded: null, onsuccess: null, onerror: null,
        result: undefined, error: new Error('open failed'),
      };
      setTimeout(() => { if (req.onerror) req.onerror({ target: req }); }, 0);
      return req;
    },
  };
  globalThis.indexedDB = brokenIDB;
  try {
    const store = createIndexedDbStore({ dbName: 'test-d5b' });
    await assert.rejects(
      store.markSeen(CONVO, 'x'),
      (e) => /open failed/.test(e.message)
    );
  } finally {
    globalThis.indexedDB = saved;
  }
});

// ---------------------------------------------------------------------------
// D6. OPPRETTELSE OG EVENTUELL OPPGRADERING AV DATABASEN
// ---------------------------------------------------------------------------

test('D6a. fersk database oppretter kun seen-store', async () => {
  const dbName = 'test-d6a';
  const store = createIndexedDbStore({ dbName });
  await store.markSeen(CONVO, 'trigger-open');
  const db = await openRawDb(dbName, 1);
  assert.ok(db.objectStoreNames.contains('seen'), 'seen-store finnes');
  assert.equal(db.objectStoreNames.contains('sessions'), false, 'ingen sessions-store');
  assert.equal(db.objectStoreNames.contains('identity'), false, 'ingen identity-store');
  db.close();
});

test('D6b. versjonsoppgradering bevarer data og feiler ikke', async () => {
  const dbName = 'test-d6b';
  const store1 = createIndexedDbStore({ dbName, dbVersion: 1 });
  await store1.markSeen(CONVO, 'persist-me');
  await store1.close(); // lukk forbindelsen før versjonsoppgradering (ellers blokkeres open)

  // Åpne samme DB med høyere versjon — onupgradeneeded kjører (seen finnes allerede = no-op)
  const store2 = createIndexedDbStore({ dbName, dbVersion: 2 });
  assert.equal(await store2.hasSeen(CONVO, 'persist-me'), true, 'data overlever versjonsbump');
  await store2.markSeen(CONVO, 'after-upgrade');
  assert.equal(await store2.hasSeen(CONVO, 'after-upgrade'), true);
});

// ---------------------------------------------------------------------------
// D7. KOMPATIBILITET MED DEN EKSISTERENDE IN-MEMORY-STORE
// ---------------------------------------------------------------------------

test('D7. ekvivalent replay-dedup-adferd med createInMemoryStore', async () => {
  const stores = [
    { name: 'in-memory', store: createInMemoryStore() },
    { name: 'indexeddb', store: createIndexedDbStore({ dbName: 'test-d7' }) },
  ];
  for (const { name, store } of stores) {
    assert.equal(await store.markSeen(CONVO, 'm1'), false, `${name}: første = ny`);
    assert.equal(await store.markSeen(CONVO, 'm1'), true, `${name}: andre = replay`);
    assert.equal(await store.hasSeen(CONVO, 'm1'), true, `${name}: hasSeen true`);
    assert.equal(await store.hasSeen(CONVO, 'm2'), false, `${name}: hasSeen false for usett`);
    const seen = store.getSeenSet(CONVO);
    assert.ok(seen instanceof Set, `${name}: getSeenSet returnerer Set`);
    assert.ok(seen.has('m1'), `${name}: getSeenSet reflekterer markSeen`);
    await store.clearAll();
    assert.equal(await store.hasSeen(CONVO, 'm1'), false, `${name}: clearAll tømmer`);
  }
});

// ---------------------------------------------------------------------------
// D8. SESJONSNØKLER OG IDENTITETSDATA LAGRES IKKE AV DENNE REPLAY-STOREN
// ---------------------------------------------------------------------------

test('D8. ingen metoder for sesjon/identitet, kun seen-store i skjema', async () => {
  const store = createIndexedDbStore({ dbName: 'test-d8' });
  // Modulen eksponerer IKKE sesjons-/identitetsmetoder
  assert.equal(typeof store.saveSession, 'undefined', 'saveSession finnes ikke');
  assert.equal(typeof store.loadSession, 'undefined', 'loadSession finnes ikke');
  assert.equal(typeof store.saveIdentity, 'undefined', 'saveIdentity finnes ikke');
  assert.equal(typeof store.loadIdentity, 'undefined', 'loadIdentity finnes ikke');
  assert.equal(typeof store.clearIdentity, 'undefined', 'clearIdentity finnes ikke');

  // Databaseskjemaet har KUN seen-store
  await store.markSeen(CONVO, 'trigger-open');
  const db = await openRawDb('test-d8', 1);
  assert.deepEqual(Array.from(db.objectStoreNames), ['seen'], 'kun seen-store i skjema');
  db.close();
});