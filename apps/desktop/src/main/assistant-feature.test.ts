import type { IpcMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { SaveVersionResult } from "../shared/ipc/versions.js";
import type { AssistantServiceOptions } from "./assistant/assistant-service.js";
import { assistantFeature } from "./assistant-feature.js";
import type { CredentialStore } from "./credential-store.js";

const given = vi.hoisted(() => ({ options: undefined as AssistantServiceOptions | undefined }));
vi.mock("./assistant/assistant-service.js", () => ({
  createAssistantService: (options: AssistantServiceOptions) => {
    given.options = options;
    return {};
  },
}));

const OPENING = "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d";

/** The assistant's service as registered, with Version History answering `saved`. */
function registered(saved: SaveVersionResult) {
  const channels: string[] = [];
  const ipc = {
    handle: (channel: string) => channels.push(channel),
  } as unknown as Pick<IpcMain, "handle">;
  const tools = { connectAssistant: vi.fn(), cancel: vi.fn() };
  assistantFeature({
    userData: "/no/such/folder",
    credentials: {} as CredentialStore,
    electron: () => ({ net: { fetch: vi.fn() }, shell: { openExternal: vi.fn() } }),
    window: () => undefined,
    site: { staleReason: () => "stale-session", projectId: () => "project" },
    tools,
    versions: { saveVersionBefore: async () => saved },
  }).register?.(ipc, () => true);
  if (given.options === undefined) throw new Error("No service was made");
  return { options: given.options, channels, tools };
}

describe("assistantFeature (6.9a, #985)", () => {
  it("registers the assistant's calls once Electron is ready", () => {
    expect(registered({ status: "skipped" }).channels).toContain("assistant:status");
  });

  it("gives the conversation's safety version's id, or says one was held or failed", async () => {
    const version = { id: "v1" } as Extract<SaveVersionResult, { status: "saved" }>["version"];
    const save = (saved: SaveVersionResult) =>
      registered(saved).options.saveVersionBefore(OPENING, "Before the assistant's changes");

    expect(await save({ status: "saved", version })).toEqual({ status: "saved", versionId: "v1" });
    expect(await save({ status: "skipped" })).toEqual({ status: "held" });
    expect(await save({ status: "failed", reason: "unknown" })).toEqual({ status: "failed" });
  });

  it("asks for no project of a renderer loaded for another opening", () => {
    expect(registered({ status: "skipped" }).options.projectOf(OPENING)).toBeUndefined();
  });

  it("stops the assistant's own questions only, by its id", () => {
    const { options, tools } = registered({ status: "skipped" });
    options.cancelQuestions();
    expect(tools.cancel).toHaveBeenCalledWith("assistant");
  });
});
