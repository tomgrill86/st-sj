// Offentlig API-flate for STÆSJ E2EE (Fase 1: isolert kryptografisk modul).
//
// Denne modulen er bevisst holdt uten Base44, UI og nettverk, slik at den kan
// enhetstestes isolert. Se e2ee.test.js for den fullstendige testplanen
// og trusselmodell-dokumentasjonen i sikkerhetsrapporten.
//
// REVIDERT FASE 1:
//   `generateIV` er IKKE lenger eksportert i det offentlige API-et. IV
//   genereres ALLTID internt av `encrypt()` med CSPRNG — ingen caller-styrt
//   nonce eksponeres. (Test-seam for IV-kollisjon bor kun i test-filen.)
//
// Ingenting her muterer database, RLS eller eksisterende app-logikk. Fase 2+
// (nøkkel-UI, meldingsintegrering, IndexedDB-replay-state) er separerte og
// krever separat godkjenning.

export {
  encrypt,
  decrypt,
  importAesKey,
  exportRaw,
  bytesToBase64,
  base64ToBytes,
} from './crypto.js';

export {
  generateIdentityKeyPair,
  deriveSharedSecret,
  derivePasswordKey,
  generateSalt,
  encryptPrivateKey,
  decryptPrivateKey,
  publicKeyToBase64,
  publicKeyFromBase64,
  ARGON2_PARAMS,
} from './keys.js';

export {
  createSessionState,
  deriveConversationKey,
  deriveMessageKey,
  buildHKDFInfo,
  canRotate,
  PROTOCOL_VERSION,
} from './session.js';

export {
  buildAAD,
  sealMessage,
  openMessage,
  newMessageId,
} from './envelope.js';

export { createInMemoryStore } from './store.js';
export { createIndexedDbStore } from './indexed-db-store.js';