import { t } from "@webforge/i18n";
import type { Net, Shell } from "electron";
import { ASSISTANT_APP_ID } from "../shared/ipc/ai.js";
import { type AssistantEvent, assistantEvents } from "../shared/ipc/assistant.js";
import type { AiAppsFeature } from "./ai-apps-feature.js";
import type { AppFeature } from "./app-feature.js";
import { createAssistantService } from "./assistant/assistant-service.js";
import { createOpenRouterSignIn } from "./assistant/openrouter-sign-in.js";
import { registerAssistantHandlers } from "./assistant-ipc.js";
import type { CredentialStore } from "./credential-store.js";
import type { ProjectSession } from "./project-session.js";
import type { Versions } from "./versions-ipc.js";

/** What the assistant works with (6.9a, ADR 0026, #985). */
export type AssistantFeatureDeps = {
  /** The person's own data folder, where its settings are kept. */
  readonly userData: string;
  readonly credentials: CredentialStore;
  /** Looked up as each is called: the E2E tests stand in for the model and the browser. */
  readonly electron: () => {
    readonly net: Pick<Net, "fetch">;
    readonly shell: Pick<Shell, "openExternal">;
  };
  /** The editor's window, told of the conversation as it goes. */
  readonly window: () =>
    | { readonly webContents: { send(channel: string, ...args: unknown[]): void } }
    | undefined;
  readonly site: Pick<ProjectSession, "staleReason" | "projectId">;
  /** The tools it works with: AI apps', in memory, with *AI apps* on or off (6.9b). */
  readonly tools: Pick<AiAppsFeature, "connectAssistant" | "cancel">;
  readonly versions: Pick<Versions, "saveVersionBefore">;
};

/**
 * The assistant (6.9a, ADR 0026, #985): its calls, registered once Electron is ready. Its model
 * calls and sign-in go through `net.fetch`, for the system's proxy.
 */
export function assistantFeature(deps: AssistantFeatureDeps): AppFeature {
  const fetchFn: typeof fetch = (input, init) => deps.electron().net.fetch(input as string, init);
  const openExternal = (url: string) => deps.electron().shell.openExternal(url);
  return {
    register(ipc, isTrustedSender) {
      const service = createAssistantService({
        dir: deps.userData,
        credentials: deps.credentials,
        fetchFn,
        appName: t("app.name"),
        signIn: createOpenRouterSignIn({
          fetchFn,
          openExternal,
          keyLabel: () =>
            t("assistant.signIn.keyLabel", { date: new Date().toISOString().slice(0, 10) }),
          donePage: () => ({
            title: t("assistant.signIn.donePageTitle"),
            body: t("assistant.signIn.donePage"),
          }),
        }),
        projectOf: (session) =>
          deps.site.staleReason(session) === undefined ? deps.site.projectId() : undefined,
        emit: (event: AssistantEvent) =>
          deps.window()?.webContents.send(assistantEvents.event.channel, event),
        openExternal,
        connectTools: (beforeCommand, stage) => deps.tools.connectAssistant(beforeCommand, stage),
        cancelQuestions: () => deps.tools.cancel(ASSISTANT_APP_ID),
        // The conversation's safety version (S20): its id, for Version History's button.
        saveVersionBefore: async (session, name) => {
          const saved = await deps.versions.saveVersionBefore(session, name);
          if (saved.status === "saved") return { status: "saved", versionId: saved.version.id };
          return saved.status === "skipped" ? { status: "held" } : { status: "failed" };
        },
      });
      registerAssistantHandlers(ipc, isTrustedSender, service);
    },
  };
}
