import { describe, expect, test } from "vitest";
import { decryptSessionPayload, encryptSessionPayload } from "../../src/lib/auth/session-crypto";

describe("session-crypto", () => {
  test("encrypts and decrypts token payload", () => {
    const source = {
      accessToken: "access",
      idToken: "id",
      refreshToken: "refresh",
      tokenType: "Bearer",
      expiresIn: 3600
    };

    const encrypted = encryptSessionPayload(source, "0123456789abcdef0123456789abcdef");
    const decrypted = decryptSessionPayload(encrypted, "0123456789abcdef0123456789abcdef");
    expect(decrypted).toEqual(source);
  });
});
