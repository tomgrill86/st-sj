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
// REVIDERT FASE 1 — AAD er nå ENTYDIG og VERSJONERT:
//   Tidligere: `${conversation_id}||${sender_id}||${message_id}||${sequence_number}`
//   (sårbar for kollisjon dersom et felt inneholdt "|").
//
//   Nå: et versjonert, lengde-prefiksert format. Hvert felt kodes som
//   `<varint-lengde>:<utf8-verdi>` der lengden er feltets byte-lengde som
//   desimal-streng, etterfulgt av ':' og verdi-byte. Feltene skilles med
//   ASCII 0x1F (Unit Separator). En 1-byte versjonstegn-prefiks ("v1\x1F")
//   gjør formatet fremtidig-kompatibelt.
//
//   Dette er kollisjonsfritt: lengde-prefiksen gjør at verdi-med-skilletegn
//   aldri kan tolkes som to felt. (Se test av entydig koding.)
//
// AES-GCM autentiserer AAD. Dette betyr:
//   - Endres message_id i AAD → tag mismatch → avvis.
//   - En ciphertext kan ikke "flyttes" til en annen message_id (test).
//   - Endres conversation_id eller sender_id → avvis.
//
// REPLAY-BESKYTTELSE:
//   AES-GCM + AAD forhindrer manipulasjon, men ikke replay av en tidligere
//   gyldig kuvert. `openMessage` sjekker derfor message_id mot et dedup-sett
//   (forvaltet av store.js) og avviser allerede behandlede meldinger. Dette
//   gjøres klient-side hos mottakeren.
//
//   PERSISTENS: I Fase 1 er dedup-settet in-memory (createInMemoryStore).
//   IndexedDB-basert persistering som overlever reload/ny fane kommer i
//   Fase 2 og MÅ være på plass før modulen kobles til ekte meldinger.

import { encrypt, decrypt, bytesToBase64, base64ToBytes } from './crypto.js';

const AAD_VERSION = 'v1';
const SEP = '\x1F'; // ASCII Unit Separator — kan ikke opptre i base64/ID-er
const textEncoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Bygg AAD ENTYDIG og VERSJONERT. Lengde-prefiks per felt = kollisjonsfritt.
//
// Format: "v1" + SEP + ("len:val" + SEP)*4  (kunne også binær, men streng er
// lesbart for debugging). Lengden er UTF-8 byte-lengde av verdien.
// ---------------------------------------------------------------------------

export function buildAAD({ conversation_id, sender_id, message_id, sequence_number }) {
  const seqStr = String(sequence_number);
  const fields = [
    field(conversation_id),
    field(sender_id),
    field(message_id),
    field(seqStr),
  ];
  return AAD_VERSION + SEP + fields.join(SEP);
}

function field(value) {
  const byteLen = textEncoder.encode(value).length;
  return `${byteLen}:${value}`;
}

// ---------------------------------------------------------------------------
// Pakk en melding: generer message_id + sequence, krypter, returner kuvert.
//
// Input:
//   { conversation_id, sender_id, sequence_number, plaintext, key,
//     message_id?, seenIvSet? }
//
// `message_id` genereres med crypto.randomUUID hvis ikke oppgitt (testbar).
// IV genereres ALLTID internt av crypto.encrypt (CSPRNG, ingen caller-seam).
// ---------------------------------------------------------------------------

export async function sealMessage({ conversation_id, sender_id, sequence_number, plaintext, key, message_id, seenIvSet }) {
  if (!conversation_id) throw new Error('conversation_id required');
  if (!sender_id) throw new Error('sender_id required');
  if (sequence_number == null) throw new Error('sequence_number required');
  const mid = message_id || newMessageId();
  const aad = buildAAD({ conversation_id, sender_id, message_id: mid, sequence_number });
  const enc = await encrypt(plaintext, key, aad);
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
// Steg:
//   1. Kontekst-sjekk: conversation_id/ sender_id i kuverten må matche
//      forventet.
//   2. AAD bygges og dekryptering kjøres. Manipulert AAD eller ciphertext
//      → tag mismatch → avvis.
//   3. Dedup: message_id må ikke være i seenMessageIds. Ved første aksept
//      legges message_id til i settet av calleren.
//
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
// Merk: generateIV er IKKE lenger eksportert herfra — se crypto.js/index.js.
export { bytesToBase64, base64ToBytes };