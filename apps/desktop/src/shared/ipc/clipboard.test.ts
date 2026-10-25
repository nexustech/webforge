import { describe, expect, it } from "vitest";
import { clipboardChannels, MAX_ADDRESS_BYTES } from "./clipboard.js";

describe("clipboard:read's answer (F-ED-16)", () => {
  const answer = clipboardChannels.readClipboard.response;
  const address = (value: string) => answer.safeParse({ status: "address", address: value });

  it("passes on only a web address, within its limit", () => {
    expect(address("https://www.youtube.com/watch?v=dQw4w9WgXcQ").success).toBe(true);
    for (const value of [
      "javascript:alert(1)",
      "file:///C:/shop.jpg",
      "watch this",
      `https://example.com/${"a".repeat(MAX_ADDRESS_BYTES)}`,
    ]) {
      expect(address(value).success).toBe(false);
    }
  });
});
