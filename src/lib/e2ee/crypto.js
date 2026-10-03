// AES-256-GCM symmetrisk kryptering med Additional Authenticated Data (AAD).
//
// Dette er den innerste kryptografiske primitiven for STÆSJ E2EE. Den er
// bevisst holdt uten avhengighet til Base44, nettverk eller UI, slik at den
// kan enhetstestes isolert i ren Node (se e2ee.test.js).
//
// Implementert med Web Crypto `globalThis.crypto.subtle` — ingen ekstern
// krypto-avhengighet for AES-GCM. Se keys.js for X25519 (@noble/curves) og
// Argon2id (hash-wasm).
//
// VIKTIG for replay-beskyttelse:
//   AES-GCM gir konfidensialitet + integritet, men forhindrer IKKE replay av
//   en tidligere gyldig ciphertext. Konteksten (conversation_id, sender_id,
//   message_id, sequence_number) bindes inn via AAD slik at chifferteksten
//   ikke kan flyttes til en annen samtale eller forfalskes som en annen
//   avsender. Selve deduplikeringen av message_id gjøres av mottakeren i
//   store.js / envelope.js — AAD sørger bare for at manipulert kontekst
//   avvises kryptografisk.
//
// REVIDERT FASE 1:
//   `generateIV` har INGEN caller-styrt nonce-seam i produksjons-API-et.
//   Produksjonskoden genererer ALLTID en ny 96-bit IV internt med CSPRNG
//   (`globalThis.crypto.getRandomValues`). Test-seam for IV-kollisjon bor i
//   test-filen (se e2ee.test.js), ikke her — og tree-shakes dermed ut av
//   produksjonsbygget.
//
// BRUKS- OG ROTASJONSGRENSE FOR AES-GCM (NIST SP 800-38D):
//   NIST krever IV-unikhet PER NØKKEL. Ved tilfeldig genererte 96-bit IV-er
//   er den samlete krypteringsgrensen 2^32 kall under samme nøkkel — over
//   denne grensen blir sannsynligheten for IV-kollisjon (og dermed
//   konfidensialitetsbrudd) ikke-negligibel (birthday bound ~2^48 for
//   full tag-reuse-sikkerhet, men NIST setter den praktiske grensen til 2^32
//   for tilfeldig IV-generering).
//
//   STÆSJ MVP bruker EN stabil samtalenøkkel per samtale (se session.js).
//   Det betyr at 2^32 meldinger per samtale er den teoretiske grensen før
//   nøkkelrotasjon PÅKREVES. For en meldingsapp er dette rikkelig for
//   MVP-bruk, MEN:
//
//   - Det finnes foreløpig INGEN automatisk nøkkelrotasjon i MVP (se
//     session.js `canRotate` → false). Fase 5 (Double Ratchet) vil rotere
//     per-meldings nøkler.
//   - Inntil rotasjon er implementert, BØR samtaler som nærmer seg
//     2^32 meldinger (ekstremt sjelden for MVP) lukkes og gjenopprettes med
//     ny ECDH for å få en ny nøkkel.
//   - Denne grensen gjelder PER NØKKEL, ikke per sesjon — flere samtaler
//     med samme deltakere bruker forskjellige nøkler ( forskjellig
//     conversationId i HKDF-info) og har dermed hver sine 2^32.

const IV_BYTES = 12; // AES-GCM anbefaler 96-bit IV
const KEY_BYTES = 32; // AES-256

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Base64-koding uten Node-buffer — fungerer i nettleser og Node.
// Bruker btoa/atob (globale i både browser og Node ≥16).
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toU8(x) {
  return x instanceof Uint8Array ? x : new Uint8Array(x);
}

// ---------------------------------------------------------------------------
// IV-generering — KUN CSPRNG. Ingen caller-styrt nonce.
//
// Genererer en kryptografisk tilfeldig 12-byte IV. Kalleren kan sende inn en
// `seenIvSet` (Set av base64-strenger) for å garantere unikhet innenfor én
// nøkkel/ sesjon. Ved (usannsynlig) kollisjon kastes det — aldri returneres en
// duplikat IV, siden gjenbruk av IV under samme AES-GCM-nøkkel ødelegger
// sikkerheten fullstendig.
//
// Det finnes INGEN parameter for å mate inn en egen IV. Test-kroken for
// kollisjonssimulering lever i test-filen, ikke i prod-koden.
// ---------------------------------------------------------------------------

export function generateIV(seenIvSet) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const id = bytesToBase64(iv);
  if (seenIvSet && seenIvSet.has(id)) {
    // Ekstremt usannsynlig ved tilfeldige IV-er, men vi nekter å returnere en
    // duplikat: gjenbruk av IV under samme AES-GCM-nøkkel er katastrofalt.
    throw new Error('IV collision detected; refusing to reuse IV');
  }
  if (seenIvSet) seenIvSet.add(id);
  return iv;
}

// ---------------------------------------------------------------------------
// Nøkkelhåndtering for Web Crypto AES-GCM.
// ---------------------------------------------------------------------------

export async function importAesKey(rawKeyBytes) {
  const raw = toU8(rawKeyBytes);
  if (raw.length !== KEY_BYTES) {
    throw new Error(`AES key must be ${KEY_BYTES} bytes, got ${raw.length}`);
  }
  return globalThis.crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportRaw(key) {
  const buf = await globalThis.crypto.subtle.exportKey('raw', key);
  return toU8(buf);
}

// ---------------------------------------------------------------------------
// Kryptering.
//
//   plaintext:  string (UTF-8)
//   key:        CryptoKey (AES-GCM 256)
//   aad:        string (entydig, versjonert — se envelope.buildAAD)
//               Dette bindes AUTENTISERT til ciphertext via AES-GCMs AAD-mekanisme.
//
// Returnerer:  { iv: base64, ciphertext: base64, version: 1 }
//   IV genereres ALLTID internt av generateIV() — aldri oppgitt av caller.
//   ciphertext inkluderer AES-GCM-autentiseringstaggen (siste 16 byte).
// ---------------------------------------------------------------------------

export async function encrypt(plaintext, key, aad) {
  const ivBytes = generateIV();
  const aadBytes = textEncoder.encode(aad);
  const ptBytes = textEncoder.encode(plaintext);
  const ctBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes, additionalData: aadBytes, tagLength: 128 },
    key,
    ptBytes
  );
  return {
    iv: bytesToBase64(ivBytes),
    ciphertext: bytesToBase64(new Uint8Array(ctBuf)),
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Dekryptering.
//
// Kaster ved tag-mismatch (feil nøkkel, manipulert ciphertext ELLER manipulert
// AAD). Det er akkurat denne atferden replay-/ manipulasjonstestene bygger på:
// en angriper som endrer message_id i AAD får ugyldig tag, og hele meldingen
// avvises uten at plaintext lekker.
// ---------------------------------------------------------------------------

export async function decrypt(envelope, key, aad) {
  const ivBytes = base64ToBytes(envelope.iv);
  const ctBytes = base64ToBytes(envelope.ciphertext);
  const aadBytes = textEncoder.encode(aad);
  let ptBuf;
  try {
    ptBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes, additionalData: aadBytes, tagLength: 128 },
      key,
      ctBytes
    );
  } catch (e) {
    const err = new Error('Decryption failed (tag mismatch / tampered ciphertext or AAD)');
    err.code = 'DECRYPT_FAILED';
    throw err;
  }
  return textDecoder.decode(ptBuf);
}