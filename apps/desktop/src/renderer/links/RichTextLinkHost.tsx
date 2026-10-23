import type { CanvasEngine, RichTextAt } from "@webforge/engine";
import { type RichTextLink, richTextHref, richTextLinkValue, type SiteDoc } from "@webforge/model";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ADVANCED_FIELDS, advancedFieldLabel } from "../editor/advanced-fields.js";
import { currentPage, type EditorSession, textSessionKey } from "../editor/editor-session.js";
import { changedLabel, labelFor } from "../editor/labels.js";
import { findNode } from "../editor/nodes.js";
import { LinkDialog } from "./LinkDialog.js";
import { applyAnchor, type LinkFieldChange } from "./link-change.js";
import { linkTargets } from "./link-targets.js";

/** A link the format toolbar asked for, waiting for the dialog. */
type Request = {
  readonly current: RichTextLink | null;
  /** The rich-text field the link goes in, when the engine knows it. */
  readonly at: RichTextAt | null;
  readonly answer: (link: RichTextLink | null | undefined) => void;
};

/**
 * Gives a section linked to for the first time its anchor (F-ED-18), as part of the text-editing
 * session the link is made in (`at`, the field being edited): the session ends as one step
 * ("Edited Text text"), and undoing it takes the anchor away with the link (D1). Without that
 * field, the anchor is a step of its own.
 */
function giveAnchor(
  session: EditorSession,
  site: SiteDoc,
  change: LinkFieldChange,
  at: RichTextAt | null,
): void {
  const { anchor } = change;
  const page = anchor === undefined ? undefined : site.pages[anchor.pageId];
  const shown = currentPage(session)?.doc;
  if (anchor === undefined || page === undefined || shown === undefined) {
    return;
  }
  const { pageId } = session.ui.getState();
  const node = at === null ? undefined : findNode(shown.content, (n) => n.props.id === at.nodeId);
  const recipe = (draft: SiteDoc) => applyAnchor(draft, site, anchor);
  if (at === null || node === undefined) {
    const section = findNode(page.doc.content, (n) => n.props.id === anchor.nodeId);
    const label = changedLabel(
      {
        kind: "props",
        nodeId: anchor.nodeId,
        componentType: section?.type ?? null,
        field: ADVANCED_FIELDS.anchorId,
        page: page.doc,
        selection: null,
      },
      session.library,
      advancedFieldLabel(ADVANCED_FIELDS.anchorId),
    );
    session.edit("props", label, recipe);
    return;
  }
  const edit = {
    kind: "text" as const,
    nodeId: at.nodeId,
    componentType: node.type,
    field: at.field,
    page: shown,
    selection: at.nodeId,
  };
  session.edit("text", labelFor(edit, session.library), recipe, {
    coalesceKey: textSessionKey(pageId, at.nodeId, at.field),
  });
}

/**
 * Picks links in rich text on the canvas (F-ED-3, F-ED-18) with the link dialog: a page of the
 * site or a section on it, an e-mail address, a phone number or a web address. The engine's format
 * toolbar asks; the dialog answers.
 */
export function RichTextLinkHost({
  session,
  engine,
}: {
  readonly session: EditorSession;
  readonly engine: CanvasEngine | null;
}) {
  const { document } = session.history;
  const [request, setRequest] = useState<Request | null>(null);
  // The site as it is when the dialog opens (a request redraws this) and when it saves (R9).
  const site = document.getState();
  const open = useRef<Request | null>(null);

  useEffect(() => {
    if (engine === null) {
      return;
    }
    engine.setLinkPicker(
      (current, at) =>
        new Promise((resolve) => {
          // A new request answers one still open: it leaves its text as it is.
          open.current?.answer(undefined);
          const next: Request = {
            current,
            at,
            answer: (link) => {
              if (open.current === next) {
                open.current = null;
                setRequest(null);
              }
              resolve(link);
            },
          };
          open.current = next;
          setRequest(next);
        }),
    );
    return () => {
      engine.setLinkPicker(null);
      open.current?.answer(undefined);
    };
  }, [engine]);

  return (
    <LinkDialog
      open={request !== null}
      link={
        request?.current === null || request === null
          ? undefined
          : richTextLinkValue(request.current)
      }
      site={site}
      targets={request === null ? [] : linkTargets(site, session.library)}
      onSave={(change) => {
        if (request === null) return;
        if (change.link === undefined) {
          request.answer(null);
          return;
        }
        giveAnchor(session, document.getState(), change, request.at);
        request.answer({ href: richTextHref(change.link), newTab: change.link.newTab === true });
      }}
      onCancel={() => request?.answer(undefined)}
    />
  );
}
