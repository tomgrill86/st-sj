// Fase 2 — persistent replay-lagring for E2EE (KUN behandlede meldings-ID-er).
//
// createIndexedDbStore() lagrer seen-message-ID-er (replay-dedup) i IndexedDB,
// slik at dedup-settet overlever reload / ny fane. Dette er den ENESTE
// ansvarsområdet for denne fasen.
//
// IKKE INKLUDERT (utenfor godkjent Fase 2-omfang):
//   - saveSession / loadSession      (sesjonshemmeligheter — ikke godkjent)
//   - saveIdentity / loadIdentity    (identitets-blob — ikke godkjent)
//   In-memory-store (store.js) beholder disse metodene for Fase 1-tester;
//   IndexedDB-storen eksponerer dem IKKE. Ingenting avhenger av dem her
//   (modulen er isolert, ikke koblet til produksjon), så ingen API brytes.
//
// ATOMISK REGISTRERING:
//   markSeen utfører kontroll (get) og registrering (put) i ÉN readwrite-
//   transaksjon. IndexedDB serialiserer readwrite-transaksjoner på samme
//   object store, så to samtidige markSeen for samme [convId, msgId]:
//     - transaksjon A: get -> ikke funnet -> put -> commit
//     - transaksjon B (serialisert etter A): get -> funnet -> allerede sett
//   Nøyaktig én returnerer false (ny), den andre true (replay).
//
// GRENSESNITT (kompatibelt med createInMemoryStore for replay-dedup):
//   async markSeen(convId, msgId)   -> boolean (true = allerede sett)
//   async hasSeen(convId, msgId)    -> boolean (autoritativ fra IndexedDB)
//   getSeenSet(convId)             -> Set (synk; cache — hydrer via loadSeenSet)
//   async loadSeenSet(convId)      -> Set (hydrer cache fra IndexedDB)
//   async clearSeen(convId)
//   async clearAll()
//
// getSeenSet er SYNK og returnerer en lokal cache. For at cache skal reflektere
// persistert tilstand MÅ loadSeenSet kalles først. Autoritative sjekker
// (markSeen/hasSeen) spør alltid IndexedDB og er ikke avhengige av cache.

function openDB(indexedDB, dbName, dbVersion) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('seen')) {
        db.createObjectStore('seen', { keyPath: ['conversation_id', 'message_id'] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIndexedDbStore({ dbName = 'staejs-e2ee', dbVersion = 1 } = {}) {
  const indexedDB = globalThis.indexedDB;
  const IDBKeyRange = globalThis.IDBKeyRange;
  if (!indexedDB) {
    throw new Error('createIndexedDbStore: IndexedDB is not available in this environment');
  }

  let dbPromise = null;
  const cache = new Map(); // convId -> Set<msgId> (read-cache for getSeenSet)

  function getDb() {
    if (!dbPromise) dbPromise = openDB(indexedDB, dbName, dbVersion);
    return dbPromise;
  }

  // Les alle message_id-er for én samtale (compound-key range-prefix).
  function readSeenIds(db, convId) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('seen', 'readonly');
      const store = tx.objectStore('seen');
      const range = IDBKeyRange.bound([convId, ''], [convId, '\uffff'], false, false);
      const req = store.openCursor(range);
      const ids = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) { ids.push(cursor.value.message_id); cursor.continue(); }
        else resolve(ids);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function ensureCache(convId) {
    if (cache.has(convId)) return cache.get(convId);
    const db = await getDb();
    const ids = await readSeenIds(db, convId);
    const set = new Set(ids);
    cache.set(convId, set);
    return set;
  }

  return {
    // Atomisk: get + put i én readwrite-transaksjon.
    async markSeen(convId, msgId) {
      const db = await getDb();
      const alreadySeen = await new Promise((resolve, reject) => {
        const tx = db.transaction('seen', 'readwrite');
        const store = tx.objectStore('seen');
        let seen = false;
        const getReq = store.get([convId, msgId]);
        getReq.onsuccess = () => {
          if (getReq.result) {
            seen = true;
          } else {
            store.put({ conversation_id: convId, message_id: msgId, seen_at: Date.now() });
          }
        };
        tx.oncomplete = () => resolve(seen);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      let set = cache.get(convId);
      if (!set) { set = new Set(); cache.set(convId, set); }
      set.add(msgId);
      return alreadySeen;
    },

    // Autoritativ sjekk direkte mot IndexedDB (ikke cache).
    async hasSeen(convId, msgId) {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('seen', 'readonly');
        const req = tx.objectStore('seen').get([convId, msgId]);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => reject(req.error);
      });
    },

    getSeenSet(convId) {
      let set = cache.get(convId);
      if (!set) { set = new Set(); cache.set(convId, set); }
      return set;
    },

    async loadSeenSet(convId) {
      return await ensureCache(convId);
    },

    async clearSeen(convId) {
      const db = await getDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('seen', 'readwrite');
        const store = tx.objectStore('seen');
        const range = IDBKeyRange.bound([convId, ''], [convId, '\uffff'], false, false);
        const req = store.openCursor(range);
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) { cursor.delete(); cursor.continue(); }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      cache.delete(convId);
    },

    async clearAll() {
      const db = await getDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('seen', 'readwrite');
        tx.objectStore('seen').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      cache.clear();
    },

    // Lukk DB-forbindelsen (frigjør ressurs, tillat versjonsoppgradering).
    async close() {
      if (dbPromise) {
        const db = await dbPromise;
        db.close();
        dbPromise = null;
      }
      cache.clear();
    },
  };
}