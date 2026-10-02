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
// Arkitektonisk forberedelse for rotasjon:
//   `deriveMessageKey(sessionState)` returnerer i MVP den statiske
//   samtalenøkkelen. Signaturen er stabil, slik at en fremtidig ratchet
//   kan returnere per-meldings nøkler uten å endre crypto.js, envelope.js
//   eller mottakerlogikk. `createSessionState` returnerer et objekt med
//   reserverte felt (chainKey, messageNumber) som MVP ikke bruker, men som
//   fase 5 kan slå på.

import { deriveSharedSecret } from './keys.js';
import { importAesKey } from './crypto.js';

const HKDF_INFO = new TextEncoder().encode('stæsj:e2ee:v1:message-key');
const HKDF_SALT = new Uint8Array(0); // tom salt; ECDH-utbyttet er allerede high-entropy

// ---------------------------------------------------------------------------
// Opprett sesjonstilstand for en samtale.
//
// Input:
//   mySecretKey:  Uint8Array(32) — min private X25519-nøkkel
//   theirPublicKey: Uint8Array(32) — motpartens offentlige X25519-nøkkel
//   conversationId: string — bindes inn i HKDF-info for samtale-isolasjon
//
// Returnerer:
//   { conversationId, conversationKey: CryptoKey, chainKey: null,
//     messageNumber: 0, rotationReady: false }
//
// `chainKey`/ `messageNumber` er reservert for fase 5 (Double Ratchet) og er
// `null`/ 0 i MVP. Dette er med vilje synlige felt, ikke skjult magi, slik at
// fremtidig rotasjonskode kan slås på uten omskriving.
// ---------------------------------------------------------------------------

export async function createSessionState({ mySecretKey, theirPublicKey, conversationId }) {
  if (!conversationId) throw new Error('conversationId is required');
  const shared = deriveSharedSecret(mySecretKey, theirPublicKey);
  const conversationKey = await deriveConversationKey(shared, conversationId);
  return {
    conversationId,
    conversationKey,
    chainKey: null, // reservert for fase 5
    messageNumber: 0, // reservert for fase 5
    rotationReady: false,
  };
}

// ---------------------------------------------------------------------------
// Avled AES-256-nøkkel fra rå ECDH-hemmelighet + conversationId via HKDF-SHA256.
//
// conversationId inngår i HKDF-info for at to parter som har flere samtaler
// ikke skal gjenbruke nøyaktig samme nøkkel på tvers av dem.
// ---------------------------------------------------------------------------

export async function deriveConversationKey(sharedSecret, conversationId) {
  const ikm = sharedSecret instanceof Uint8Array ? sharedSecret : new Uint8Array(sharedSecret);
  const baseKey = await globalThis.crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  const info = new TextEncoder().encode(`${conversationId}||${new TextDecoder().decode(HKDF_INFO)}`);
  return globalThis.crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// ---------------------------------------------------------------------------
// deriveMessageKey — stabil signatur, MVP returnerer samtalenøkkelen.
//
// I MVP: returnerer `sessionState.conversationKey` uendret for hver melding.
// I fase 5: vil ratchet chainKey → messageKey og inkrementere messageNumber,
// slik at hver melding får en unik nøkkel (forward secrecy) uten at
// mottakeren eller envelope.js må endres.
// ---------------------------------------------------------------------------

export async function deriveMessageKey(sessionState) {
  if (!sessionState?.conversationKey) {
    throw new Error('Invalid session state: missing conversationKey');
  }
  // MVP: samme nøkkel for alle meldinger. Se filhodet for caveats.
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
export { importAesKey };