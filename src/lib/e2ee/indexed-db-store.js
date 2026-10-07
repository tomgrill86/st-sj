// Fase 2 — persistent replay-lagring for E2EE.
//
// createIndexedDbStore() implementerer samme grensesnitt som
// createInMemoryStore(), men persisterer seen-message-ID-er (replay-dedup),
// sesjonstilstand og identitets-blob i IndexedDB, slik at dedup-settet
// overlever reload / ny fane.
//
// VIKTIG: Modulen er fortsatt ISOLERT — den kobles IKKE til produksjons-
// meldinger. Nøkkelautentisering (key-change notification + identity
// verification) og multi-device-modellen spesifiseres før integrering
// (post-Fase 2). Dette er kun lagringslaget.
//
// Grensesnitt (kompatibelt med createInMemoryStore):
//   async markSeen(convId, msgId)        -> boolean (allerede sett?)
//   async hasSeen(convId, msgId)         -> boolean
//   getSeenSet(convId)                  -> Set (synk; hydrer via loadSeenSet)
//   async loadSeenSet(convId)           -> Set (hydrer cache fra IndexedDB)
//   async persistSeen(convId, msgId)    (skriver én ID til IndexedDB)
//   async saveSession / loadSession
//   async saveIdentity / loadIdentity / clearIdentity
//   async clearAll / async clearSeen(convId)
//
// Integrasjonsmønster med openMessage (se indexed-db-store.test.js N4):
//   const seen = await store.loadSeenSet(convId);
//   await openMessage({ ..., seenMessageIds: seen });      // muterer seen in-memory
//   await store.persistSeen(convId, envelope.message_id);  // persister til IDB
//
// getSeenSet er SYNK og returnerer cache-raden. For at persistens skal virke
// MÅ calleren hydrere med loadSeenSet FØR getSeenSet brukes, ellers returneres
// et tomt sett og dedup går tapt ved neste reload.

function openDB(indexedDB, dbName, dbVersion) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('seen')) {
        db.createObjectStore('seen', { keyPath: ['conversation_id', 'message_id'] });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'conversation_id' });
      }
      if (!db.objectStoreNames.contains('identity')) {
        db.createObjectStore('identity', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txToPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function createIndexedDbStore({ dbName = 'staejs-e2ee', dbVersion = 1 } = {}) {
  const indexedDB = globalThis.indexedDB;
  const IDBKeyRange = globalThis.IDBKeyRange;
  if (!indexedDB) {
    throw new Error('createIndexedDbStore: IndexedDB is not available in this environment');
  }

  let dbPromise = null;
  const cache = new Map(); // convId -> Set<msgId>
  const loaded = new Set(); // hydrerte convId-er

  function getDb() {
    if (!dbPromise) dbPromise = openDB(indexedDB, dbName, dbVersion);
    return dbPromise;
  }

  // Samle alle message_id-er for én samtale fra IndexedDB (compound-key range).
  function readSeenIds(db, convId) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('seen', 'readonly');
      const store = tx.objectStore('seen');
      const range = IDBKeyRange.bound([convId, ''], [convId, '\uffff'], false, false);
      const req = store.openCursor(range);
      const ids = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          ids.push(cursor.value.message_id);
          cursor.continue();
        } else {
          resolve(ids);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function ensureLoaded(convId) {
    if (loaded.has(convId)) return cache.get(convId) || null;
    const db = await getDb();
    const ids = await readSeenIds(db, convId);
    const set = new Set(ids);
    cache.set(convId, set);
    loaded.add(convId);
    return set;
  }

  return {
    async markSeen(convId, msgId) {
      const set = await ensureLoaded(convId);
      if (set.has(msgId)) return true;
      set.add(msgId);
      const db = await getDb();
      const tx = db.transaction('seen', 'readwrite');
      tx.objectStore('seen').put({ conversation_id: convId, message_id: msgId, seen_at: Date.now() });
      await txToPromise(tx);
      return false;
    },

    async hasSeen(convId, msgId) {
      const set = await ensureLoaded(convId);
      return set.has(msgId);
    },

    getSeenSet(convId) {
      let set = cache.get(convId);
      if (!set) { set = new Set(); cache.set(convId, set); }
      return set;
    },

    async loadSeenSet(convId) {
      return await ensureLoaded(convId);
    },

    async persistSeen(convId, msgId) {
      const set = await ensureLoaded(convId);
      set.add(msgId);
      const db = await getDb();
      const tx = db.transaction('seen', 'readwrite');
      tx.objectStore('seen').put({ conversation_id: convId, message_id: msgId, seen_at: Date.now() });
      await txToPromise(tx);
    },

    async saveSession(convId, sessionState) {
      const db = await getDb();
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({ conversation_id: convId, sessionState });
      await txToPromise(tx);
    },

    async loadSession(convId) {
      const db = await getDb();
      const tx = db.transaction('sessions', 'readonly');
      const result = await reqToPromise(tx.objectStore('sessions').get(convId));
      return result ? result.sessionState : null;
    },

    async saveIdentity(blob) {
      const db = await getDb();
      const tx = db.transaction('identity', 'readwrite');
      tx.objectStore('identity').put({ id: 'default', blob });
      await txToPromise(tx);
    },

    async loadIdentity() {
      const db = await getDb();
      const tx = db.transaction('identity', 'readonly');
      const result = await reqToPromise(tx.objectStore('identity').get('default'));
      return result ? result.blob : null;
    },

    async clearIdentity() {
      const db = await getDb();
      const tx = db.transaction('identity', 'readwrite');
      tx.objectStore('identity').delete('default');
      await txToPromise(tx);
    },

    async clearSeen(convId) {
      const db = await getDb();
      const tx = db.transaction('seen', 'readwrite');
      const store = tx.objectStore('seen');
      const range = IDBKeyRange.bound([convId, ''], [convId, '\uffff'], false, false);
      await new Promise((resolve, reject) => {
        const req = store.openCursor(range);
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) { cursor.delete(); cursor.continue(); }
          else resolve();
        };
        req.onerror = () => reject(req.error);
      });
      await txToPromise(tx);
      cache.delete(convId);
      loaded.delete(convId);
    },

    async clearAll() {
      const db = await getDb();
      const tx = db.transaction(['seen', 'sessions', 'identity'], 'readwrite');
      tx.objectStore('seen').clear();
      tx.objectStore('sessions').clear();
      tx.objectStore('identity').clear();
      await txToPromise(tx);
      cache.clear();
      loaded.clear();
    },
  };
}