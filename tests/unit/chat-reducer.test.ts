import { describe, expect, test } from "vitest";
import { responseLengthBucket } from "@modules/reducers/chat-reducer";

describe("responseLengthBucket", () => {
  test("returns short for length < 120", () => {
    expect(responseLengthBucket(0)).toBe("short");
    expect(responseLengthBucket(50)).toBe("short");
    expect(responseLengthBucket(119)).toBe("short");
  });

  test("returns medium for 120 <= length < 320", () => {
    expect(responseLengthBucket(120)).toBe("medium");
    expect(responseLengthBucket(200)).toBe("medium");
    expect(responseLengthBucket(319)).toBe("medium");
  });

  test("returns long for length >= 320", () => {
    expect(responseLengthBucket(320)).toBe("long");
    expect(responseLengthBucket(500)).toBe("long");
  });
});
