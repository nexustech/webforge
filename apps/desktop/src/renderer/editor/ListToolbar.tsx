import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { isNodeDoc, type NodeDoc, newId, type PageId, type SiteDoc } from "@webforge/model";
import type { ContextualToolbar } from "../shell/contextual-toolbars.js";
import type { EditorSession } from "./editor-session.js";
import { holderOf } from "./element-holder.js";
import { fieldTarget } from "./field-target.js";
import { labelFor } from "./labels.js";
import { useDocument } from "./use-document.js";

/** Where the toolbar adds a List item: before or after the one selected, or at the List's end. */
export type ListItemPlace = "before" | "after" | "end";

/**
 * The List `nodeId` is, or the List holding it if it is a List item, by the id the canvas shows it
 * by (see `holderOf`).
 */
function listOf(
  site: SiteDoc,
  session: EditorSession,
  pageId: PageId,
  nodeId: string,
): { readonly listId: string; readonly itemId: string | undefined } | undefined {
  const found = holderOf(site, session, pageId, nodeId, "List", "ListItem");
  return found === undefined ? undefined : { listId: found.holderId, itemId: found.childId };
}

/**
 * Adds a List item before or after the List item `nodeId`, or at the end of the List `nodeId` is
 * or is in, as one "Added List item" step that selects it, so the person can type its text. It goes
 * where the Edit panel writes the List's items: the page, the shared Header or Footer, or a linked
 * copy's shared section. `flush` ends a canvas text session first.
 */
function addListItem(
  session: EditorSession,
  flush: () => void,
  nodeId: string,
  place: ListItemPlace,
): void {
  flush();
  const site = session.history.document.getState();
  const { pageId, viewport } = session.ui.getState();
  const found = listOf(site, session, pageId, nodeId);
  const target =
    found === undefined ? undefined : fieldTarget(site, session.library, pageId, found.listId);
  const defaults = session.library.components.ListItem?.defaults;
  if (found === undefined || target === undefined || defaults === undefined) return;
  const id = newId("node");
  const item: NodeDoc = { type: "ListItem", props: { ...structuredClone(defaults), id } };
  const label =
    target.copyLabel ??
    labelFor(
      {
        kind: "insert",
        nodeId: id,
        componentType: "ListItem",
        field: null,
        page: target.page,
        selection: id,
      },
      session.library,
    );
  const prefix = found.listId.slice(0, found.listId.lastIndexOf("~") + 1);
  session.edit(
    "insert",
    label,
    target.recipe("items", (stored) => {
      const items = Array.isArray(stored) ? stored.filter(isNodeDoc) : [];
      const at = items.findIndex((each) => each.props.id === found.itemId);
      const index = place === "end" || at === -1 ? items.length : place === "before" ? at : at + 1;
      return [...items.slice(0, index), item, ...items.slice(index)];
    }),
    { selectionAfter: { pageId, viewport, nodeId: `${prefix}${id}` }, apply: true },
  );
}

/**
 * A List's toolbar as the row under the canvas toolbar shows it (SP-4): *Add item* before or after
 * the selected item, or at the end. Before and After need a List item selected.
 */
export function ListItemsToolbar({
  itemSelected,
  onAdd,
}: {
  readonly itemSelected: boolean;
  readonly onAdd: (place: ListItemPlace) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span aria-hidden className="mr-1 text-xs font-medium">
        {t("listToolbar.addItem")}
      </span>
      {(["before", "after", "end"] as const).map((place) => (
        <Button
          key={place}
          type="button"
          size="sm"
          // Bordered, so they read as buttons beside their label.
          variant="outline"
          // Named in full ("Add item before"), its visible word included.
          aria-label={t(`listToolbar.${place}Name`)}
          disabled={place !== "end" && !itemSelected}
          onClick={() => onAdd(place)}
        >
          {t(`listToolbar.${place}`)}
        </Button>
      ))}
    </div>
  );
}

/**
 * The selected List's, or List item's, toolbar in the row under the canvas toolbar (SP-4), in
 * `session`. Adding items changes what the page says, so it shows in Content mode too.
 */
export function listToolbar({
  session,
  flush,
}: {
  readonly session: EditorSession;
  readonly flush: () => void;
}): ContextualToolbar {
  return {
    id: "listItems",
    types: ["List", "ListItem"],
    inContentMode: true,
    component: function ListItems({ nodeId }) {
      const pageId = session.ui.getState().pageId;
      const itemSelected = useDocument(
        session,
        (site) => fieldTarget(site, session.library, pageId, nodeId)?.node.type === "ListItem",
      );
      return (
        <ListItemsToolbar
          itemSelected={itemSelected}
          onAdd={(place) => addListItem(session, flush, nodeId, place)}
        />
      );
    },
  };
}
