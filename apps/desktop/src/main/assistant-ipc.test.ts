import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_CONSENT_VERSION,
  type AssistantStatus,
  MONTHLY_LIMIT_DEFAULT_USD,
} from "../shared/ipc/assistant.js";
import { type AssistantService, registerAssistantHandlers } from "./assistant-ipc.js";

/** The assistant before it's turned on: off, signed out, nothing spent (ADR 0026 §2, §5). */
const ASSISTANT_OFF: AssistantStatus = {
  enabled: false,
  consentVersion: null,
  consentReach: null,
  provider: { kind: "openrouter", signedIn: false },
  reach: "openrouter",
  model: null,
  month: {
    spentUsd: 0,
    limitUsd: MONTHLY_LIMIT_DEFAULT_USD,
    warned: false,
    reached: false,
  },
  reviewBeforeApplying: false,
  allowRetainingModels: false,
};

/** A service that stays off, and refuses to turn on or send: each call answered as a default. */
const unbuiltAssistant: AssistantService = {
  status: async () => ASSISTANT_OFF,
  setEnabled: async () => ASSISTANT_OFF,
  update: async () => ASSISTANT_OFF,
  signIn: async () => ({ status: "failed" }),
  finishSignIn: async () => ({ status: "failed" }),
  cancelSignIn: async () => undefined,
  setKey: async () => ({ status: "failed" }),
  models: async () => ({ status: "not-signed-in" }),
  siteConsent: async () => ({ asked: false, allowed: false }),
  setSiteConsent: async () => undefined,
  send: async () => ({ status: "consent-needed" }),
  stop: async () => undefined,
  newConversation: async () => undefined,
  conversation: async () => [],
};

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SESSION = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";
const REPLY = "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e";

/** Each channel's handler, called as from a renderer that `trusted` says it trusts or not. */
function handlers(service: AssistantService, trusted = true) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerAssistantHandlers(ipc, () => trusted, service);
  return (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
}

/** The unbuilt service, with every call a spy. */
const spied = (): AssistantService => {
  const service = { ...unbuiltAssistant };
  for (const name of Object.keys(service) as (keyof AssistantService)[]) {
    service[name] = vi.fn(service[name]) as never;
  }
  return service;
};

describe("the assistant IPC calls (6.9a, ADR 0026 §7)", () => {
  it("passes each call to the service, with what it was given", async () => {
    const service = spied();
    const call = handlers(service);

    expect(await call("assistant:status")).toEqual(ASSISTANT_OFF);
    await call("assistant:set-enabled", true, ASSISTANT_CONSENT_VERSION);
    expect(service.setEnabled).toHaveBeenCalledWith(true, ASSISTANT_CONSENT_VERSION);
    await call("assistant:update", { monthlyLimitUsd: 10 });
    expect(service.update).toHaveBeenCalledWith({ monthlyLimitUsd: 10 });
    expect(await call("assistant:sign-in", "browser")).toEqual({ status: "failed" });
    await call("assistant:finish-sign-in", " abc ");
    expect(service.finishSignIn).toHaveBeenCalledWith("abc");
    expect(await call("assistant:cancel-sign-in")).toBeNull();
    expect(await call("assistant:models")).toEqual({ status: "not-signed-in" });
    expect(await call("assistant:site-consent", SESSION)).toEqual({ asked: false, allowed: false });
    expect(await call("assistant:set-site-consent", SESSION, true)).toBeNull();
    expect(service.setSiteConsent).toHaveBeenCalledWith(SESSION, true);
    expect(await call("assistant:send", SESSION, "Add Saturday hours", { pageId: "home" })).toEqual(
      {
        status: "consent-needed",
      },
    );
    expect(service.send).toHaveBeenCalledWith(SESSION, "Add Saturday hours", { pageId: "home" });
    expect(await call("assistant:stop", REPLY)).toBeNull();
    expect(await call("assistant:new-conversation", SESSION)).toBeNull();
    expect(await call("assistant:conversation", SESSION)).toEqual([]);
  });

  it("checks what it's given: no empty or overlong message, no limit out of range", async () => {
    const call = handlers(spied());
    await expect(call("assistant:send", SESSION, "   ", {})).rejects.toThrow();
    await expect(call("assistant:send", SESSION, "x".repeat(8001), {})).rejects.toThrow();
    await expect(call("assistant:send", "not a session", "Hello", {})).rejects.toThrow();
    await expect(call("assistant:update", { monthlyLimitUsd: 0 })).rejects.toThrow();
    await expect(call("assistant:update", { key: "sk-or-v1-secret" })).rejects.toThrow();
    await expect(
      call("assistant:update", { provider: { kind: "server", baseUrl: "file:///etc/passwd" } }),
    ).rejects.toThrow();
    await expect(call("assistant:stop", "not a reply")).rejects.toThrow();
  });

  it("refuses a renderer it doesn't trust", async () => {
    await expect(handlers(spied(), false)("assistant:status")).rejects.toThrow();
  });
});
