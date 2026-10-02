// Identitetsnøkler og passordbeskyttelse for private nøkler.
//
// X25519 (Curve25519 ECDH) brukes til nøkkelutveksling mellom deltakere, via
// `@noble/curves`. Argon2id (via `hash-wasm`) brukes til å avlede en nøkkel
// fra brukerens passord, som igjen krypterer den private X25519-nøkkelen når
// den lagres (IndexedDB eller User-entitetens `encrypted_private_key`).
//
// VIKTIG: Den private X25519-nøkkelen forlater ALDRI klienten ukryptert.
// `encryptPrivateKey` returnerer en base64-blob som trygt kan lagres på
// serveren; `decryptPrivateKey` gjenoppretter den kun med riktig passord.

import { x25519 } from '@noble/curves/ed25519';
import { argon2id, argon2Verify } from 'hash-wasm';
import { importAesKey, exportRaw, encrypt, decrypt, bytesToBase64, base64ToBytes } from './crypto.js';

const textEncoder = new TextEncoder();

// ---------------------------------------------------------------------------
// X25519 identitetsnøkkel-par.
//
// `keygen()` returnerer:
//   { secretKey: Uint8Array(32), publicKey: Uint8Array(32) }
//
// `getSharedSecret(mySecret, theirPublic)` utfører ECDH og returnerer 32
// rå byte — råmaterialet som session.js mater inn i HKDF for å avlede den
// faktiske samtalenøkkelen.
// ---------------------------------------------------------------------------

export function generateIdentityKeyPair() {
  const { secretKey, publicKey } = x25519.keygen();
  return {
    secretKey: new Uint8Array(secretKey),
    publicKey: new Uint8Array(publicKey),
  };
}

export function deriveSharedSecret(mySecretKey, theirPublicKey) {
  const shared = x25519.getSharedSecret(toU8(mySecretKey), toU8(theirPublicKey));
  return new Uint8Array(shared);
}

// ---------------------------------------------------------------------------
// Argon2id passordbasert nøkkelavledning.
//
// Parametre valgt konservativt for et MVP-klientmiljø. Kan strammes i prod.
// Salt genereres kryptografisk tilfeldig per bruker og lagres sammen med den
// krypterte private nøkkelen.
// ---------------------------------------------------------------------------

export const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MiB
  hashLength: 32,
};

export function generateSalt(bytes = 16) {
  return globalThis.crypto.getRandomValues(new Uint8Array(bytes));
}

export async function derivePasswordKey(password, salt) {
  const hash = await argon2id({
    password,
    salt,
    parallelism: ARGON2_PARAMS.parallelism,
    iterations: ARGON2_PARAMS.iterations,
    memorySize: ARGON2_PARAMS.memorySize,
    hashLength: ARGON2_PARAMS.hashLength,
    outputType: 'binary',
  });
  return importAesKey(hash); // AES-256 CryptoKey fra 32 byte
}

// ---------------------------------------------------------------------------
// Krypter/ dekrypter den private X25519-nøkkelen.
//
// Den private nøkkelen er 32 byte. Vi koder den som base64, krypterer
// plaintext-strengen med AES-GCM under passordnøkkelen, og returnerer en
// samlet blob:
//   { salt: base64, iv: base64, ciphertext: base64, version: 1 }
//
// `decryptPrivateKey` gjør det motsatte; feil passord (feil nøkkel) gir
// tag-mismatch via crypto.decrypt — ingen nøkkel returneres, ingen delvis
// lekkasje.
// ---------------------------------------------------------------------------

export async function encryptPrivateKey(secretKey, password) {
  const salt = generateSalt();
  const pwKey = await derivePasswordKey(password, salt);
  const secretBase64 = bytesToBase64(toU8(secretKey));
  const enc = await encrypt(secretBase64, pwKey, 'stæsj:private-key:v1');
  return {
    salt: bytesToBase64(salt),
    iv: enc.iv,
    ciphertext: enc.ciphertext,
    version: 1,
  };
}

export async function decryptPrivateKey(blob, password) {
  const salt = base64ToBytes(blob.salt);
  const pwKey = await derivePasswordKey(password, salt);
  const secretBase64 = await decrypt(
    { iv: blob.iv, ciphertext: blob.ciphertext },
    pwKey,
    'stæsj:private-key:v1'
  );
  return base64ToBytes(secretBase64);
}

// ---------------------------------------------------------------------------
// Offentlig nøkkel-serialisering for lagring i User-entiteten.
// Offentlige nøkler er ikke-hemmelige og kan trygt lagres i klartekst.
// ---------------------------------------------------------------------------

export function publicKeyToBase64(publicKey) {
  return bytesToBase64(toU8(publicKey));
}

export function publicKeyFromBase64(b64) {
  return base64ToBytes(b64);
}

// ---------------------------------------------------------------------------
// Intern: kopierer til en fersk Uint8Array slik at @noble/curves ikke mottar
// en ArrayBuffer-backed view som kan være delt med andre data.
// ---------------------------------------------------------------------------

function toU8(x) {
  return x instanceof Uint8Array ? x : new Uint8Array(x);
}

export { exportRaw, importAesKey };