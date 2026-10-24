import { Button, cn, fieldControlClass, ScrollArea } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { LAYER_NAME_MAX } from "@webforge/model";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  Link2Icon,
  LockIcon,
  PencilIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import {
  type ComponentType,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MenuPoint } from "../element-menu/ElementMenu.js";
import { isMac } from "../shell/commands.js";
import { type Layer, layerItem } from "./layers.js";

/** What the Layers panel can do; the host binds them to the editor session and its commands. */
export type LayersPanelActions = {
  select(id: string): void;
  /** Ctrl/Cmd-click (1.31): adds the layer to the selection, or takes it out. */
  toggle(id: string): void;
  /** Shift-click (1.31): selects these layers, the first the one shown. */
  selectMany(ids: readonly string[]): void;
  rename(id: string, name: string): void;
  setHidden(id: string, hidden: boolean): void;
  /** Moves a layer to `index` among its siblings. */
  move(id: string, index: number): void;
  /**
   * Copies a layer to `index` among its siblings as they are now: a Ctrl/Cmd-drag, with Shift for
   * another linked copy of a shared section (1.35, UX-4). Undefined where nothing can be copied.
   */
  copy?(id: string, index: number, linked: boolean): void;
  /** The canvas's own commands on the selected element (1.12); undefined while unavailable. */
  readonly moveUp: (() => void) | undefined;
  readonly moveDown: (() => void) | undefined;
  readonly duplicate: (() => void) | undefined;
  readonly remove: (() => void) | undefined;
};

/** Props of {@link LayersPanel}. */
export type LayersPanelProps = {
  readonly layers: readonly Layer[];
  readonly selectedId: string | null;
  /** The other selected layers, while several are (1.31). */
  readonly alsoSelected?: readonly string[];
  readonly actions: LayersPanelActions;
  /**
   * Content mode locks the layout (M3): no dragging, moving or hiding. Selecting and naming layers
   * stay; the toolbar's commands are off as their commands are.
   */
  readonly layoutLocked?: boolean;
  /**
   * The element menu (1.35), the canvas's too: open `at` a point for the selected layer, closed
   * with `onClose`; its Rename renames the layer in place.
   */
  readonly menu?: ComponentType<{
    readonly at: MenuPoint | null;
    readonly onClose: () => void;
    readonly onRename: () => void;
    /**
     * Once the menu has closed: puts the focus back on the selected layer's row, or starts renaming
     * it if Rename was chosen.
     */
    readonly onCloseFocus: () => void;
  }>;
};

/** A layer as a row: where it sits among its siblings, so moves stay within its parent. */
type Row = {
  readonly layer: Layer;
  readonly depth: number;
  readonly parent: string;
  readonly index: number;
  readonly siblings: number;
  /** Its children show below it (it has some, and isn't collapsed). */
  readonly expanded: boolean;
};

/** How the tree is shown: the layers collapsed, and the filter's text. */
type TreeView = {
  readonly collapsed: ReadonlySet<string>;
  /** Lower case; empty for no filter. */
  readonly filter: string;
};

/** Whether `layer`'s name or kind contains `filter`. */
const matches = (layer: Layer, filter: string) =>
  `${layer.name ?? ""} ${layer.kind}`.toLocaleLowerCase().includes(filter);

/** Whether `layer` or a layer inside it matches `filter`. */
const anyMatch = (layer: Layer, filter: string): boolean =>
  matches(layer, filter) || layer.children.some((child) => anyMatch(child, filter));

/**
 * The rows shown: every layer, except those inside a collapsed one; with a filter, the layers
 * that match it and the layers they are in, whatever is collapsed.
 */
function rowsOf(layers: readonly Layer[], view: TreeView, depth = 1, parent = ""): Row[] {
  return layers.flatMap((layer, index) => {
    if (view.filter !== "" && !anyMatch(layer, view.filter)) return [];
    const expanded =
      layer.children.length > 0 && (view.filter !== "" || !view.collapsed.has(layer.id));
    return [
      { layer, depth, parent, index, siblings: layers.length, expanded },
      ...(expanded ? rowsOf(layer.children, view, depth + 1, layer.id) : []),
    ];
  });
}

/** The ids of the layers `id` is inside, outermost first; empty if it isn't in `layers`. */
function parentsOf(layers: readonly Layer[], id: string | null): string[] {
  for (const layer of layers) {
    if (layer.id === id) return [];
    const inside = parentsOf(layer.children, id);
    if (inside.length > 0 || layer.children.some((child) => child.id === id)) {
      return [layer.id, ...inside];
    }
  }
  return [];
}

