import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import type { Finding } from "@webforge/site-check";
import { type ReactNode, useState } from "react";
import { type DraftApi, DraftDialog, useAssistantStatus, useDraft } from "../assistant/index.js";
import type { EditorSession } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import { pagePreview, SearchResultCard } from "../site/index.js";
import {
  ALT_MAX,
  DESCRIPTION_MAX,
  type DraftAsk,
  draftAskFor,
  draftRequestFor,
  keepDraftText,
  mayWrite,
  subjectOf,
} from "./assistant-drafts.js";

/** The assistant, as Site Check asks it to write (#873). */
export type SiteCheckAssistant = {
  readonly api: DraftApi;
  /** The open site's session in main. */
  readonly sessionId: string;
};

/**
 * Site Check's *Write One…* (G25b, SEO-10, #873): for a page without a description or an image
 * without alt text, while the assistant is on, the assistant drafts one, and the person reviews
 * and changes it before it's kept. A description is shown as SEO-6's search result.
 */
export function useAssistantWrites(
  session: EditorSession,
  assistant: SiteCheckAssistant | undefined,
): {
  readonly writeFor: (rule: string, finding: Finding) => (() => void) | undefined;
  readonly dialog: ReactNode;
} {
  const api = assistant?.api ?? NO_ASSISTANT;
  const sessionId = assistant?.sessionId ?? "";
  const status = useAssistantStatus(api);
  const siteName = useDocument(session, (site) => site.settings.general.name);
  const draft = useDraft(api, sessionId, siteName, status);
  // What's being written, with the site as it was when the person asked.
  const [open, setOpen] = useState<{ readonly ask: DraftAsk; readonly site: SiteDoc } | null>(null);
  const on = assistant !== undefined && status?.enabled === true;

  // Decided from the finding alone, so the panel isn't drawn again for every change of the site;
  // the site is read when the person asks.
  const writeFor = (rule: string, finding: Finding) => {
    if (!on || !mayWrite(rule, finding)) return undefined;
    return () => {
      const site = session.history.document.getState();
      const ask = draftAskFor(rule, finding, site);
      const request = ask === undefined ? undefined : draftRequestFor(ask, site, session.library);
      if (ask === undefined || request === undefined) return;
      setOpen({ ask, site });
      void draft.ask(request);
    };
  };

  const close = () => {
    draft.close();
    setOpen(null);
  };

  if (open === null) return { writeFor, dialog: null };
  const { ask: asking, site } = open;
  const page = asking.kind === "description" ? site.pages[asking.pageId] : undefined;
  const subject = subjectOf(asking, site);
  const dialog = (
    <DraftDialog
      open
      title={t(`assistant.write.${asking.kind}.title`)}
      description={t(`assistant.write.${asking.kind}.about`, { subject })}
      label={t(`assistant.write.${asking.kind}.label`)}
      maxLength={asking.kind === "description" ? DESCRIPTION_MAX : ALT_MAX}
      state={draft.state}
      {...(page === undefined
        ? {}
        : {
            preview: (text: string) => (
              <SearchResultCard
                preview={pagePreview(site, page, {
                  title: page.title,
                  slug: page.slug,
                  description: text,
                  shareImage: page.settings.shareImage,
                  hideFromSearch: page.settings.hideFromSearch === true,
                })}
              />
            ),
          })}
      onSiteAnswer={draft.answerSite}
      onAgain={draft.again}
      onUse={(text) => {
        keepDraftText(session, asking, session.history.document.getState(), text);
        close();
      }}
      onCancel={close}
    />
  );
  return { writeFor, dialog };
}

/** The assistant where the window has none to give, as in some tests: never on. */
const NO_ASSISTANT: DraftApi = {
  status: () => new Promise(() => undefined),
  onEvent: () => () => undefined,
  siteConsent: async () => ({ asked: false, allowed: false }),
  setSiteConsent: async () => undefined,
  draft: async () => ({ status: "failed" }),
};
