import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n/components";
import { isNodeDoc, type NodeDoc, newId, pastedCopies, type SiteDoc } from "@webforge/model";
import {
  type ComponentLibrary,
  FOOTER_PRESETS,
  type FooterPreset,
  footerPreset,
  MAX_FOOTER_COLUMNS,
} from "@webforge/site-components";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useId } from "react";
import type { ContextualToolbar } from "../shell/contextual-toolbars.js";
import { IconButton } from "./ColumnsToolbar.js";
import type { EditorSession } from "./editor-session.js";
import { labelFor } from "./labels.js";
import { useDocument } from "./use-document.js";

/** The site's Footer, in the shared layout (C5). */
const footerOf = (site: SiteDoc): NodeDoc | undefined =>
  site.layout.footer.find((node) => node.type === "Footer");

/** The Footer's columns, as the document holds them. */
const columnsOf = (footer: NodeDoc | undefined): NodeDoc[] => {
  const stored = footer?.props.columns;
  return Array.isArray(stored) ? stored.filter(isNodeDoc) : [];
};

/** How many elements the Footer's columns hold: what *Start from* replaces. */
const elementsIn = (footer: NodeDoc | undefined): number =>
  columnsOf(footer).reduce((sum, column) => {
    const content = column.props.content;
    return sum + (Array.isArray(content) ? content.filter(isNodeDoc).length : 0);
  }, 0);

/** `node` with its component's defaults under its own props, and the same for what it holds. */
function withDefaults(library: ComponentLibrary, node: NodeDoc): NodeDoc {
  const props: Record<string, unknown> = {
    ...library.components[node.type]?.defaults,
    ...node.props,
  };
  for (const [name, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.length > 0 && value.every(isNodeDoc)) {
      props[name] = value.map((child) => withDefaults(library, child));
    }
  }
  return { type: node.type, props: props as NodeDoc["props"] };
}

/**
 * Starts the Footer from `preset` (HF-4, 5.39): its layout and its columns as *Start from* gives
 * them, every element with its defaults and an id of its own, in place of the columns it had, as
 * one "Started the Footer from …" step that selects it. Its own text stays. When that replaces
 * elements, an Undo toast says so, rather than a question first (LF-15). `flush` ends a canvas
 * text session first.
 */
function startFooterFrom(
  session: Pick<EditorSession, "history" | "ui" | "edit" | "library">,
  flush: () => void,
  preset: FooterPreset,
): void {
  flush();
  const footer = footerOf(session.history.document.getState());
  if (footer === undefined) return;
  const { variant, columns } = footerPreset(preset);
  const placed = pastedCopies(
    columns.map((column) => withDefaults(session.library, column)),
    new Set(),
    () => newId("node"),
  );
  const { pageId, viewport } = session.ui.getState();
  const name = t(`footerToolbar.preset.${preset}`);
  session.edit(
    "props",
    t("footerToolbar.started", { preset: name }),
    (draft) => {
      const node = footerOf(draft);
      if (node === undefined) return;
      node.props.variant = variant;
      node.props.columns = placed;
    },
    {
      selectionAfter: { pageId, viewport, nodeId: footer.props.id },
      apply: true,
      announce: elementsIn(footer) > 0 && t("footerToolbar.startedEverywhere", { preset: name }),
    },
  );
}

/**
 * Adds an empty column at the end of the Footer, as one "Added shared Footer column" step that
 * selects it, while it has fewer than three.
 */
function addFooterColumn(
  session: Pick<EditorSession, "history" | "ui" | "edit" | "library">,
  flush: () => void,
): void {
  flush();
  const site = session.history.document.getState();
  const footer = footerOf(site);
  if (footer === undefined || columnsOf(footer).length >= MAX_FOOTER_COLUMNS) return;
  const id = newId("node");
  const { pageId, viewport } = session.ui.getState();
  const page = site.pages[pageId]?.doc;
  if (page === undefined) return;
  const label = labelFor(
    {
      kind: "insert",
      nodeId: id,
      componentType: "FooterColumn",
      field: null,
      page,
      selection: id,
      shared: true,
    },
    session.library,
  );
  session.edit(
    "insert",
    label,
    (draft) => {
      const node = footerOf(draft);
      if (node === undefined) return;
      node.props.columns = [
        ...columnsOf(node),
        { type: "FooterColumn", props: { id, content: [] } },
      ];
    },
    { selectionAfter: { pageId, viewport, nodeId: id }, apply: true },
  );
}

