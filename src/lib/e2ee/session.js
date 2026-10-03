// Sesjons- og nøkkelavledning.
//
// MVP-modell (Fase 1–3): "langtids-samtalenøkkel".
//   - Avledd via X25519 ECDH mellom deltakernes langtids-identitetsnøkler.
//   - HKDF-SHA-256 av det rå delte hemmeligheten → 32-byte AES-256-nøkkel.
//   - Denne nøkkelen er STABIL for hele samtalen i MVP.
//
// ⚠️ Dette er IKKE full forward secrecy. Kompromittering av langtidsnøkkelen
// i ettertid kan dekryptere all historikk. Dette dokumenteres tydelig for
// brukeren. Fase 5 (Double Ratchet) vil rotere per-meldings nøkler uten at
// denne modulens signatur endres.
//
// REVIDERT FASE 1 — HKDF-kontekst binding:
//   HKDF-info binder nå KANONISK:
//     - protokollversjon ("stæsj:e2ee:v1")
//     - formål ("message-key")
//     - conversationId
//     - BEGGE offentlige nøkler (sortert base64) — hindrer at samme ECDH-
//       utbytte gjenbrukes på tvers av identiteter/rotasjoner
//     - BEGGE bruker-ID-er (sortert) — binder nøkkelen til deltakerne
//   Kanonisk sortering (lo/hi etter base64) garanterer at begge parter avleder
//   identisk info uavhengig av hvem som initierer.
//
// Arkitektonisk forberedelse for rotasjon:
//   `deriveMessageKey(sessionState)` returnerer i MVP den statiske
//   samtalenøkkelen. Signaturen er stabil, slik at en fremtidig ratchet
//   kan returnere per-meldings nøkler uten å endre crypto.js, envelope.js
//   eller mottakerlogikk. `createSessionState` returnerer et objekt med
//   reserverte felt (chainKey, messageNumber) som MVP ikke bruker, men som
//   fase 5 kan slå på.

import { deriveSharedSecret, publicKeyToBase64 } from './keys.js';
import { importAesKey } from './crypto.js';

const PROTOCOL_VERSION = 'stæsj:e2ee:v1';
const HKDF_PURPOSE = 'message-key';
const HKDF_SALT = new Uint8Array(0); // tom salt; ECDH-utbyttet er allerede high-entropy
const textEncoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Opprett sesjonstilstand for en samtale.
//
// Input:
//   mySecretKey:   Uint8Array(32) — min private X25519-nøkkel
//   myPublicKey:   Uint8Array(32) — min offentlige X25519-nøkkel (for HKDF-info)
//   theirPublicKey:Uint8Array(32) — motpartens offentlige X25519-nøkkel
//   conversationId:string — bindes inn i HKDF-info for samtale-isolasjon
//   myUserId:      string — min bruker-ID (for HKDF-info)
//   theirUserId:   string — motpartens bruker-ID (for HKDF-info)
//
// Returnerer:
//   { conversationId, conversationKey: CryptoKey, chainKey: null,
//     messageNumber: 0, rotationReady: false }
//
// `chainKey`/ `messageNumber` er reservert for fase 5 (Double Ratchet) og er
// `null`/ 0 i MVP. Dette er med vilje synlige felt, ikke skjult magi, slik at
// fremtidig rotasjonskode kan slås på uten omskriving.
// ---------------------------------------------------------------------------

export async function createSessionState({ mySecretKey, myPublicKey, theirPublicKey, conversationId, myUserId, theirUserId }) {
  if (!conversationId) throw new Error('conversationId is required');
  if (!myUserId) throw new Error('myUserId is required');
  if (!theirUserId) throw new Error('theirUserId is required');
  if (!(myPublicKey instanceof Uint8Array) || myPublicKey.length !== 32) {
    throw new Error('myPublicKey must be Uint8Array(32)');
  }
  const shared = deriveSharedSecret(mySecretKey, theirPublicKey);
  const conversationKey = await deriveConversationKey(shared, {
    conversationId,
    myPublicKey,
    theirPublicKey,
    myUserId,
    theirUserId,
  });
  return {
    conversationId,
    conversationKey,
    chainKey: null, // reservert for fase 5
    messageNumber: 0, // reservert for fase 5
    rotationReady: false,
  };
}

// ---------------------------------------------------------------------------
// Avled AES-256-nøkkel fra rå ECDH-hemmelighet + kanonisk kontekst via
// HKDF-SHA256.
//
// HKDF-info bygges ENTYDIG og KANONISK (se buildHKDFInfo):
//   protokollversjon ‖ formål ‖ conversationId ‖ pubKey_lo ‖ pubKey_hi ‖ userId_lo ‖ userId_hi
// hvor lo/hi er sortert slik at begge parter avleder likt uavhengig av retning.
// ---------------------------------------------------------------------------

export async function deriveConversationKey(sharedSecret, ctx) {
  const ikm = sharedSecret instanceof Uint8Array ? sharedSecret : new Uint8Array(sharedSecret);
  const baseKey = await globalThis.crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  const info = buildHKDFInfo(ctx);
  return globalThis.crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// ---------------------------------------------------------------------------
// Bygg kanonisk, entydig HKDF-info-streng.
//
// Feltene skilles med ASCII 0x1F (Unit Separator) — et tegn som ikke kan
// opptre i base64 eller vanlige ID-strenger — og protokollversjonen står
// først. Begge public keys og begge user-ID-er sorteres kanonisk (lo/hi),
// slik at Alice→Bob og Bob→Alice produserer identisk info → identisk nøkkel.
// ---------------------------------------------------------------------------

export function buildHKDFInfo({ conversationId, myPublicKey, theirPublicKey, myUserId, theirUserId }) {
  const pubLo = publicKeyToBase64(myPublicKey) < publicKeyToBase64(theirPublicKey)
    ? myPublicKey : theirPublicKey;
  const pubHi = pubLo === myPublicKey ? theirPublicKey : myPublicKey;
  const [userLo, userHi] = [myUserId, theirUserId].sort();
  const parts = [
    PROTOCOL_VERSION,
    HKDF_PURPOSE,
    conversationId,
    publicKeyToBase64(pubLo),
    publicKeyToBase64(pubHi),
    userLo,
    userHi,
  ];
  return textEncoder.encode(parts.join('\x1F'));
}

// ---------------------------------------------------------------------------
// deriveMessageKey — stabil signatur, MVP returnerer samtalenøkkelen.
// ---------------------------------------------------------------------------

export async function deriveMessageKey(sessionState) {
  if (!sessionState?.conversationKey) {
    throw new Error('Invalid session state: missing conversationKey');
  }
  return sessionState.conversationKey;
}

// ---------------------------------------------------------------------------
// canRotate — flagg som indikerer om sesjonen støtter nøkkelrotasjon.
// MVP returnerer alltid false. Fasilitativ hook for UI/ tester.
// ---------------------------------------------------------------------------

export function canRotate(sessionState) {
  return sessionState?.rotationReady === true;
}

// Re-eksporter for tester som trenger å inspisere den rå nøkkelen.
export { importAesKey, PROTOCOL_VERSION };