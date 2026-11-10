import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { CollectionId, SharedSectionId } from "@webforge/model";
import { collectionById, collectionItems, removeNode } from "@webforge/model";
import type { SiteWideAction, SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { EditorSession } from "./editor-session.js";
import { canvasLayout, pagesShowing, type SharedRegion, sharedHomeOf } from "./shared-layout.js";
import { copySelection, reachOf } from "./shared-sections.js";

type Session = Pick<EditorSession, "history" | "ui" | "library">;
type Confirm = Pick<SiteWideConfirm, "confirmSiteWide">;

/**
 * What an element shared across pages is in: the shared Header or Footer, a shared section, or a
 * Blog's design, which every post shows (6.10a).
 */
export type SharedPlace =
  | { readonly region: SharedRegion }
  | { readonly sharedSection: SharedSectionId }
  | { readonly collection: CollectionId };

/** The question to ask before `how` takes `item` out of `place`, and every page showing it. */
function question(
  session: Session,
  how: "delete" | "cut",
  item: string,
  place: SharedPlace,
): SiteWideAction {
  const confirm = how === "delete" ? t("canvas.delete") : t("edit.cut");
  const site = session.history.document.getState();
  if ("region" in place) {
    const where = { item, region: t(`canvas.sharedRegion.${place.region}`) };
    return {
      action: t(how === "delete" ? "canvas.sharedDelete.title" : "canvas.sharedCut.title", where),
      confirm,
      affectedPages: pagesShowing(site, place.region),
    };
  }
  if ("collection" in place) {
    // A Blog's design (6.10a): every post of the Blog.
    const name = t("history.namedItem", {
      name: collectionById(site, place.collection)?.name ?? "",
    });
    return {
      action: t(how === "delete" ? "blog.designDelete.title" : "blog.designCut.title", {
        item,
        name,
      }),
      description: t("blog.designChange"),
      confirm,
      affectedPages: collectionItems(site, place.collection).length,
    };
  }
  // A shared section (F-ED-23): every copy of it, on every page with one.
  const shared = Object.hasOwn(site.sharedSections, place.sharedSection)
    ? site.sharedSections[place.sharedSection]
    : undefined;
  const name = t("history.namedItem", { name: shared?.name ?? "" });
  const { copies, pages } = reachOf(site, place.sharedSection);
  return {
    action: t(
      how === "delete" ? "canvas.sharedSectionDelete.title" : "canvas.sharedSectionCut.title",
      { item, name },
    ),
    description:
      copies === 1
        ? t("canvas.sharedSectionChange.one")
        : t("canvas.sharedSectionChange.many", { copies }),
    confirm,
    affectedPages: pages,
  };
}

/** Asks whether to remove `item` from `place`, and so from every page showing it (D7). */
function confirmShared(
  session: Session,
  siteWide: Confirm,
  how: "delete" | "cut",
  item: string,
  place: SharedPlace,
): Promise<boolean> {
  return siteWide.confirmSiteWide(question(session, how, item, place));
}

/**
 * The canvas `engine` as the editor session sees it, with removals from the shared Header or
 * Footer (F-ED-7), from a post's Blog design (6.10a) or from a linked copy's shared section
 * (F-ED-23) held back until the person
 * confirms them (D7): the quick action, the Delete key, the Edit menu and Layers all report one
 * this way. Confirmed, the removal is recorded as usual, one undo step, against the document as it
 * is then; cancelled, the canvas is put back as the document still is. While a question is open,
 * or the confirmed removal waits for its version (4.6), undo and redo from the canvas do nothing.
 */
export function confirmSharedRemovals(
  engine: CanvasEngine,
  session: Session,
  siteWide: Pick<SiteWideConfirm, "confirmSiteWide" | "busy">,
): CanvasEngine {
  return {
    ...engine,
    onHistoryCommand: (listener) =>
      engine.onHistoryCommand((command) => (siteWide.busy() ? false : listener(command))),
    onUserEdit: (listener) =>
      engine.onUserEdit((edit) => {
        const site = session.history.document.getState();
        const pageId = session.ui.getState().pageId;
        const nodeId = edit.kind === "remove" ? edit.nodeId : null;
        // The shared Header or Footer, or a post's Blog design: where the canvas draws it.
        const home =
          nodeId !== null && edit.shared === true ? sharedHomeOf(site, pageId, nodeId) : undefined;
        const inCopy =
          nodeId !== null && edit.sharedSection !== undefined
            ? copySelection(site, pageId, nodeId)
            : undefined;
        if (inCopy !== undefined && inCopy.node === inCopy.shared.section) {
          // The whole copy, as the engine reports it otherwise too: it goes from this page only,
          // like Cut, and its shared section stays as it is.
          const { sharedSection: _section, ...rest } = edit;
          const page = site.pages[pageId]?.doc;
          if (page !== undefined) {
            const id = inCopy.copy.props.id;
            listener({
              ...rest,
              page: { ...page, content: page.content.filter((node) => node.props.id !== id) },
            });
          }
          return;
        }
        const place: SharedPlace | undefined =
          inCopy !== undefined
            ? { sharedSection: inCopy.shared.id }
            : home === undefined
              ? undefined
              : typeof home === "string"
                ? { region: home }
                : { collection: home.collection };
        if (nodeId === null || place === undefined) {
          listener(edit);
          return;
        }
        const type = edit.componentType ?? "";
        const item = session.library.components[type]?.label ?? type;
        void confirmShared(session, siteWide, "delete", item, place).then((confirmed) => {
          const now = session.history.document.getState();
          if (confirmed) {
            // The removal itself, from the document as it is now: nothing else the canvas held
            // when it was asked for comes back.
            if (!("sharedSection" in place)) {
              // As the canvas draws it around this page: the Header and Footer, and on a post its
              // Blog's design, which the session writes back each to its own place.
              const layout = structuredClone(canvasLayout(now, pageId));
              if (!removeNode(layout.header, nodeId)) removeNode(layout.footer, nodeId);
              listener({ ...edit, layout });
              return;
            }
            const current = Object.hasOwn(now.sharedSections, place.sharedSection)
              ? now.sharedSections[place.sharedSection]?.section
              : undefined;
            if (current !== undefined && inCopy !== undefined) {
              const section = structuredClone(current);
              removeNode([section], inCopy.node.props.id);
              listener({ ...edit, sharedSection: { id: place.sharedSection, section } });
              return;
            }
          }
          // Cancelled, or its shared section gone meanwhile: the canvas shows the document again.
          const page = now.pages[pageId]?.doc;
          if (page !== undefined) {
            engine.applyChange({
              page,
              layout: canvasLayout(now, pageId),
              shared: now.sharedSections,
            });
          }
        });
      }),
  };
}

/**
 * What Cut asks before removing an element from the shared Header or Footer, or from a linked
 * copy's shared section (F-ED-7, F-ED-23, D7).
 */
export function sharedCutConfirmation(
  session: Session,
  siteWide: Confirm,
): (item: string, place: SharedPlace) => Promise<boolean> {
  return (item, place) => confirmShared(session, siteWide, "cut", item, place);
}
