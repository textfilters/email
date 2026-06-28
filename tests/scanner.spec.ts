import { describe, expect, it } from "vitest";

import {
  createEmailScanner,
  scanEmailRanges,
  EMAIL_FILTER_NAME,
} from "../src/index.js";

describe("@textfilters/email scanner", () => {
  it("exposes scanner ranges compatible with code point masking", () => {
    const scanner = createEmailScanner();
    expect(
      scanner.scan({
        text: "contact user@example.com now",
        codePoints: Array.from("contact user@example.com now"),
      }),
    ).toEqual({
      ranges: [[8, 24]],
    });
    expect(scanner.name).toBe(EMAIL_FILTER_NAME);
  });

  it("keeps direct and obfuscated coverage through the scanner path", () => {
    expect(scanEmailRanges("contact user@example.com")).toEqual([[8, 24]]);
    expect(scanEmailRanges("contact user [at] example [dot] com")).toEqual([
      [8, 35],
    ]);
    expect(scanEmailRanges("contact user(at)example(dot)com")).toEqual([
      [8, 31],
    ]);
    expect(scanEmailRanges("contact user [@] example [.] com")).toEqual([
      [8, 32],
    ]);
  });

  it("returns no ranges for clearly clean text", () => {
    const scanner = createEmailScanner();
    expect(
      scanner.scan({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
      }),
    ).toEqual({ ranges: [] });
  });

  it("preserves scanner option behavior", () => {
    expect(
      scanEmailRanges("contact user at example dot com", {
        matchObfuscated: false,
      }),
    ).toEqual([]);
    expect(
      scanEmailRanges("contact user@example.com", {
        excludeEmails: ["user@example.com"],
      }),
    ).toEqual([]);
  });
});
