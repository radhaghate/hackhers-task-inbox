import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

function getKey(): Buffer {
  return Buffer.from(getEnv().ENCRYPTION_KEY, "hex");
}

/**
 * Encrypts a secret (e.g. a Gmail OAuth token) for storage at rest.
 * Output packs iv + authTag + ciphertext into one base64 string so a
 * single opaque column can hold it.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Reverses encryptSecret. Throws if the payload was tampered with or the
 * key doesn't match (GCM auth tag verification).
 */
export function decryptSecret(packed: string): string {
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, IV_LENGTH_BYTES);
  const authTag = buf.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + 16);
  const ciphertext = buf.subarray(IV_LENGTH_BYTES + 16);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
