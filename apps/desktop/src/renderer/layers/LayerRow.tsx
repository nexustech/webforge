import { cn, fieldControlClass } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { LAYER_NAME_MAX } from "@webforge/model";
import { ChevronRightIcon, Link2Icon, LockIcon, SparklesIcon, StickyNoteIcon } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, type ReactNode, useRef, useState } from "react";
import { type Layer, type LayerShown, layerItem } from "../editor/layers.js";
import type { MenuPoint } from "../element-menu/index.js";
import { DRAGGABLE_ROW_CLASS, type RowDrag } from "../shell/use-row-drag.js";
import type { TreeRow } from "./layer-rows.js";
import { ShownMenu } from "./ShownMenu.js";

/** What a row does when it's used: the panel's handlers, given the row or its layer's id. */
export type LayerRowEvents = {
  click(event: MouseEvent, row: TreeRow): void;
  keyDown(event: KeyboardEvent, row: TreeRow): void;
  startRename(id: string): void;
  /** Renaming ended: with the name typed, or undefined when it was cancelled. */
  renamed(id: string, name: string | undefined): void;
  /** Opens the element menu for `id` at `at`; undefined where the panel has none. */
  readonly openMenu: ((id: string, at: MenuPoint) => void) | undefined;
  setExpanded(id: string, expanded: boolean): void;
  hover(id: string): void;
  leave(id: string): void;
  setShown(id: string, shown: LayerShown): void;
  /** The row's eye menu has closed: the row takes the focus back. */
  shownClosed(id: string): void;
};

/** Props of {@link LayerRow}. */
type LayerRowProps = {
  readonly row: TreeRow;
  readonly events: LayerRowEvents;
  readonly selected: boolean;
  /** In the tab order: the selected row, or the first when none is. */
  readonly focusable: boolean;
  readonly draggable: boolean;
  /** While a layer is dragged: it can't go next to this row. */
  readonly notAllowed: boolean;
  readonly renaming: boolean;
  /** A filter is on: every row that matches shows, and none collapses. */
  readonly filtering: boolean;
  readonly layoutLocked: boolean;
  readonly drag: Pick<RowDrag<TreeRow>, "rowProps" | "indicatorClass">;
};

/**
 * A layer's row in the Layers panel's tree: its arrow, its name with what marks it (linked,
 * shared, locked, animated, a note), or the field renaming it, and its eye.
 */
export function LayerRow({
  row,
  events,
  selected,
  focusable,
  draggable,
  notAllowed,
  renaming,
  filtering,
  layoutLocked,
  drag,
}: LayerRowProps) {
  const { layer } = row;
  const hasChildren = layer.children.length > 0;
  return (
    <div
      role="treeitem"
      data-layer={layer.id}
      data-drop={notAllowed ? "not-allowed" : undefined}
      aria-level={row.depth}
      aria-selected={selected}
      aria-setsize={row.siblings}
      aria-posinset={row.index + 1}
      aria-expanded={hasChildren ? row.expanded : undefined}
      // A note's text (UX-17), read after the name: the name only says it has one.
      aria-description={layer.note}
      tabIndex={focusable ? 0 : -1}
      {...drag.rowProps(row, draggable)}
      className={cn(
        draggable && DRAGGABLE_ROW_CLASS,
        "group relative flex h-6 items-center gap-1 rounded-sm pr-1 text-xs outline-none",
        "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        selected && "bg-accent text-accent-foreground",
        layer.hidden && !selected && "text-muted-foreground",
        notAllowed && "cursor-not-allowed opacity-50",
        drag.indicatorClass(row),
      )}
      style={{ paddingLeft: `${(row.depth - 1) * 12 + 4}px` }}
      // Its element outlined on the canvas, with its chip, as a breadcrumb does (SP-10).
      onPointerEnter={() => events.hover(layer.id)}
      onPointerLeave={() => events.leave(layer.id)}
      onClick={(event) => events.click(event, row)}
      onDoubleClick={() => events.startRename(layer.id)}
      onContextMenu={(event) => {
        if (events.openMenu === undefined) return;
        event.preventDefault();
        // From the keyboard (Shift+F10, the Menu key) there is no pointer: below the row.
        const box = event.currentTarget.getBoundingClientRect();
        const keyboard = event.button !== 2 || (event.clientX === 0 && event.clientY === 0);
        events.openMenu(
          layer.id,
          keyboard ? { x: box.left + 16, y: box.bottom } : { x: event.clientX, y: event.clientY },
        );
      }}
      onKeyDown={(event) => events.keyDown(event, row)}
    >
      {hasChildren ? (
        // For the mouse: the row itself expands and collapses with →/←, and says
        // which it is (aria-expanded), so the arrow isn't part of its name.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          title={t(row.expanded ? "layers.collapse" : "layers.expand", {
            item: layerItem(layer),
          })}
          disabled={filtering}
          className="flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-hover [&_svg]:size-3"
          onClick={(event) => {
            event.stopPropagation();
            events.setExpanded(layer.id, !row.expanded);
          }}
        >
          <ChevronRightIcon className={cn(row.expanded && "rotate-90")} />
        </button>
      ) : (
        <span aria-hidden className="size-4 shrink-0" />
      )}
      {renaming ? (
        <RenameField layer={layer} onDone={(name) => events.renamed(layer.id, name)} />
      ) : (
        <LayerName row={row} />
      )}
      <ShownMenu
        layer={layer}
        disabled={layoutLocked}
        // Not the shared Header or Footer itself (its row has the region), which the
        // page's settings leave out.
        canHideWhileEditing={layer.region === undefined}
        onClosed={() => events.shownClosed(layer.id)}
        onShown={(shown) => events.setShown(layer.id, shown)}
      />
    </div>
  );
}

