import { Button, cn, fieldControlClass, ScrollArea } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { type DragEvent, type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { type Layer, layerItem } from "./layers.js";

/** What the Layers panel can do; the host binds them to the editor session and its commands. */
export type LayersPanelActions = {
  select(id: string): void;
  rename(id: string, name: string): void;
  setHidden(id: string, hidden: boolean): void;
  /** Moves a layer to `index` among its siblings. */
  move(id: string, index: number): void;
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
  readonly actions: LayersPanelActions;
};

/** A layer as a row: where it sits among its siblings, so moves stay within its parent. */
type Row = {
  readonly layer: Layer;
  readonly depth: number;
  readonly parent: string;
  readonly index: number;
  readonly siblings: number;
};

function rowsOf(layers: readonly Layer[], depth = 1, parent = ""): Row[] {
  return layers.flatMap((layer, index) => [
    { layer, depth, parent, index, siblings: layers.length },
    ...rowsOf(layer.children, depth + 1, layer.id),
  ]);
}

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
 * step with the canvas. Drag a layer, or press Alt+↑/↓, to move it among its siblings; F2 or
 * double-click renames it; the eye hides it (dimmed on the canvas, left out of the export). The
 * toolbar moves, duplicates and deletes the selected element. Every change is one undo step.
 */
export function LayersPanel({ layers, selectedId, actions }: LayersPanelProps) {
  const rows = rowsOf(layers);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
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

  const onKeyDown = (event: KeyboardEvent, row: Row) => {
    if (renaming !== null) {
      return;
    }
    const at = rows.indexOf(row);
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.key === "ArrowUp" ? -1 : 1;
      if (event.altKey) {
        actions.move(row.layer.id, row.index + step);
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

  const onDragOver = (event: DragEvent, row: Row) => {
    const from = dragged.current;
    if (from === null || from.parent !== row.parent || from.layer.id === row.layer.id) {
      return;
    }
    event.preventDefault();
    const after = isAfter(event);
    if (drop?.id !== row.layer.id || drop.after !== after) {
      setDrop({ id: row.layer.id, after });
    }
  };

  const onDrop = (event: DragEvent, row: Row) => {
    const from = dragged.current;
    event.preventDefault();
    setDrop(null);
    if (from === null || from.parent !== row.parent || from.layer.id === row.layer.id) {
      return;
    }
    actions.move(from.layer.id, dropIndex(from.index, row.index, isAfter(event)));
  };

  if (rows.length === 0) {
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
        <div ref={treeRef} role="tree" aria-label={t("layers.title")} className="p-1">
          {rows.map((row) => {
            const { layer } = row;
            const isSelected = layer.id === selectedId;
            const focusable = isSelected || (selectedRow === undefined && row === rows[0]);
            return (
              <div
                key={layer.id}
                role="treeitem"
                data-layer={layer.id}
                aria-level={row.depth}
                aria-selected={isSelected}
                aria-setsize={row.siblings}
                aria-posinset={row.index + 1}
                tabIndex={focusable ? 0 : -1}
                draggable={renaming !== layer.id}
                className={cn(
                  "group relative flex h-6 items-center gap-1 rounded-sm pr-1 text-xs outline-none",
                  "hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  isSelected && "bg-accent text-accent-foreground",
                  layer.hidden && !isSelected && "text-muted-foreground",
                  drop?.id === layer.id &&
                    (drop.after
                      ? "shadow-[inset_0_-2px_0_var(--ring)]"
                      : "shadow-[inset_0_2px_0_var(--ring)]"),
                )}
                style={{ paddingLeft: `${(row.depth - 1) * 12 + 8}px` }}
                onClick={() => actions.select(layer.id)}
                onDoubleClick={() => setRenaming(layer.id)}
                onKeyDown={(event) => onKeyDown(event, row)}
                onDragStart={(event) => {
                  dragged.current = row;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(DRAG_TYPE, layer.id);
                }}
                onDragEnd={() => {
                  dragged.current = null;
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
            selected === undefined
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
      </div>
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
      maxLength={100}
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
