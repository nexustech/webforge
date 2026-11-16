import { Button, cn, EmptyState, fieldControlClass, ScrollArea } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  LayersIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import type { CanvasPointer } from "../editor/canvas-pointer.js";
import { type Layer, layerItem } from "../editor/layers.js";
import type { MenuPoint } from "../element-menu/index.js";
import { LayerRow, type LayerRowEvents } from "./LayerRow.js";
import type { LayersPanelActions } from "./layer-rows.js";
import { useLayerDrag } from "./use-layer-drag.js";
import { useLayersTree } from "./use-layers-tree.js";

export type { LayersPanelActions } from "./layer-rows.js";

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
  /**
   * The canvas beside the panel: a row under the pointer outlines its element there with its chip
   * (SP-10), and a dragged layer's drop point shows there too (SP-8).
   */
  readonly canvas?: CanvasPointer | undefined;
};

/**
 * Layers (F-ED-12, UI1; ADR 0011): the page's sections and elements as a tree, selected in
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
  canvas,
}: LayersPanelProps) {
  const {
    rows,
    selectedRow,
    treeRef,
    filter,
    setFilter,
    query,
    renaming,
    setRenaming,
    latestSelected,
    focusRow,
    focusRowOnly,
    focusSelected,
    setExpanded,
    expandAll,
    collapseAll,
    click,
    keyDown,
  } = useLayersTree({ layers, selectedId, alsoSelected, actions, layoutLocked });
  const drag = useLayerDrag({ layers, rows, actions, canvas });
  const { dragging } = drag;
  const [menuAt, setMenuAt] = useState<MenuPoint | null>(null);

  const events: LayerRowEvents = {
    click,
    keyDown,
    startRename: setRenaming,
    renamed: (id, name) => {
      setRenaming(null);
      if (name !== undefined) actions.rename(id, name);
      focusRow(id);
    },
    // Selects the layer first, so the menu acts on it.
    openMenu:
      Menu === undefined
        ? undefined
        : (id, at) => {
            actions.select(id);
            setMenuAt(at);
          },
    setExpanded,
    hover: drag.hover,
    leave: drag.leave,
    setShown: (id, shown) => actions.setShown(id, shown),
    shownClosed: focusRowOnly,
  };

  if (layers.length === 0) {
    return (
      <EmptyState icon={LayersIcon} className="h-full justify-center">
        {t("layers.empty")}
      </EmptyState>
    );
  }

  const selected = selectedRow?.layer;
  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        {rows.length === 0 ? <EmptyState>{t("layers.noMatches")}</EmptyState> : null}
        <div
          ref={treeRef}
          role="tree"
          aria-label={t("layers.title")}
          aria-multiselectable
          className="p-1"
        >
          {rows.map((row) => {
            const { layer } = row;
            const isSelected = layer.id === selectedId || alsoSelected.includes(layer.id);
            return (
              <LayerRow
                key={layer.id}
                row={row}
                events={events}
                selected={isSelected}
                focusable={isSelected || (selectedRow === undefined && row === rows[0])}
                // One drag moving several selected layers is for later (1.31): until then a
                // selected row can't be dragged while others are selected too.
                draggable={
                  !layoutLocked &&
                  renaming !== layer.id &&
                  !(isSelected && alsoSelected.length > 0) &&
                  drag.movable(row)
                }
                notAllowed={drag.notAllowed(row)}
                renaming={renaming === layer.id}
                filtering={query !== ""}
                layoutLocked={layoutLocked}
                drag={drag.rowDrag}
              />
            );
          })}
        </div>
      </ScrollArea>

      {/* Only the shared Header and Footer (#673), and a post's Blog design (#936): the page has no
      sections of its own yet. */}
      {layers.every((layer) => layer.region !== undefined || layer.design !== undefined) && (
        <EmptyState className="shrink-0">{t("layers.empty")}</EmptyState>
      )}

      {/* While a layer is over a row it can't go to, why: browsers show no tooltips in a drag. */}
      <p role="status" className="shrink-0 px-2 text-xs text-destructive-text empty:hidden">
        {dragging !== null && drag.rowDrag.drop?.allowed === false
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
              : () => actions.setShown(selected.id, selected.hidden ? "shown" : "hidden")
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
        <ToolButton label={t("layers.expandAll")} onClick={expandAll}>
          <ChevronsUpDownIcon />
        </ToolButton>
        <ToolButton label={t("layers.collapseAll")} onClick={collapseAll}>
          <ChevronsDownUpIcon />
        </ToolButton>
      </div>
      {Menu === undefined ? null : (
        <Menu
          at={menuAt}
          onClose={() => setMenuAt(null)}
          onRename={() => {
            const id = latestSelected();
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
      tooltip={label}
      disabled={onClick === undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
