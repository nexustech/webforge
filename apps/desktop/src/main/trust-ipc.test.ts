import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { CodeTrust } from "./code-trust.js";
import { codeTrustFeature, registerTrustHandlers } from "./trust-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SITE = "8f7c2a9e-1b3d-4e5f-9a7b-2c4d6e8f0a1b";
const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

/** The trust handlers, over a record that trusts `go()`, for a site open as `SESSION`. */
function handlers({ trusted = true, open = true } = {}) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const trust = {
    trusted: vi.fn(async (_projectId: string) => (text: string) => text === "go()"),
    trust: vi.fn(async (_projectId: string, _texts: readonly string[]) => {}),
  } satisfies Pick<CodeTrust, "trusted" | "trust">;
  registerTrustHandlers(ipc, () => trusted, trust, {
    staleReason: (sessionId) =>
      !open ? "no-site" : sessionId === SESSION ? undefined : "stale-session",
    projectId: () => (open ? SITE : undefined),
  });
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { invoke, trust };
}

describe("registerTrustHandlers (#649)", () => {
  it("says which of the open site's code isn't trusted, by position", async () => {
    const { invoke, trust } = handlers();

    expect(await invoke("trust:untrusted-code", SESSION, ["skim()", "go()", "x"])).toEqual({
      status: "checked",
      untrusted: [0, 2],
    });
    expect(trust.trusted).toHaveBeenCalledWith(SITE);
  });

  it("trusts code for the open site", async () => {
    const { invoke, trust } = handlers();

    expect(await invoke("trust:trust-code", SESSION, ["mine()"])).toEqual({ status: "trusted" });
    expect(trust.trust).toHaveBeenCalledWith(SITE, ["mine()"]);
  });

  it("answers for no other site: a stale session, or none open", async () => {
    const stale = handlers();
    expect(
      await stale.invoke("trust:trust-code", "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a", ["x"]),
    ).toEqual({ status: "failed", reason: "stale-session" });
    expect(stale.trust.trust).not.toHaveBeenCalled();

    const none = handlers({ open: false });
    expect(await none.invoke("trust:untrusted-code", SESSION, ["x"])).toEqual({
      status: "failed",
      reason: "no-site",
    });
  });

  it("refuses a renderer it does not trust", async () => {
    await expect(
      handlers({ trusted: false }).invoke("trust:untrusted-code", SESSION, []),
    ).rejects.toThrow();
  });
});

describe("codeTrustFeature (A12)", () => {
  it("handles the trust calls, and finishes the record's last write before Webforge exits", async () => {
    const handle = vi.fn();
    const trust = { trusted: vi.fn(), trust: vi.fn(), idle: vi.fn(async () => {}) };
    const feature = codeTrustFeature(trust, {
      staleReason: () => undefined,
      projectId: () => SITE,
    });

    feature.register?.({ handle }, () => true);
    await feature.quit?.();

    expect(handle.mock.calls.map(([channel]) => channel)).toEqual([
      "trust:untrusted-code",
      "trust:trust-code",
    ]);
    expect(trust.idle).toHaveBeenCalledOnce();
  });
});