/**
 * Removes the Footer's last column with what's in it, as one step; the Footer is selected after it
 * if that column was.
 */
function removeFooterColumn(
  session: Pick<EditorSession, "history" | "ui" | "edit" | "library">,
  flush: () => void,
): void {
  flush();
  const site = session.history.document.getState();
  const footer = footerOf(site);
  const last = columnsOf(footer).at(-1);
  const { pageId, viewport, nodeId: selected } = session.ui.getState();
  const page = site.pages[pageId]?.doc;
  if (footer === undefined || last === undefined || page === undefined) return;
  const label = labelFor(
    {
      kind: "remove",
      nodeId: last.props.id,
      componentType: "FooterColumn",
      field: null,
      page,
      selection: footer.props.id,
      shared: true,
      layout: site.layout,
    },
    session.library,
  );
  session.edit(
    "remove",
    label,
    (draft) => {
      const node = footerOf(draft);
      if (node !== undefined) node.props.columns = columnsOf(node).slice(0, -1);
    },
    {
      selectionAfter: {
        pageId,
        viewport,
        nodeId: selected === last.props.id ? footer.props.id : selected,
      },
      apply: true,
    },
  );
}

/**
 * The Footer's toolbar (HF-4, 5.39): *Start from* one of its presets, and its number of columns,
 * with Add and Remove.
 */
export function FooterTools({
  count,
  onStart,
  onAdd,
  onRemove,
}: {
  /** How many columns the Footer has. */
  readonly count: number;
  readonly onStart: (preset: FooterPreset) => void;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
}) {
  const startId = useId();
  const columnsId = useId();
  return (
    <div className="flex items-center gap-4">
      <fieldset aria-labelledby={startId} className="flex items-center gap-1">
        <span id={startId} className="mr-1 text-xs font-medium">
          {t("footerToolbar.startFrom")}
        </span>
        {FOOTER_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onStart(preset)}
          >
            {t(`footerToolbar.preset.${preset}`)}
          </Button>
        ))}
      </fieldset>
      <fieldset aria-labelledby={columnsId} className="flex items-center gap-1">
        <span id={columnsId} className="mr-1 text-xs font-medium">
          {t("footerToolbar.columns")}
        </span>
        <IconButton
          name={t("footerToolbar.removeColumn")}
          disabled={count === 0}
          onClick={onRemove}
        >
          <MinusIcon aria-hidden />
        </IconButton>
        <span className="w-4 text-center text-xs tabular-nums">{count}</span>
        <IconButton
          name={t("footerToolbar.addColumn")}
          disabled={count >= MAX_FOOTER_COLUMNS}
          onClick={onAdd}
        >
          <PlusIcon aria-hidden />
        </IconButton>
      </fieldset>
    </div>
  );
}

/**
 * The selected Footer's, or Footer column's, toolbar in the row under the canvas toolbar (SP-4,
 * 5.39), in `session`: *Start from* a preset, and Add and Remove a column, one undo step each. It
 * changes the design, so it shows in Design mode only.
 */
export function footerToolbar({
  session,
  flush,
}: {
  readonly session: EditorSession;
  readonly flush: () => void;
}): ContextualToolbar {
  return {
    id: "footer",
    types: ["Footer", "FooterColumn"],
    component: function FooterToolbar() {
      const count = useDocument(session, (site) => columnsOf(footerOf(site)).length);
      return (
        <FooterTools
          count={count}
          onStart={(preset) => startFooterFrom(session, flush, preset)}
          onAdd={() => addFooterColumn(session, flush)}
          onRemove={() => removeFooterColumn(session, flush)}
        />
      );
    },
  };
}
