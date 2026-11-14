import { useEffect, useEffectEvent, useState } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import { reportFailure } from "../log.js";
import { BusinessDraftDialog } from "./BusinessDraftDialog.js";
import {
  type BusinessText,
  businessRequest,
  businessTexts,
  keepBusinessWords,
} from "./business-draft.js";
import { type DraftApi, useAssistantStatus, useDraft } from "./use-draft.js";

/** Props of {@link BusinessDraftHost}. */
export type BusinessDraftHostProps = {
  readonly session: EditorSession;
  readonly api: DraftApi;
  /** Takes the quick start's *Tell us about your business* for this opening, once (main's). */
  readonly takeAbout: (sessionId: string) => Promise<string | null>;
  /** The open site's session in main. */
  readonly sessionId: string;
};

/**
 * The quick start's business step, once its site has opened (QS-7, #873): with what the person
 * told it about their business, and while the assistant is on, the assistant drafts the home and
 * About pages' words, asking this site's question first. The person reviews and changes them, and
 * *Use These* keeps them as one undo step; Cancel keeps the template's.
 */
export function BusinessDraftHost({ session, api, takeAbout, sessionId }: BusinessDraftHostProps) {
  const status = useAssistantStatus(api);
  const siteName = useDocument(session, (site) => site.settings.general.name);
  const draft = useDraft(api, sessionId, siteName, status);
  // The paragraph, until the draft of it starts; then the texts it's of, while it's shown.
  const [about, setAbout] = useState<string | null>(null);
  const [texts, setTexts] = useState<readonly BusinessText[] | null>(null);

  // Main gives it once, to this opening's editor; a page that loads again gets none.
  useEffect(() => {
    Promise.resolve()
      .then(() => takeAbout(sessionId))
      .then(
        (text) => {
          if (typeof text === "string") setAbout(text);
        },
        (error: unknown) => reportFailure("assistant business", error),
      );
  }, [takeAbout, sessionId]);

  const start = useEffectEvent((text: string) => {
    setAbout(null);
    if (status?.enabled !== true) return;
    const site = session.history.document.getState();
    const list = businessTexts(site, session.library);
    if (list.length === 0) return;
    setTexts(list);
    void draft.ask(businessRequest(site, text, list));
  });
  // Once main has said whether the assistant is on and how it's reached: the site's question
  // depends on it.
  const known = status !== null;
  useEffect(() => {
    if (about !== null && known) start(about);
  }, [about, known]);

  if (texts === null) return null;
  const close = () => {
    draft.close();
    setTexts(null);
  };
  return (
    <BusinessDraftDialog
      open
      texts={texts}
      state={draft.state}
      onSiteAnswer={draft.answerSite}
      onUse={(words) => {
        keepBusinessWords(session, texts, words);
        close();
      }}
      onAgain={draft.again}
      onCancel={close}
    />
  );
}