/** Every layer with children: what Collapse all collapses. */
const withChildren = (layers: readonly Layer[]): string[] =>
  layers.flatMap((layer) =>
    layer.children.length > 0 ? [layer.id, ...withChildren(layer.children)] : [],
  );

/**
 * Where a layer at `from` lands when dropped before or `after` its sibling at `over`, counted once
 * it has left its own place.
 */
export function dropIndex(from: number, over: number, after: boolean): number {
  const target = over + (after ? 1 : 0);
  return target > from ? target - 1 : target;
}

/** The MIME type a dragged layer travels as, so drops from elsewhere are ignored. */
const DRAG_TYPE = "application/x-webforge-layer";

/**
 * Layers (F-ED-12, UI1; Advanced mode): the page's sections and elements as a tree, selected in
 * step with the canvas. Drag a layer, or press Mod+Alt+↑/↓, to move it among its siblings; while
 * dragging, the rows it can't go to are marked (1.35). F2 or double-click renames it; the eye
 * hides it (dimmed on the canvas, left out of the export). ←/→ and the arrows beside the names
 * collapse and expand the tree, the toolbar all of it at once; the filter shows the layers whose
 * name or kind matches. A right-click (or Shift+F10) opens the element menu. The toolbar moves,
 * duplicates and deletes the selected element. Every change to the page is one undo step; how the
 * tree is shown is not.
 */
