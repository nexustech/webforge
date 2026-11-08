import { describe, expect, it } from "vitest";
import { netlifyApiFor } from "./e2e-netlify.js";

describe("netlifyApiFor (4.2)", () => {
  const env = { WEBFORGE_E2E_NETLIFY_API: "http://127.0.0.1:4100/api/v1" };

  it("points an app run from its build folder at the E2E tests' stand-in", () => {
    expect(netlifyApiFor(false, env)).toBe("http://127.0.0.1:4100/api/v1");
    expect(netlifyApiFor(false, {})).toBeUndefined();
    expect(netlifyApiFor(false, { WEBFORGE_E2E_NETLIFY_API: " " })).toBeUndefined();
  });

  it("never lets a packaged app's environment point it elsewhere", () => {
    expect(netlifyApiFor(true, env)).toBeUndefined();
  });
});
