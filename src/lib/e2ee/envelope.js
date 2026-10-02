// Meldingskuvert — binder kontekst til chifferteksten og håndterer replay.
//
// En kuvert består av:
//   - message_id:      UUID generert per melding (dedup-nøkkel)
//   - sequence_number: monoton per avsender per samtale
//   - conversation_id:  hvilken samtale meldingen hører til
//   - sender_id:       hvem som sendte meldingen
//   - ratchet_header:  reservert for fase 5 (Double Ratchet) — tom i MVP
//   - iv, ciphertext, version: fra crypto.encrypt
//
// AAD (Additional Authenticated Data) settes sammen deterministisk:
//   `${conversation_id}||${sender_id}||${message_id}||${sequence_number}`
//
// AES-GCM autentiserer AAD. Dette betyr:
//   - Endres message_id i AAD → tag mismatch → avvis (test 11).
//   - En ciphertext kan ikke "flyttes" til en annen message_id (test 13).
//   - Endres conversation_id eller sender_id → avvis (test 8, 9).
//
// REPLAY-BESKYTTELSE:
//   AES-GCM + AAD forhindrer manipulasjon, men ikke replay av en tidligere
//   gyldig kuvert. `verifyAndAccept` sjekker derfor message_id mot et
//   dedup-sett (forvaltet av store.js) og avviser allerede behandlede
//   meldinger. Dette gjøres klient-side hos mottakeren — serveren kan ikke
//   se message_id-semantikk uten innholdsanalyse (forbudt i trusselmodellen).

import { encrypt, decrypt, generateIV, bytesToBase64, base64ToBytes } from './crypto.js';

const textEncoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Bygg AAD-streng deterministisk. Rekkefølgen er kontrakt — mottakeren må
// bruke nøyaktig samme streng ved dekryptering, ellers feiler taggen.
// ---------------------------------------------------------------------------

export function buildAAD({ conversation_id, sender_id, message_id, sequence_number }) {
  return `${conversation_id}||${sender_id}||${message_id}||${sequence_number}`;
}

// ---------------------------------------------------------------------------
// Pakk en melding: generer message_id + sequence, krypter, returner kuvert.
//
// Input:
//   { conversation_id, sender_id, sequence_number, plaintext, key,
//     seenIvSet? }
//
// `message_id` genereres med crypto.randomUUID hvis ikke oppgitt (testbar).
// ---------------------------------------------------------------------------

export async function sealMessage({ conversation_id, sender_id, sequence_number, plaintext, key, message_id, seenIvSet }) {
  if (!conversation_id) throw new Error('conversation_id required');
  if (!sender_id) throw new Error('sender_id required');
  if (sequence_number == null) throw new Error('sequence_number required');
  const mid = message_id || newMessageId();
  const aad = buildAAD({ conversation_id, sender_id, message_id: mid, sequence_number });
  const enc = await encrypt(plaintext, key, aad, generateIV(seenIvSet));
  return {
    message_id: mid,
    sequence_number,
    conversation_id,
    sender_id,
    ratchet_header: '', // reservert for fase 5
    iv: enc.iv,
    ciphertext: enc.ciphertext,
    version: enc.version,
  };
}

// ---------------------------------------------------------------------------
// Åpne en kuvert: verifiser kontekst, dekrypter, og dedup-sjekk.
//
// Input:
//   envelope, expectedConversationId, expectedSenderId, key, seenMessageIds (Set)
//
// Steg:
//   1. Kontekst-sjekk: conversation_id/ sender_id i kuverten må matche
//      forventet. (Test 15, 16.)
//   2. AAD bygges og dekryptering kjøres. Manipulert AAD eller ciphertext
//      → tag mismatch → avvis. (Test 5–11.)
//   3. Dedup: message_id må ikke være i seenMessageIds. (Test 12, 13, 14.)
//      Ved første aksept legges message_id til i settet av calleren.
//
// Returnerer: { plaintext, message_id, sequence_number, replay: false }
// Kaster ved avvisning med `.code`-felt:
//   'WRONG_CONVERSATION', 'WRONG_SENDER', 'DECRYPT_FAILED', 'REPLAY'
// ---------------------------------------------------------------------------

export async function openMessage({ envelope, expectedConversationId, expectedSenderId, key, seenMessageIds }) {
  if (envelope.conversation_id !== expectedConversationId) {
    const e = new Error('conversation_id mismatch');
    e.code = 'WRONG_CONVERSATION';
    throw e;
  }
  if (envelope.sender_id !== expectedSenderId) {
    const e = new Error('sender_id mismatch');
    e.code = 'WRONG_SENDER';
    throw e;
  }
  if (seenMessageIds && seenMessageIds.has(envelope.message_id)) {
    const e = new Error(`Replay detected: message_id ${envelope.message_id} already processed`);
    e.code = 'REPLAY';
    e.message_id = envelope.message_id;
    throw e;
  }
  const aad = buildAAD({
    conversation_id: envelope.conversation_id,
    sender_id: envelope.sender_id,
    message_id: envelope.message_id,
    sequence_number: envelope.sequence_number,
  });
  const plaintext = await decrypt({ iv: envelope.iv, ciphertext: envelope.ciphertext }, key, aad);
  if (seenMessageIds) seenMessageIds.add(envelope.message_id);
  return {
    plaintext,
    message_id: envelope.message_id,
    sequence_number: envelope.sequence_number,
    replay: false,
  };
}

// ---------------------------------------------------------------------------
// newMessageId — tynnbart for tester. Standard er crypto.randomUUID.
// ---------------------------------------------------------------------------

export function newMessageId() {
  return globalThis.crypto.randomUUID();
}

// Re-eksporter primitiver som tester/ fremtidig kode trenger.
export { generateIV, bytesToBase64, base64ToBytes };