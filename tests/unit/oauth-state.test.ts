import { describe, expect, test } from "vitest";
import { createSignedState, verifySignedState } from "../../src/lib/auth/oauth-state";

describe("oauth-state", () => {
  test("signs and verifies state", () => {
    const token = createSignedState({ nonce: "abc", createdAt: Date.now(), redirectTo: "/x" }, "secret");
    const parsed = verifySignedState(token, "secret", 60_000);
    expect(parsed.nonce).toBe("abc");
    expect(parsed.redirectTo).toBe("/x");
  });

  test("rejects bad signature", () => {
    const token = createSignedState({ nonce: "abc", createdAt: Date.now() }, "secret");
    expect(() => verifySignedState(token, "wrong", 60_000)).toThrowError();
  });
});