export function LayersPanel({
  layers,
  selectedId,
  alsoSelected = [],
  actions,
  layoutLocked = false,
  menu: Menu,
}: LayersPanelProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLocaleLowerCase();
  const rows = rowsOf(layers, { collapsed, filter: query });
  // A layer selected elsewhere (the canvas) shows: the layers it is in open once. They can be
  // collapsed again afterwards, hiding it.
  const latest = useRef({ layers, selectedId });
  // Kept up to date after each render, for the effect below and for focusing once React has drawn.
  useLayoutEffect(() => {
    latest.current = { layers, selectedId };
  });
  useEffect(() => {
    const parents = parentsOf(latest.current.layers, selectedId);
    setCollapsed((current) =>
      parents.some((id) => current.has(id))
        ? new Set([...current].filter((id) => !parents.includes(id)))
        : current,
    );
  }, [selectedId]);
  const [renaming, setRenaming] = useState<string | null>(null);
  // Where a Shift-click range starts: the last row clicked without Shift, as in file managers.
  const anchor = useRef<string | null>(null);
  const [menuAt, setMenuAt] = useState<MenuPoint | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean; allowed: boolean } | null>(null);
  // The row being dragged, in state too, so the rows it can't go to are marked while it moves.
  const [dragging, setDragging] = useState<Row | null>(null);
  const dragged = useRef<Row | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const selectedRow = rows.find((row) => row.layer.id === selectedId);

  const focusRow = (id: string) => {
    actions.select(id);
    // After React has rendered the new selection, which moves the focusable row.
    requestAnimationFrame(() => {
      treeRef.current?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(id)}"]`)?.focus();
    });
  };

  const setExpanded = (id: string, expanded: boolean) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (expanded) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Opens the element menu for `id` at `at`, selecting it first so the menu acts on it. */
  const openMenu = (id: string, at: MenuPoint) => {
    actions.select(id);
    setMenuAt(at);
  };

  /** Focuses the selected layer's row, as it is once React has drawn it. */
  const focusSelected = () =>
    requestAnimationFrame(() => {
      const id = latest.current.selectedId;
      if (id === null) return;
      treeRef.current?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(id)}"]`)?.focus();
    });

  const onKeyDown = (event: KeyboardEvent, row: Row) => {
    if (renaming !== null) {
      return;
    }
    const at = rows.indexOf(row);
    // The canvas's keys (F-ED-27): Mod + arrows walk the tree, Mod + Alt + ↑/↓ move (Alt + ↑/↓
    // too, Layers' first keys). Plain arrows move the focus, as in any tree (WAI-ARIA).
    const mod = isMac() ? event.metaKey : event.ctrlKey;
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && mod) {
      event.preventDefault();
      const siblings = rows.filter((other) => other.parent === row.parent);
      const sibling = siblings[siblings.indexOf(row) + (event.key === "ArrowRight" ? 1 : -1)];
      if (sibling !== undefined) focusRow(sibling.layer.id);
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const opening = event.key === "ArrowRight";
      if (row.layer.children.length > 0 && row.expanded !== opening && query === "") {
        setExpanded(row.layer.id, opening);
      } else if (opening && row.expanded) {
        const child = rows[at + 1];
        if (child !== undefined) focusRow(child.layer.id);
      } else if (!opening && row.parent !== "") {
        focusRow(row.parent);
      }
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.key === "ArrowUp" ? -1 : 1;
      if (event.altKey) {
        if (layoutLocked) {
          // Content mode keeps the layout (M3).
        } else if (alsoSelected.length > 0) {
          // Several selected: they all move, as the Edit menu's Move up and down do (1.31).
          (step < 0 ? actions.moveUp : actions.moveDown)?.();
        } else {
          actions.move(row.layer.id, row.index + step);
        }
      } else if (mod && step < 0) {
        if (row.parent !== "") focusRow(row.parent);
      } else if (mod) {
        // The first child as listed: a filter may leave it out, and then there's none to go to.
        const next = rows[at + 1];
        const first = row.layer.children[0];
        if (row.expanded && next?.parent === row.layer.id) {
          focusRow(next.layer.id);
        } else if (!row.expanded && query === "" && first !== undefined) {
          setExpanded(row.layer.id, true);
          focusRow(first.id);
        }
      } else {
        const next = rows[at + step];
        if (next !== undefined) focusRow(next.layer.id);
      }
    } else if (event.key === "F2") {
      event.preventDefault();
      setRenaming(row.layer.id);
    } else if ((event.key === "Delete" || event.key === "Backspace") && actions.remove) {
      // The canvas's Delete shortcut leaves keys in a tree to the tree: delete the selected layer.
      event.preventDefault();
      actions.remove();
    }
  };

  /** Whether the pointer is over the lower half of the row: the drop goes after it. */
  const isAfter = (event: DragEvent) => {
    const box = event.currentTarget.getBoundingClientRect();
    return event.clientY > box.top + box.height / 2;
  };

  /** Whether the dragged layer can go next to `row`: only among its own siblings. */
  const canDropAt = (from: Row, row: Row) => from.parent === row.parent;

  /** Whether a drag copies what it drags: Ctrl or Cmd held, as on the canvas (UX-4). */
  const copying = (event: DragEvent) =>
    actions.copy !== undefined && (event.ctrlKey || event.metaKey);

  const onDragOver = (event: DragEvent, row: Row) => {
    const from = dragged.current;
    // A copy may go next to the layer it copies; a move to its own place changes nothing.
    if (from === null || (from.layer.id === row.layer.id && !copying(event))) {
      return;
    }
    const allowed = canDropAt(from, row);
    const after = isAfter(event);
    if (allowed) {
      event.preventDefault();
      event.dataTransfer.dropEffect = copying(event) ? "copy" : "move";
    } else {
      // Not a drop target: the pointer shows it can't go here, before anything is dropped.
      event.dataTransfer.dropEffect = "none";
    }
    if (drop?.id !== row.layer.id || drop.after !== after || drop.allowed !== allowed) {
      setDrop({ id: row.layer.id, after, allowed });
    }
  };

  const onDrop = (event: DragEvent, row: Row) => {
    const from = dragged.current;
    event.preventDefault();
    setDrop(null);
    if (from === null || !canDropAt(from, row)) {
      return;
    }
    if (copying(event)) {
      // Next to the row it was dropped on, counted with the original still there.
      actions.copy?.(from.layer.id, row.index + (isAfter(event) ? 1 : 0), event.shiftKey === true);
    } else if (from.layer.id !== row.layer.id) {
      actions.move(from.layer.id, dropIndex(from.index, row.index, isAfter(event)));
    }
  };

  if (layers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        {t("layers.empty")}
      </div>
    );
  }

  const selected = selectedRow?.layer;
  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        {rows.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">{t("layers.noMatches")}</p>
        ) : null}
        <div
          ref={treeRef}
          role="tree"
          aria-label={t("layers.title")}
          aria-multiselectable
          className="p-1"
        >
          {rows.map((row) => {
            const { layer } = row;
            const linked =
              layer.sharedSection === undefined
                ? undefined
                : t("layers.linkedCopy", {
                    name: t("history.namedItem", { name: layer.sharedSection }),
                  });
            const isSelected = layer.id === selectedId || alsoSelected.includes(layer.id);
            const focusable = isSelected || (selectedRow === undefined && row === rows[0]);
            // While a layer is dragged, the rows it can't go next to (outside its own list).
            const notAllowed =
              dragging !== null && dragging.layer.id !== layer.id && !canDropAt(dragging, row);
            const hasChildren = layer.children.length > 0;
            return (
              <div
                key={layer.id}
                role="treeitem"
                data-layer={layer.id}
                data-drop={notAllowed ? "not-allowed" : undefined}
                aria-level={row.depth}
                aria-selected={isSelected}
                aria-setsize={row.siblings}
                aria-posinset={row.index + 1}
                aria-expanded={hasChildren ? row.expanded : undefined}
                tabIndex={focusable ? 0 : -1}
                // One drag moving several selected layers is for later (1.31): until then a
                // selected row can't be dragged while others are selected too.
                draggable={
                  !layoutLocked && renaming !== layer.id && !(isSelected && alsoSelected.length > 0)
                }
                className={cn(
                  "group relative flex h-6 items-center gap-1 rounded-sm pr-1 text-xs outline-none",
                  "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  isSelected && "bg-accent text-accent-foreground",
                  layer.hidden && !isSelected && "text-muted-foreground",
                  notAllowed && "cursor-not-allowed opacity-50",
                  drop?.id === layer.id &&
                    (!drop.allowed
                      ? "shadow-[inset_0_0_0_1px_var(--destructive)]"
                      : drop.after
                        ? "shadow-[inset_0_-2px_0_var(--ring)]"
                        : "shadow-[inset_0_2px_0_var(--ring)]"),
                )}
                style={{ paddingLeft: `${(row.depth - 1) * 12 + 4}px` }}
                onClick={(event) => {
                  const start =
                    rows.find((each) => each.layer.id === anchor.current) ?? selectedRow;
                  if (event.ctrlKey || event.metaKey) {
                    anchor.current = layer.id;
                    actions.toggle(layer.id);
                  } else if (event.shiftKey && start !== undefined) {
                    // The rows from the anchor to this one, as they are listed (1.31).
                    const from = rows.indexOf(start);
                    const to = rows.indexOf(row);
                    const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
                    actions.selectMany([
                      layer.id,
                      ...range.map((each) => each.layer.id).filter((id) => id !== layer.id),
                    ]);
                  } else {
                    anchor.current = layer.id;
                    actions.select(layer.id);
                  }
                }}
                onDoubleClick={() => setRenaming(layer.id)}
                onContextMenu={(event) => {
                  if (Menu === undefined) return;
                  event.preventDefault();
                  // From the keyboard (Shift+F10, the Menu key) there is no pointer: below the row.
                  const box = event.currentTarget.getBoundingClientRect();
                  const keyboard =
                    event.button !== 2 || (event.clientX === 0 && event.clientY === 0);
                  openMenu(
                    layer.id,
                    keyboard
                      ? { x: box.left + 16, y: box.bottom }
                      : { x: event.clientX, y: event.clientY },
                  );
                }}
                onKeyDown={(event) => onKeyDown(event, row)}
                onDragStart={(event) => {
                  dragged.current = row;
                  setDragging(row);
                  event.dataTransfer.effectAllowed =
                    actions.copy === undefined ? "move" : "copyMove";
                  event.dataTransfer.setData(DRAG_TYPE, layer.id);
                }}
                onDragEnd={() => {
                  dragged.current = null;
                  setDragging(null);
                  setDrop(null);
                }}
                onDragOver={(event) => onDragOver(event, row)}
                onDragLeave={(event) => {
                  // Moving onto the row's own label or button isn't leaving it.
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDrop(null);
                  }
                }}
                onDrop={(event) => onDrop(event, row)}
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
                    disabled={query !== ""}
                    className="flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-hover [&_svg]:size-3"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpanded(layer.id, !row.expanded);
                    }}
                  >
                    <ChevronRightIcon className={cn(row.expanded && "rotate-90")} />
                  </button>
                ) : (
                  <span aria-hidden className="size-4 shrink-0" />
                )}
                {renaming === layer.id ? (
                  <RenameField
                    layer={layer}
                    onDone={(name) => {
                      setRenaming(null);
                      if (name !== undefined) actions.rename(layer.id, name);
                      focusRow(layer.id);
                    }}
                  />
                ) : (
                  <span className={cn("min-w-0 flex-1 truncate", layer.hidden && "line-through")}>
                    {linked !== undefined && (
                      // A linked copy of a shared section (F-ED-23): its section changes everywhere.
                      <span title={linked}>
                        <Link2Icon aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                        <span className="sr-only">{linked} </span>
                      </span>
                    )}
                    {layer.locked === true && (
                      // Can't be moved or deleted, only edited (UX-12).
                      <span title={t("layers.locked")}>
                        <LockIcon aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                        <span className="sr-only">{t("layers.locked")} </span>
                      </span>
                    )}
                    {layer.animated === true && (
                      // Has an animation (UX-12, 2.12).
                      <span title={t("layers.animated")}>
                        <SparklesIcon aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                        <span className="sr-only">{t("layers.animated")} </span>
                      </span>
                    )}
                    {layer.name === undefined ? (
                      layer.kind
                    ) : (
                      <>
                        {layer.name} <span className="text-muted-foreground">{layer.kind}</span>
                      </>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={layoutLocked}
                  aria-label={t(layer.hidden ? "layers.show" : "layers.hide", {
                    item: layerItem(layer),
                  })}
                  title={t(layer.hidden ? "layers.show" : "layers.hide", {
                    item: layerItem(layer),
                  })}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-hover [&_svg]:size-3.5",
                    !layer.hidden &&
                      "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.setHidden(layer.id, !layer.hidden);
                  }}
                >
                  {layer.hidden ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* While a layer is over a row it can't go to, why: browsers show no tooltips in a drag. */}
      <p role="status" className="shrink-0 px-2 text-xs text-destructive-text empty:hidden">
        {dragging !== null && drop?.allowed === false
          ? t("layers.dropNotAllowed", { item: layerItem(dragging.layer) })
          : ""}
      </p>

      <div className="shrink-0 border-t border-border p-1">
        <input
          type="search"
          aria-label={t("layers.filter")}
          placeholder={t("layers.filterPlaceholder")}
          value={filter}
          className={cn(fieldControlClass, "h-6 w-full px-1.5 text-xs")}
          onChange={(event) => setFilter(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && filter !== "") {
              event.stopPropagation();
              setFilter("");
            }
          }}
        />
      </div>

      <div
        role="toolbar"
        aria-label={t("layers.toolbar")}
        className="flex h-8 shrink-0 items-center gap-0.5 border-t border-border px-1"
      >
        <ToolButton label={t("canvas.moveUp")} onClick={actions.moveUp}>
          <ArrowUpIcon />
        </ToolButton>
        <ToolButton label={t("canvas.moveDown")} onClick={actions.moveDown}>
          <ArrowDownIcon />
        </ToolButton>
        <ToolButton label={t("canvas.duplicate")} onClick={actions.duplicate}>
          <CopyIcon />
        </ToolButton>
        <ToolButton
          label={t(selected?.hidden === true ? "layers.show" : "layers.hide", {
            item: selected === undefined ? "" : layerItem(selected),
          })}
          onClick={
            selected === undefined || layoutLocked
              ? undefined
              : () => actions.setHidden(selected.id, !selected.hidden)
          }
        >
          {selected?.hidden === true ? <EyeOffIcon /> : <EyeIcon />}
        </ToolButton>
        <ToolButton
          label={t("layers.rename")}
          onClick={selected === undefined ? undefined : () => setRenaming(selected.id)}
        >
          <PencilIcon />
        </ToolButton>
        <ToolButton label={t("canvas.delete")} onClick={actions.remove}>
          <Trash2Icon />
        </ToolButton>
        <span className="flex-1" />
        <ToolButton label={t("layers.expandAll")} onClick={() => setCollapsed(new Set())}>
          <ChevronsUpDownIcon />
        </ToolButton>
        <ToolButton
          label={t("layers.collapseAll")}
          onClick={() => setCollapsed(new Set(withChildren(layers)))}
        >
          <ChevronsDownUpIcon />
        </ToolButton>
      </div>
      {Menu === undefined ? null : (
        <Menu
          at={menuAt}
          onClose={() => setMenuAt(null)}
          onRename={() => {
            const id = latest.current.selectedId;
            if (id !== null) setRenaming(id);
          }}
          onCloseFocus={focusSelected}
        />
      )}
    </div>
  );
}

/** A toolbar button; disabled while its action is unavailable. */
function ToolButton({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: (() => void) | undefined;
  readonly children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={onClick === undefined}
      onClick={onClick}
    >
      {children}
    </Button>
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
