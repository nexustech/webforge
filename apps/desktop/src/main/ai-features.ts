import { join } from "node:path";
import { type AiAppsFeatureDeps, aiAppsFeature } from "./ai-apps-feature.js";
import type { AppFeature } from "./app-feature.js";
import { type AssistantFeatureDeps, assistantFeature } from "./assistant-feature.js";
import { type VersionsOptions, versionsFeature } from "./versions-ipc.js";

/** What Version History, AI apps and the assistant work with (#985). */
export type AiFeaturesDeps = Pick<
  AiAppsFeatureDeps,
  "userData" | "packaged" | "info" | "templates" | "shell"
> &
  Required<
    Pick<VersionsOptions, "session" | "dialogs" | "captureCanvas" | "beforeSwitch" | "flush">
  > & {
    readonly site: AiAppsFeatureDeps["site"] & AssistantFeatureDeps["site"];
    /** The editor's window, which answers AI apps' requests and is told of the assistant's work. */
    readonly window: AiAppsFeatureDeps["window"] & AssistantFeatureDeps["window"];
    /** The keychain's store, for AI apps' and the assistant's own keys only (S2, S38). */
    readonly credentials: AiAppsFeatureDeps["credentials"] & AssistantFeatureDeps["credentials"];
    /** Where the packaged app's resources are (`process.resourcesPath`), and the built app's. */
    readonly resourcesPath: string;
    readonly appPath: string;
    /** How many of Webforge's own versions each site keeps: the person's choice (P3). */
    readonly versionsKept: () => number;
    readonly electron: AssistantFeatureDeps["electron"];
  };

/**
 * Version History (4.6), AI apps on this computer (4.8, 4.9, ADR 0021) and the assistant (6.9a,
 * ADR 0026), which saves versions before AI apps' changes and works on AI apps' tools (#985).
 */
export function aiFeatures(deps: AiFeaturesDeps) {
  // Its calls, and the versions main saves before AI apps' changes.
  const versions = versionsFeature({
    session: deps.session,
    dialogs: deps.dialogs,
    captureCanvas: deps.captureCanvas,
    versionsKept: async () => deps.versionsKept(),
    beforeSwitch: deps.beforeSwitch,
    // Before main saves a version itself (`saveVersionBefore`, which 4.9's AI apps use).
    flush: deps.flush,
  });
  // Their requests go to the open site's window.
  const aiApps = aiAppsFeature({
    userData: deps.userData,
    packaged: deps.packaged,
    bridgeFile: deps.packaged
      ? join(deps.resourcesPath, "bridge", "webforge-bridge.mjs")
      : join(deps.appPath, "out", "bridge", "webforge-bridge.mjs"),
    info: deps.info,
    window: deps.window,
    site: deps.site,
    credentials: deps.credentials,
    templates: deps.templates,
    versions,
    shell: deps.shell,
  });
  const assistant: AppFeature = assistantFeature({
    userData: deps.userData,
    credentials: deps.credentials,
    electron: deps.electron,
    window: deps.window,
    site: deps.site,
    tools: aiApps,
    versions,
  });
  return { versions, aiApps, assistant };
}
