import { describe, expect, it } from "vitest";
import { netlifyApiFor } from "./e2e-netlify.js";

describe("the E2E tests' mock Netlify (#70)", () => {
  const mock = "http://127.0.0.1:51234/api/v1";

  it("is reached by an unpackaged app launched with the variable, on this computer only", () => {
    expect(netlifyApiFor(false, { WEBFORGE_E2E_NETLIFY_API: mock })).toBe(mock);
    expect(netlifyApiFor(false, { WEBFORGE_E2E_NETLIFY_API: "http://localhost:8080/api/v1" })).toBe(
      "http://localhost:8080/api/v1",
    );
    // Netlify's own, without it.
    expect(netlifyApiFor(false, {})).toBeUndefined();
  });

  it("is never reached by the installed app, whatever its environment holds", () => {
    expect(netlifyApiFor(true, { WEBFORGE_E2E_NETLIFY_API: mock })).toBeUndefined();
  });

  it("is never another computer, nor anything but plain http", () => {
    for (const value of [
      "https://evil.example/api/v1",
      "http://192.168.1.20:8080/api/v1",
      "http://127.0.0.1.evil.example/api/v1",
      "https://127.0.0.1/api/v1",
      "file:///C:/netlify",
      "not an address",
    ]) {
      expect(netlifyApiFor(false, { WEBFORGE_E2E_NETLIFY_API: value }), value).toBeUndefined();
    }
  });
});
