// Lagringsgrensesnitt for E2EE-tilstand.
//
// Fase 1 bruker en enkel, injiserbar lagringsabstraksjon — IKKE hardbundet
// til IndexedDB — slik at modulen kan enhetstestes i ren Node uten jsdom.
// Grensesnittet er likevel formet som IndexedDB-motstykket, slik at Fase 2
// kan bytte inn en ekte IndexedDB-implementasjon uten å endre callere.
//
// To ansvarsområder:
//   1. seenMessageIds (per samtale) — for replay-deduplikering.
//   2. sessionState (per samtale) — samtalenøkkel + kjedetilstand.
//   3. identityKey (per bruker) — kryptert privat nøkkel-blob.
//
// `createInMemoryStore()` returnerer et objekt som tilfredsstiller dette
// grensesnittet og brukes av testerne. Fase 2 vil levere
// `createIndexedDbStore()` med samme metoder.

export function createInMemoryStore() {
  const seenByConversation = new Map(); // conversationId -> Set<messageId>
  const sessions = new Map(); // conversationId -> sessionState
  let identityBlob = null; // kryptert privat-nøkkel-blob

  return {
    async markSeen(conversationId, messageId) {
      let set = seenByConversation.get(conversationId);
      if (!set) { set = new Set(); seenByConversation.set(conversationId, set); }
      const already = set.has(messageId);
      set.add(messageId);
      return already; // true = var allerede sett (replay-signal)
    },
    async hasSeen(conversationId, messageId) {
      const set = seenByConversation.get(conversationId);
      return set ? set.has(messageId) : false;
    },
    getSeenSet(conversationId) {
      let set = seenByConversation.get(conversationId);
      if (!set) { set = new Set(); seenByConversation.set(conversationId, set); }
      return set;
    },
    async saveSession(conversationId, sessionState) {
      sessions.set(conversationId, sessionState);
    },
    async loadSession(conversationId) {
      return sessions.get(conversationId) || null;
    },
    async saveIdentity(blob) { identityBlob = blob; },
    async loadIdentity() { return identityBlob; },
    async clearIdentity() { identityBlob = null; },
    async clearAll() {
      seenByConversation.clear();
      sessions.clear();
      identityBlob = null;
    },
  };
}