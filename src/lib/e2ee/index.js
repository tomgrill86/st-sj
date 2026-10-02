// Offentlig API-flate for STÆSJ E2EE (Fase 1: isolert kryptografisk modul).
//
// Denne modulen er bevisst holdt uten Base44, UI og nettverk, slik at den kan
// enhetstestes isolert. Se e2ee.test.js for den fullstendige testplanen
// (30 tester) og trusselmodell-dokumentasjonen i sikkerhetsrapporten.
//
// Ingenting her muterer database, RLS eller eksisterende app-logikk. Fase 2+
// (nøkkel-UI, meldingsintegrering) er separerte og krever separat godkjenning.

export {
  encrypt,
  decrypt,
  generateIV,
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
  canRotate,
} from './session.js';

export {
  buildAAD,
  sealMessage,
  openMessage,
  newMessageId,
} from './envelope.js';

export { createInMemoryStore } from './store.js';