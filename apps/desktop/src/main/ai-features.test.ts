import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiAppsFeatureDeps } from "./ai-apps-feature.js";
import { type AiFeaturesDeps, aiFeatures } from "./ai-features.js";
import type { AssistantFeatureDeps } from "./assistant-feature.js";

const made = vi.hoisted(() => ({
  aiApps: undefined as AiAppsFeatureDeps | undefined,
  assistant: undefined as AssistantFeatureDeps | undefined,
}));
vi.mock("./ai-apps-feature.js", () => ({
  aiAppsFeature: (deps: AiAppsFeatureDeps) => {
    made.aiApps = deps;
    return { close: async () => undefined };
  },
}));
vi.mock("./assistant-feature.js", () => ({
  assistantFeature: (deps: AssistantFeatureDeps) => {
    made.assistant = deps;
    return {};
  },
}));

function setUp(packaged: boolean) {
  const deps = {
    session: {},
    dialogs: {},
    captureCanvas: async () => undefined,
    beforeSwitch: async () => undefined,
    flush: async () => undefined,
    userData: "/user",
    packaged,
    resourcesPath: "/resources",
    appPath: "/app",
    info: { name: "Webforge", version: "1.0.0" },
    window: () => undefined,
    site: {},
    credentials: {},
    templates: () => [],
    shell: vi.fn(),
    versionsKept: () => 10,
    electron: vi.fn(),
  } as unknown as AiFeaturesDeps;
  return aiFeatures(deps);
}

beforeEach(() => {
  made.aiApps = undefined;
  made.assistant = undefined;
});

describe("aiFeatures (#985)", () => {
  it("gives AI apps the bundled bridge: in the installed app's resources, or the build's", () => {
    setUp(true);
    expect(made.aiApps?.bridgeFile).toBe(join("/resources", "bridge", "webforge-bridge.mjs"));

    setUp(false);
    expect(made.aiApps?.bridgeFile).toBe(join("/app", "out", "bridge", "webforge-bridge.mjs"));
  });

  it("puts the assistant on AI apps' tools, and both on the same Version History", () => {
    const { versions, aiApps } = setUp(true);

    expect(made.assistant?.tools).toBe(aiApps);
    expect(made.assistant?.versions).toBe(versions);
    expect(made.aiApps?.versions).toBe(versions);
  });
});
