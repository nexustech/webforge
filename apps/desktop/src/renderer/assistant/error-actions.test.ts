import { isMessageKey, t } from "@webforge/i18n";
import { describe, expect, it } from "vitest";
import { ASSISTANT_ERRORS } from "../../shared/ipc/assistant.js";
import { errorActions, errorKey } from "./error-actions.js";

/** Each code's message and actions, from OpenRouter: the table in #1201. */
const TABLE = {
  "consent-needed": [],
  "not-signed-in": ["settings"],
  "no-model": ["settings"],
  "limit-reached": ["settings"],
  busy: [],
  "no-site": [],
  offline: ["retry"],
  unauthorized: ["settings"],
  "no-credit": ["credits"],
  "rate-limited": ["retry"],
  "model-unavailable": ["retry", "settings"],
  "provider-error": ["retry"],
  "insecure-server": ["settings"],
  failed: ["retry"],
} as const;

describe("what the person can do about each of the assistant's errors (5.20, OL-5)", () => {
  it("words every code main can send with its own message, and gives each its actions", () => {
    expect(Object.keys(TABLE).sort()).toEqual([...ASSISTANT_ERRORS].sort());
    const messages = new Set<string>();
    for (const code of ASSISTANT_ERRORS) {
      const key = errorKey(code, "openrouter");
      expect(key).toBe(`assistant.error.${code}`);
      expect(isMessageKey(key), code).toBe(true);
      messages.add(t(key));
      expect(errorActions(code, "openrouter"), code).toEqual(TABLE[code]);
    }
    // No two codes share a message: each says its own reason.
    expect(messages.size).toBe(ASSISTANT_ERRORS.length);
  });

  it("words a code it doesn't know as failed, with Try Again", () => {
    expect(errorKey("from-a-newer-main")).toBe("assistant.error.failed");
    expect(errorActions(undefined, "openrouter")).toEqual(["retry"]);
  });

  it("words another server's refusals as its own, and sends no one to OpenRouter for credit", () => {
    for (const provider of ["server", "ollama", "lmstudio"] as const) {
      expect(errorKey("unauthorized", provider)).toBe("assistant.error.unauthorized-server");
      expect(errorKey("no-credit", provider)).toBe("assistant.error.no-credit-server");
      expect(errorKey("offline", provider)).toBe("assistant.error.offline");
      expect(errorActions("no-credit", provider)).toEqual([]);
      expect(errorActions("unauthorized", provider)).toEqual(["settings"]);
    }
    expect(t(errorKey("unauthorized", "server"))).not.toContain("OpenRouter");
    expect(t(errorKey("no-credit", "server"))).not.toContain("OpenRouter");
  });
});
