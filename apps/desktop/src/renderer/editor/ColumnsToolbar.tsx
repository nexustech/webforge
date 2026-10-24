import {
  Button,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { isNodeDoc, type NodeDoc, newId, pastedCopies } from "@webforge/model";
import {
  COLUMN_LAYOUTS,
  type ColumnLayout,
  columnLayoutsFor,
  MAX_COLUMNS,
  MIN_COLUMNS,
} from "@webforge/site-components";
import { MinusIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { ContextualToolbar } from "../shell/contextual-toolbars.js";
import type { PreviewChoices } from "./edit-previews.js";
import type { EditorSession } from "./editor-session.js";
import { holderOf } from "./element-holder.js";
import { changeField, useFieldValue } from "./field-change.js";
import { fieldTarget } from "./field-target.js";
import { labelFor } from "./labels.js";
import { breakpointOf } from "./responsive-value.js";
import { useDocument, useUi } from "./use-document.js";

/** The width and height of a layout's icon, and the gap between its columns. */
const ICON = { width: 28, height: 16, gap: 2 } as const;

/** Each column's share of the width with `layout`: a wide column takes two of the others'. */
function spans(layout: ColumnLayout, count: number): number[] {
  const each = Array.from({ length: count }, () => 1);
  if (layout === "wideFirst" && count > 1) each[0] = 2;
  if (layout === "wideLast" && count > 1) each[count - 1] = 2;
  if (layout === "wideMiddle" && count === 3) each[1] = 2;
  return each;
}

/** A layout drawn small: `count` columns as bars, a wide one twice as wide, or one under another. */
function LayoutIcon({ layout, count }: { readonly layout: ColumnLayout; readonly count: number }) {
  const { width, height, gap } = ICON;
  const bars: { x: number; y: number; w: number; h: number }[] = [];
  if (layout === "stacked") {
    const h = (height - gap * (count - 1)) / count;
    for (let index = 0; index < count; index++) {
      bars.push({ x: 0, y: index * (h + gap), w: width, h });
    }
  } else {
    const shares = spans(layout, count);
    const unit = (width - gap * (count - 1)) / shares.reduce((sum, share) => sum + share, 0);
    let x = 0;
    for (const share of shares) {
      bars.push({ x, y: 0, w: unit * share, h: height });
      x += unit * share + gap;
    }
  }
  return (
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bars.map((bar) => (
        <rect
          key={`${bar.x}-${bar.y}`}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          rx={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

/** A button named by a tooltip too: its icon is all it shows. */
function IconButton({
  name,
  disabled,
  onClick,
  children,
}: {
  readonly name: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      {/* A disabled button gets no pointer events, so the tooltip hangs on a wrapper. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={name}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

/** The one item of the outlines toggle, a toggle group of one so it looks like the others. */
const OUTLINES = "outlines";

/**
 * A Columns element's toolbar under the canvas toolbar (SP-4, 2.17): its number of columns, with
 * Add and Remove; its layout on the device shown, from the presets that fit that number; and
 * *Show column outlines*, an edit-only preview.
 */
function ColumnsTools({
  count,
  layout,
  device,
  outlines,
  onAdd,
  onRemove,
  onLayout,
  onOutlines,
}: {
  readonly count: number;
  /** The layout on the device shown. */
  readonly layout: ColumnLayout;
  /** The device view the layout is set for. */
  readonly device: "desktop" | "tablet" | "mobile";
  readonly outlines: boolean;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
  readonly onLayout: (layout: ColumnLayout) => void;
  readonly onOutlines: (shown: boolean) => void;
}) {
  const columnsId = useId();
  const layoutId = useId();
  const layouts = columnLayoutsFor(count);
  // A layout that doesn't fit this many columns draws as equal widths.
  const shown = layouts.includes(layout) ? layout : "equal";
  return (
    <div className="flex items-center gap-4">
      <fieldset aria-labelledby={columnsId} className="flex items-center gap-1">
        <span id={columnsId} className="mr-1 text-xs font-medium">
          {t("columnsToolbar.columns")}
        </span>
        <IconButton
          name={t("columnsToolbar.removeColumn")}
          disabled={count <= MIN_COLUMNS}
          onClick={onRemove}
        >
          <MinusIcon aria-hidden />
        </IconButton>
        <span className="w-4 text-center text-xs tabular-nums">{count}</span>
        <IconButton
          name={t("columnsToolbar.addColumn")}
          disabled={count >= MAX_COLUMNS}
          onClick={onAdd}
        >
          <PlusIcon aria-hidden />
        </IconButton>
      </fieldset>
      <div className="flex items-center gap-2">
        <span id={layoutId} className="text-xs font-medium">
          {t("columnsToolbar.layoutOn", { device: t(`device.${device}`) })}
        </span>
        <ToggleGroup
          type="single"
          aria-labelledby={layoutId}
          value={shown}
          onValueChange={(next) => {
            const chosen = layouts.find((each) => each === next);
            if (chosen !== undefined) onLayout(chosen);
          }}
        >
          {layouts.map((each) => (
            <Tooltip key={each}>
              <TooltipTrigger asChild>
                <ToggleGroupItem value={each} aria-label={t(`field.columnLayout.${each}`)}>
                  <LayoutIcon layout={each} count={count} />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{t(`field.columnLayout.${each}`)}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      </div>
      <ToggleGroup
        type="multiple"
        aria-label={t("columnsToolbar.previewLabel")}
        value={outlines ? [OUTLINES] : []}
        onValueChange={(next) => onOutlines(next.includes(OUTLINES))}
      >
        <ToggleGroupItem value={OUTLINES}>{t("columnsToolbar.showOutlines")}</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

/** The Columns `nodeId` is or is in, and the Column if it is one (see `holderOf`). */
function columnsOf(session: EditorSession, nodeId: string) {
  const { pageId } = session.ui.getState();
  return holderOf(
    session.history.document.getState(),
    session,
    pageId,
    nodeId,
    "Columns",
    "Column",
  );
}

/** A Columns element's columns, as the document holds them. */
const columnsIn = (node: NodeDoc | undefined): NodeDoc[] => {
  const stored = node?.props.columns;
  return Array.isArray(stored) ? stored.filter(isNodeDoc) : [];
};

/**
 * Adds a column at the end of the Columns `nodeId` is or is in, as one "Added Column" step that
 * selects it: with a Text in it, as a new Columns' columns have, every element with an id of its
 * own. It goes where the Edit panel writes the Columns: the page, the shared Header or Footer, or
 * a linked copy's shared section. `flush` ends a canvas text session first.
 */
function addColumn(session: EditorSession, flush: () => void, nodeId: string): void {
  flush();
  const found = columnsOf(session, nodeId);
  const site = session.history.document.getState();
  const { pageId, viewport } = session.ui.getState();
  const target =
    found === undefined ? undefined : fieldTarget(site, session.library, pageId, found.holderId);
  const placed = session.library.components.Columns?.defaults.columns;
  const [template] = Array.isArray(placed) ? placed.filter(isNodeDoc) : [];
  if (found === undefined || target === undefined || template === undefined) return;
  if (columnsIn(target.node).length >= MAX_COLUMNS) return;
  const id = newId("node");
  const ids = [id];
  const [column] = pastedCopies([template], new Set(), () => ids.shift() ?? newId("node"));
  if (column === undefined) return;
  const label =
    target.copyLabel ??
    labelFor(
      {
        kind: "insert",
        nodeId: id,
        componentType: "Column",
        field: null,
        page: target.page,
        selection: id,
      },
      session.library,
    );
  const prefix = found.holderId.slice(0, found.holderId.lastIndexOf("~") + 1);
  session.edit(
    "insert",
    label,
    target.recipe("columns", (stored) => [
      ...(Array.isArray(stored) ? stored.filter(isNodeDoc) : []),
      column,
    ]),
    { selectionAfter: { pageId, viewport, nodeId: `${prefix}${id}` }, apply: true },
  );
}

/**
 * Removes the last column of the Columns `nodeId` is or is in, with what's in it, as one "Deleted
 * Column" step; the Columns is selected after it if that column was.
 */
function removeColumn(session: EditorSession, flush: () => void, nodeId: string): void {
  flush();
  const found = columnsOf(session, nodeId);
  const site = session.history.document.getState();
  const { pageId, viewport, nodeId: selected } = session.ui.getState();
  const target =
    found === undefined ? undefined : fieldTarget(site, session.library, pageId, found.holderId);
  const columns = columnsIn(target?.node);
  const last = columns.at(-1);
  if (found === undefined || target === undefined || last === undefined) return;
  if (columns.length <= MIN_COLUMNS) return;
  const prefix = found.holderId.slice(0, found.holderId.lastIndexOf("~") + 1);
  const lastId = `${prefix}${last.props.id}`;
  const label =
    target.copyLabel ??
    labelFor(
      {
        kind: "remove",
        nodeId: lastId,
        componentType: "Column",
        field: null,
        page: target.page,
        selection: found.holderId,
      },
      session.library,
    );
  session.edit(
    "remove",
    label,
    target.recipe("columns", (stored) =>
      (Array.isArray(stored) ? stored.filter(isNodeDoc) : []).slice(0, -1),
    ),
    {
      // The toolbar shows for the Columns or one of its columns: the one going hands it on.
      selectionAfter: { pageId, viewport, nodeId: selected === lastId ? found.holderId : selected },
      apply: true,
    },
  );
}

/**
 * The selected Columns', or Column's, toolbar in the row under the canvas toolbar (SP-4, 2.17), in
 * `session`: Add and Remove a column, the layout on the device shown (as from the Edit panel, one
 * undo step each), and *Show column outlines* in `previews`. Columns change the design, so it shows
 * in Design mode only.
 */
export function columnsToolbar({
  session,
  flush,
  previews,
}: {
  readonly session: EditorSession;
  readonly flush: () => void;
  readonly previews: StoreApi<PreviewChoices>;
}): ContextualToolbar {
  return {
    id: "columns",
    types: ["Columns", "Column"],
    component: function ColumnsToolbar({ nodeId }) {
      const pageId = useUi(session, (ui) => ui.pageId);
      const device = useUi(session, (ui) => breakpointOf(ui.viewport));
      const columnsId = useDocument(
        session,
        (site) => holderOf(site, session, pageId, nodeId, "Columns", "Column")?.holderId ?? nodeId,
      );
      const count = useDocument(
        session,
        (site) => columnsIn(fieldTarget(site, session.library, pageId, columnsId)?.node).length,
      );
      const stored = useFieldValue(session, columnsId, "layout");
      const outlines = useStore(previews, (choices) => choices.columnOutlines);
      const layout = COLUMN_LAYOUTS.find((each) => each === stored);
      return (
        <ColumnsTools
          count={count}
          layout={layout ?? "equal"}
          device={device}
          outlines={outlines}
          onAdd={() => addColumn(session, flush, nodeId)}
          onRemove={() => removeColumn(session, flush, nodeId)}
          onLayout={(next) => changeField(session, flush, columnsId, "layout", next)}
          onOutlines={(columnOutlines) => previews.setState({ columnOutlines })}
        />
      );
    },
  };
}
