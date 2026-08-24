import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto/tokenCipher";

describe("tokenCipher", () => {
  it("round-trips a plaintext secret", () => {
    const secret = "ya29.fake-refresh-token-value";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const secret = "same-secret";
    const a = encryptSecret(secret);
    const b = encryptSecret(secret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(secret);
    expect(decryptSecret(b)).toBe(secret);
  });

  it("throws if the ciphertext has been tampered with", () => {
    const encrypted = encryptSecret("secret-value");
    const tampered = encrypted.slice(0, -4) + "abcd";
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
