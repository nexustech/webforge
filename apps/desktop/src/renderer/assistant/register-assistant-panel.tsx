import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { exampleFields, findNode, pageIdSchema } from "@webforge/model";
import { SparklesIcon } from "lucide-react";
import { ASSISTANT_CONSENT_VERSION, type AssistantApi } from "../../shared/ipc/assistant.js";
import type { EditorSession } from "../editor/editor-session.js";
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
  /** Opens the assistant's settings (*Settings › Assistant*). */
  readonly openSettings: () => void;
  /** Opens *Things You Can Ask* (5.21, OL-8). */
  readonly openExamples: () => void;
};

/** The panel, once registered. */
export type AssistantPanelHandle = {
  /** Removes the panel and stops following main's events. */
  readonly remove: () => void;
  /**
   * Shows the panel with `text` in its box, unsent, and the box focused (5.21): or, while the
   * assistant isn't set up or this site hasn't said yes, what the panel asks first, the example
   * kept in the box behind it.
   */
  readonly tryExample: (text: string) => void;
};

/**
 * Puts the assistant's panel (6.9c, UX-28) in the left column, after Undo History and Version
 * History: its conversation on this site with main, through the `assistant` domain (ADR 0026 §7).
 */
export function registerAssistantPanel(options: AssistantPanelOptions): AssistantPanelHandle {
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
        onOpenSettings={options.openSettings}
        onOpenExamples={options.openExamples}
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
        holdsExample={(step) => {
          // As the site is now: a change the person has since checked shows no more.
          const page = pageIdSchema.safeParse(step.target?.pageId);
          const nodeId = step.target?.nodeId;
          if (!page.success || nodeId === undefined) return false;
          const content = session.history.document.getState().pages[page.data]?.doc.content ?? [];
          const node = findNode(content, (each) => each.props.id === nodeId);
          return node !== undefined && exampleFields(node.props).length > 0;
        }}
        onOpenLink={(href, replyId) =>
          void model.openLink(replyId, href).then((status) => {
            // Opened in the browser, which says so itself; otherwise a word why not.
            if (status !== "opened") toast(t(`assistant.link.${status}`));
          })
        }
      />
    );
  }
  const remove = panels.register({
    id: ASSISTANT_PANEL_ID,
    // The left column's tabs show only their icons (#898): the right column's text tabs had no room
    // for another, which pushed Theme out of view.
    slot: "left.bottom",
    title: t("assistant.panel"),
    icon: SparklesIcon,
    component: Panel,
  });
  return {
    remove: () => {
      remove();
      model.dispose();
    },
    tryExample: (text) => {
      model.tryExample(text);
      panels.show(ASSISTANT_PANEL_ID);
    },
  };
}