/** A mark before a layer's name: an icon, and its meaning for a screen reader and on pointing. */
function Mark({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <span title={label}>
      {children}
      <span className="sr-only">{label} </span>
    </span>
  );
}

const MARK_ICON = "mr-1 inline size-3.5 align-[-2px]";

/** A layer's name and kind, with what marks it. */
function LayerName({ row }: { readonly row: TreeRow }) {
  const { layer } = row;
  return (
    <span
      className={cn(
        "min-w-0 flex-1 truncate",
        layer.hidden && "line-through",
        layer.editorHidden === true && !layer.hidden && "italic text-muted-foreground",
      )}
    >
      {layer.sharedSection !== undefined && (
        // A linked copy of a shared section (F-ED-23): its section changes everywhere.
        <Mark
          label={t("layers.linkedCopy", {
            name: t("history.namedItem", { name: layer.sharedSection }),
          })}
        >
          <Link2Icon aria-hidden className={MARK_ICON} />
        </Mark>
      )}
      {row.parent === "" && layer.region !== undefined && (
        // The shared Header or Footer (#673), marked as shared sections are (UX-12).
        <Mark label={t("layers.onEveryPage")}>
          <Link2Icon aria-hidden className={MARK_ICON} />
        </Mark>
      )}
      {row.parent === "" && layer.design !== undefined && (
        // A Blog's design (#936), drawn on every post.
        <Mark label={t("layers.onEveryPost")}>
          <Link2Icon aria-hidden className={MARK_ICON} />
        </Mark>
      )}
      {layer.locked === true && (
        // Can't be moved or deleted, only edited (UX-12).
        <Mark label={t("layers.locked")}>
          <LockIcon aria-hidden className={MARK_ICON} />
        </Mark>
      )}
      {layer.animated === true && (
        // Has an animation (UX-12, 2.12).
        <Mark label={t("layers.animated")}>
          <SparklesIcon aria-hidden className={MARK_ICON} />
        </Mark>
      )}
      {layer.name === undefined ? (
        layer.kind
      ) : (
        <>
          {layer.name} <span className="text-muted-foreground">{layer.kind}</span>
        </>
      )}
      {layer.note !== undefined && (
        // A note for the person (UX-17, #868), after the name, its text on pointing at it.
        <span title={layer.note}>
          <StickyNoteIcon aria-hidden className="ml-1 inline size-3.5 align-[-2px] text-warning" />
          <span className="sr-only">{`, ${t("notes.marker")}`}</span>
        </span>
      )}
    </span>
  );
}

/** Renames a layer in place: Enter or leaving the field keeps the name, Escape cancels. */
function RenameField({
  layer,
  onDone,
}: {
  readonly layer: Layer;
  readonly onDone: (name: string | undefined) => void;
}) {
  const [value, setValue] = useState(layer.name ?? "");
  const done = useRef(false);
  const finish = (name: string | undefined) => {
    if (!done.current) {
      done.current = true;
      onDone(name);
    }
  };
  return (
    <input
      aria-label={t("layers.nameField", { item: layer.kind })}
      placeholder={layer.kind}
      // biome-ignore lint/a11y/noAutofocus: renaming starts by typing the name.
      autoFocus
      maxLength={LAYER_NAME_MAX}
      value={value}
      className={cn(fieldControlClass, "h-5 flex-1 px-1 text-xs")}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.currentTarget.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(value);
        else if (event.key === "Escape") finish(undefined);
      }}
      onBlur={() => finish(value)}
    />
  );
}
