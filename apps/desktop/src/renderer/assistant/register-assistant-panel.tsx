import { t } from "@webforge/i18n";
import { pageIdSchema } from "@webforge/model";
import { SparklesIcon } from "lucide-react";
import { ASSISTANT_CONSENT_VERSION, type AssistantApi } from "../../shared/ipc/assistant.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { SettingsRegistry } from "../editor/settings-registry.js";
import { useDocument } from "../editor/use-document.js";
import { reportFailure } from "../log.js";
import type { PanelRegistry } from "../shell/panels.js";
import { AssistantPanel } from "./AssistantPanel.js";
import { createAssistantPanel } from "./assistant-state.js";

/** The assistant panel's id. */
const ASSISTANT_PANEL_ID = "assistant";

/** What the panel works with. */
export type AssistantPanelOptions = {
  readonly panels: Pick<PanelRegistry, "register" | "show">;
  readonly session: Pick<EditorSession, "history" | "ui" | "showPage" | "select">;
  readonly api: AssistantApi;
  /** The site open in the window, as main names it. */
  readonly sessionId: string;
  readonly settings: Pick<SettingsRegistry, "show">;
  /** Opens a web address in the person's browser. */
  readonly openLink: (href: string) => void;
};

/**
 * Puts the assistant's panel (6.9c, UX-28) beside the Edit panel: its conversation on this site
 * with main, through the `assistant` domain (ADR 0026 §7). Returns a function that removes it and
 * stops following main's events.
 */
export function registerAssistantPanel(options: AssistantPanelOptions): () => void {
  const { panels, session, api } = options;
  const model = createAssistantPanel(api, options.sessionId);
  function Panel() {
    const siteName = useDocument(session, (site) => site.settings.general.name);
    return (
      <AssistantPanel
        model={model}
        history={session.history}
        siteName={siteName}
        context={() => {
          const { pageId, nodeId } = session.ui.getState();
          return { pageId, ...(nodeId === null ? {} : { nodeId }) };
        }}
        onAgree={() =>
          void api
            .setEnabled(true, ASSISTANT_CONSENT_VERSION)
            .catch((error: unknown) => reportFailure("assistant.enable", error))
        }
        onOpenPreferences={() => void options.settings.show("assistant", "assistant")}
        onOpenVersions={() => panels.show("versionHistory")}
        onShowStep={(step) => {
          // Only a page the site has: the id came from main.
          const page = pageIdSchema.safeParse(step.target?.pageId);
          if (!page.success || session.history.document.getState().pages[page.data] === undefined) {
            return;
          }
          session.showPage(page.data);
          if (step.target?.nodeId !== undefined) session.select(step.target.nodeId);
        }}
        onOpenLink={options.openLink}
      />
    );
  }
  const remove = panels.register({
    id: ASSISTANT_PANEL_ID,
    slot: "right.top",
    title: t("assistant.panel"),
    icon: SparklesIcon,
    component: Panel,
  });
  return () => {
    remove();
    model.dispose();
  };
}
