import type { CanvasEngine } from "@webforge/engine";
import { type RichTextLink, richTextHref, richTextLinkValue, type SiteDoc } from "@webforge/model";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { currentPage, type EditorSession, textSessionKey } from "../editor/editor-session.js";
import { labelFor } from "../editor/labels.js";
import { findNode } from "../editor/nodes.js";
import { LinkDialog } from "./LinkDialog.js";
import { applyAnchor, type LinkFieldChange } from "./link-change.js";
import { linkTargets } from "./link-targets.js";

/** A link the format toolbar asked for, waiting for the dialog. */
type Request = {
  readonly current: RichTextLink | null;
  readonly answer: (link: RichTextLink | null | undefined) => void;
};

/**
 * Gives a section linked to for the first time its anchor (F-ED-18), as part of the text-editing
 * session the link is made in: the session ends as one step ("Edited Text text"), and undoing it
 * takes the anchor away with the link (D1).
 */
function giveAnchor(session: EditorSession, site: SiteDoc, change: LinkFieldChange): void {
  const { anchor } = change;
  const { pageId, nodeId } = session.ui.getState();
  const node =
    nodeId === null
      ? undefined
      : findNode(currentPage(session)?.doc.content ?? [], (n) => n.props.id === nodeId);
  const page = anchor === undefined ? undefined : site.pages[anchor.pageId];
  const shown = currentPage(session)?.doc;
  const fields = node === undefined ? {} : (session.library.components[node.type]?.fields ?? {});
  const field = Object.entries(fields).find(([, def]) => def.kind === "richtext")?.[0];
  if (
    anchor === undefined ||
    page === undefined ||
    shown === undefined ||
    node === undefined ||
    field === undefined
  ) {
    return;
  }
  const edit = {
    kind: "text" as const,
    nodeId: node.props.id,
    componentType: node.type,
    field,
    page: shown,
    selection: node.props.id,
  };
  session.edit(
    "text",
    labelFor(edit, session.library),
    (draft) => {
      const target = draft.pages[anchor.pageId];
      if (target !== undefined) applyAnchor(target.doc, page.doc, anchor);
    },
    { coalesceKey: textSessionKey(pageId, node.props.id, field) },
  );
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
  const site = useSyncExternalStore(document.subscribe, document.getState, document.getState);
  const [request, setRequest] = useState<Request | null>(null);
  const open = useRef<Request | null>(null);

  useEffect(() => {
    if (engine === null) {
      return;
    }
    engine.setLinkPicker(
      (current) =>
        new Promise((resolve) => {
          // A new request answers one still open: it leaves its text as it is.
          open.current?.answer(undefined);
          const next: Request = {
            current,
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
        const href = change.link === undefined ? undefined : richTextHref(change.link);
        if (change.link === undefined || href === undefined) {
          request.answer(change.link === undefined ? null : undefined);
          return;
        }
        giveAnchor(session, site, change);
        request.answer({ href, newTab: change.link.newTab === true });
      }}
      onCancel={() => request?.answer(undefined)}
    />
  );
}
