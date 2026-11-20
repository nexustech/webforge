import { ActionBar, createUsePuck, useGetPuck } from "@puckeditor/core";
import { t } from "@webforge/i18n";
import type { Breakpoint } from "@webforge/model";
import { HIDDEN_ATTRIBUTE } from "@webforge/model";
import { PREVIEW_ATTRIBUTE } from "@webforge/site-components";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  PaletteIcon,
  PencilIcon,
} from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { FieldDrag, InsertPoint } from "../canvas-engine.js";

/** Marks the element outlined from outside the canvas (`CanvasEngine.outline`). */
export const OUTLINED_ATTRIBUTE = "data-wf-outlined";

import { followPlacement } from "./bar-placement.js";
import { FRAME_TOOLTIP_CSS } from "./frame-tooltips.js";
import {
  ACTION_BAR,
  ACTIONS,
  ACTIONS_OVERLAY,
  componentSelector,
  EMPTY_TABLE_BODY,
  elementOf,
  HOVERED_COMPONENT,
  NOTE_ATTRIBUTE,
  OVERLAY,
  SELECTED_COMPONENT,
  TABLE_ROW_WRAPPER,
} from "./puck-dom.js";
import { canPerform, performOnSelected } from "./selected-actions.js";
import { type BoxHandleField, SPACING_HANDLES_CSS, SpacingHandles } from "./spacing-handles.js";
import { ensureStyle } from "./styles.js";
import { ROOT_ZONE } from "./tree.js";
import { OPTION_ATTRIBUTES } from "./view-attributes.js";
import { WIDTH_HANDLES_CSS, type WidthHandleField, WidthHandles } from "./width-handles.js";

const usePuck = createUsePuck();

/** Marks the `<style>` with the canvas chrome's own rules in the canvas document. */
const CHROME_STYLE_ATTRIBUTE = "data-webforge-chrome";

/**
 * The canvas chrome's styles (UI1 §3, LF-1): outlines in the editor's accent, 1 px on hover and
 * 2 px on the selected element, and the grid's magenta only for *Show outlines* and the columns'
 * outlines. They live in the canvas document, which has none of the editor's own styles, so they
 * are self-contained; widths are divided by the canvas zoom so they stay 1 and 2 px on screen.
 */
const CHROME_CSS = `
.wf-outline {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.wf-outline[data-state="hover"] {
  outline: calc(1px / var(--wf-zoom, 1)) solid var(--wf-outline-color);
}
.wf-outline[data-state="selected"] {
  outline: calc(2px / var(--wf-zoom, 1)) solid var(--wf-outline-color);
}
/* The floating + (UI1): the editor's primary colour, 24 px on screen. */
.wf-add {
  position: absolute;
  left: 50%;
  bottom: 0;
  z-index: 1;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--wf-primary);
  color: var(--wf-primary-foreground);
  font: 600 18px/24px system-ui, sans-serif;
  text-align: center;
  cursor: pointer;
  pointer-events: auto;
  transform: translate(-50%, 50%) scale(calc(1 / var(--wf-zoom, 1)));
}
/* An element outlined from outside the canvas (a breadcrumb under the pointer): as on hover. */
[${OUTLINED_ATTRIBUTE}] {
  outline: calc(1px / var(--wf-zoom, 1)) solid var(--wf-outline-color);
  outline-offset: calc(-1px / var(--wf-zoom, 1));
}
/* *Show column outlines* (2.17): each Column's edges, dashed in the grid's magenta (LF-1). */
[${PREVIEW_ATTRIBUTE}="column-outline"] {
  outline: calc(1px / var(--wf-zoom, 1)) dashed color-mix(in srgb, var(--wf-grid-color) 55%, transparent);
  outline-offset: calc(-1px / var(--wf-zoom, 1));
}
/*
 * A table's rows (6.16c): a table's body is a slot's drop zone (as "tbody"), and Puck wraps each
 * row in it in a div of its own, which a table can't lay out. The wrapper is drawn as the row, the
 * row's own element letting its cells through to it, so Puck's outline, its drag and its drop
 * line have the row's box. A browser finds a pointer on a table's cells, never on its rows, and
 * Puck takes it from everything in a wrapper: the cells take it again, for the row's wrapper, so
 * a click or a drag on a row is the row's, not its table's. At a phone's width (the themes'
 * 48rem, which the Table's own classes reach as Tailwind's max-md: in site-components'
 * catalogue/table.tsx) the wrapper stacks its cells, as the export's rows do.
 *
 * A body with no rows keeps the room Puck gives an empty slot, to drop a row in: a table's body
 * takes no minimum height, so a cell of that height holds it open.
 */
${TABLE_ROW_WRAPPER} {
  display: table-row;
}
${TABLE_ROW_WRAPPER} > tr {
  display: contents;
}
${TABLE_ROW_WRAPPER} > tr > * {
  pointer-events: auto;
}
${EMPTY_TABLE_BODY}::after {
  content: "";
  display: table-cell;
  height: var(--puck-slot-min-empty-height, 128px);
}
@media (width < 48rem) {
  ${TABLE_ROW_WRAPPER} {
    display: block;
  }
}
/* A hidden element (Layers' Hide): dimmed, still there to select and show again. */
[${HIDDEN_ATTRIBUTE}] {
  opacity: 0.35;
}
/* An element with a note (UX-17): a dashed amber outline, inside it, so nothing moves. */
[${NOTE_ATTRIBUTE}] {
  outline: calc(2px / var(--wf-zoom, 1)) dashed #f59e0b;
  outline-offset: calc(-2px / var(--wf-zoom, 1));
}
/* An empty page's *Add Your First Section…* (#1012), where its sections would go. */
.wf-empty-page {
  display: flex;
  justify-content: center;
  padding: calc(48px / var(--wf-zoom, 1)) 16px;
}
.wf-empty-page__add {
  padding: calc(8px / var(--wf-zoom, 1)) calc(14px / var(--wf-zoom, 1));
  border: 0;
  border-radius: calc(6px / var(--wf-zoom, 1));
  background: var(--wf-primary);
  color: var(--wf-primary-foreground);
  font: 600 calc(14px / var(--wf-zoom, 1)) / 1.2 system-ui, sans-serif;
  cursor: pointer;
}
.wf-empty-page__add:focus-visible {
  outline: 2px solid var(--wf-outline-color);
  outline-offset: 2px;
}
.wf-add:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
/*
 * The element's bar (LF-3): the accent with white Lucide icons and text, square-ish, on the
 * element's top-left corner just outside it. Puck places its box with inline styles (top right,
 * scaled to the screen), which these move to the left and lift above the element's edge.
 */
:root {
  --puck-actionbar-color-bg: var(--wf-primary);
  --puck-actionbar-color-text: var(--wf-primary-foreground);
  --puck-actionbar-opacity-text: 1;
  --puck-actionbar-color-action-hover: var(--wf-primary-foreground);
  --puck-actionbar-color-action-active: var(--wf-primary-foreground);
  --puck-actionbar-color-separator: color-mix(in srgb, var(--wf-primary-foreground) 35%, transparent);
  --puck-actionbar-radius: 3px;
}
${ACTIONS} {
  left: 0 !important;
  right: auto !important;
  padding-left: 0 !important;
  transform-origin: left top !important;
  margin-top: calc(7px / var(--wf-zoom, 1));
}
/*
 * The selected element's bar is moved off its text (#1177): Puck's box for it stays where it was,
 * so only the bar itself takes clicks, not that empty box over the page.
 */
${SELECTED_COMPONENT} ${ACTIONS} {
  pointer-events: none !important;
}
${SELECTED_COMPONENT} ${ACTIONS} ${ACTION_BAR} {
  pointer-events: auto;
}
/*
 * A hovered element shows its name chip there too (SP-1): only the chip, which takes no clicks, so
 * the selected element's bar under it keeps them (Puck lets everything in its overlays take clicks).
 */
${HOVERED_COMPONENT}:not(${SELECTED_COMPONENT}) ${ACTIONS_OVERLAY} {
  opacity: 1;
}
${HOVERED_COMPONENT}:not(${SELECTED_COMPONENT}) ${ACTIONS_OVERLAY} * {
  pointer-events: none !important;
}
${SPACING_HANDLES_CSS}${WIDTH_HANDLES_CSS}${FRAME_TOOLTIP_CSS}`;

/** The editor's colours the chrome is drawn in (UI1, LF-1), from its theme's tokens. */
export type ChromeTokens = {
  /**
   * `--primary` and `--primary-foreground`: hover and selection outlines, the other selected
   * elements, the bar and name chips, the floating +.
   */
  readonly primary: string;
  readonly primaryForeground: string;
  /** `--grid-outline`: *Show outlines* and the columns' outlines. */
  readonly grid: string;
  /** `--popover`, `--popover-foreground` and `--border-strong`: the controls' tooltips (#1011). */
  readonly popover: string;
  readonly popoverForeground: string;
  readonly borderStrong: string;
};

/** The light theme's colours, where the editor document has no tokens (a test without its CSS). */
const DEFAULT_TOKENS: ChromeTokens = {
  primary: "#0a6fb7",
  primaryForeground: "#ffffff",
  grid: "#f028f3",
  popover: "#ffffff",
  popoverForeground: "#26292b",
  borderStrong: "#c4c9cf",
};

/** The chrome's colours in `editor`, the editor window's document, as its theme sets them now. */
export function chromeTokens(editor: Document): ChromeTokens {
  const style = editor.defaultView?.getComputedStyle(editor.documentElement);
  const read = (name: string, fallback: string) => style?.getPropertyValue(name).trim() || fallback;
  return {
    primary: read("--primary", DEFAULT_TOKENS.primary),
    primaryForeground: read("--primary-foreground", DEFAULT_TOKENS.primaryForeground),
    grid: read("--grid-outline", DEFAULT_TOKENS.grid),
    popover: read("--popover", DEFAULT_TOKENS.popover),
    popoverForeground: read("--popover-foreground", DEFAULT_TOKENS.popoverForeground),
    borderStrong: read("--border-strong", DEFAULT_TOKENS.borderStrong),
  };
}

/** Marks the stylesheet that gives the canvas document the editor's colours. */
const CHROME_TOKENS_ATTRIBUTE = "data-webforge-chrome-tokens";

/**
 * Adds the chrome's styles to the canvas document `document` once, in the editor's colours
 * (`editor`, the editor window's document), and follows its theme as it switches: the canvas
 * iframe doesn't have the editor's tokens. Returns what stops following it.
 */
export function applyChromeStyles(document: Document, editor: Document): () => void {
  ensureStyle(document, CHROME_STYLE_ATTRIBUTE, CHROME_CSS);
  const apply = () => {
    const tokens = chromeTokens(editor);
    ensureStyle(
      document,
      CHROME_TOKENS_ATTRIBUTE,
      `:root {\n  --wf-outline-color: ${tokens.primary};\n  --wf-grid-color: ${tokens.grid};\n` +
        `  --wf-primary: ${tokens.primary};\n` +
        `  --wf-primary-foreground: ${tokens.primaryForeground};\n` +
        `  --wf-tip-bg: ${tokens.popover};\n  --wf-tip-fg: ${tokens.popoverForeground};\n` +
        `  --wf-tip-border: ${tokens.borderStrong};\n}`,
    );
  };
  apply();
  const Observer = editor.defaultView?.MutationObserver;
  if (Observer === undefined) return () => undefined;
  // The theme is the editor root's `data-theme` (light or dark).
  const observer = new Observer(apply);
  observer.observe(editor.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** How much smaller than its real size Puck shows the canvas iframe (1 when not zoomed). */
export function canvasZoom(element: HTMLElement): number {
  // The iframe element belongs to the editor window, so `instanceof` against this realm fails.
  const frame = element.ownerDocument.defaultView?.frameElement as HTMLElement | null | undefined;
  const width = frame?.offsetWidth ?? 0;
  return frame !== null && frame !== undefined && width > 0
    ? frame.getBoundingClientRect().width / width
    : 1;
}

/** Props Puck passes to the `componentOverlay` override. */
type OverlayProps = {
  readonly children: ReactNode;
  readonly hover: boolean;
  readonly isSelected: boolean;
  readonly componentId: string;
  readonly componentType: string;
};

/** What the selected element's spacing handles (1.32) and width handles (2.17) need. */
export type SpacingHandleOptions = {
  /** The `box` fields of a component type. */
  readonly fieldsOf: (componentType: string) => readonly BoxHandleField[];
  /** The field that sets how wide an element of a component type is, if it has one. */
  readonly widthFieldOf?: (componentType: string) => WidthHandleField | undefined;
  /** The device view the canvas shows, whose values the handles change. */
  readonly breakpoint: () => Breakpoint;
  readonly onFieldDrag: (drag: FieldDrag) => void;
};

/**
 * The outline over an element on the canvas: 1 px magenta on hover, 2 px when selected. A hovered
 * or selected top-level section also gets the floating + on its bottom edge, which asks `onAdd` to
 * add a section after it (UI1: "opens the Add panel at the insertion point"); not where adding is
 * locked (Content mode). The selected element also gets its spacing handles (1.32), and its width
 * handles if a field sets its width (2.17), except in Content mode.
 */
export function createSelectionOutline(
  onAdd: (at: InsertPoint) => void,
  spacing?: SpacingHandleOptions,
) {
  return function SelectionOutline({
    hover,
    isSelected,
    componentId,
    componentType,
  }: OverlayProps) {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      const element = ref.current;
      if (element !== null) {
        const zoom = String(canvasZoom(element));
        element.style.setProperty("--wf-zoom", zoom);
        // The bars Puck draws beside the outlines are scaled by it too (LF-3).
        element.ownerDocument.documentElement.style.setProperty("--wf-zoom", zoom);
      }
    });
    // Its index in the page's top-level list, or -1 for an element inside a section.
    const topLevelIndex = usePuck((state) => {
      const selector = state.getSelectorForId(componentId);
      return selector?.zone === ROOT_ZONE ? selector.index : -1;
    });
    const canInsert = usePuck((state) => state.getPermissions().insert === true);
    const props = usePuck((state) =>
      isSelected ? state.getItemById(componentId)?.props : undefined,
    );
    const state = isSelected ? "selected" : hover ? "hover" : "none";
    const showAdd = state !== "none" && topLevelIndex >= 0 && canInsert;
    const boxFields = isSelected && canInsert ? (spacing?.fieldsOf(componentType) ?? []) : [];
    const widthField = isSelected && canInsert ? spacing?.widthFieldOf?.(componentType) : undefined;
    return (
      <div ref={ref} className="wf-outline" data-state={state} data-wf-id={componentId}>
        {showAdd ? (
          <button
            type="button"
            className="wf-add"
            data-wf-tip={t("canvas.addSection")}
            aria-label={t("canvas.addSection")}
            // Not a click on the section underneath: no selecting, no dragging.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onAdd({ index: topLevelIndex + 1 });
            }}
          >
            +
          </button>
        ) : null}
        {spacing !== undefined && boxFields.length > 0 ? (
          <SpacingHandles
            nodeId={componentId}
            fields={boxFields}
            props={props}
            breakpoint={spacing.breakpoint}
            onFieldDrag={spacing.onFieldDrag}
          />
        ) : null}
        {spacing !== undefined && widthField !== undefined ? (
          <WidthHandles
            nodeId={componentId}
            field={widthField}
            props={props}
            breakpoint={spacing.breakpoint}
            onFieldDrag={spacing.onFieldDrag}
          />
        ) : null}
      </div>
    );
  };
}

/** Props Puck passes to the `actionBar` override. */
type ActionBarProps = {
  readonly label?: string;
  readonly children: ReactNode;
  readonly parentAction: ReactNode;
};

/** What the selected element's bar offers besides moving it and Puck's own actions (F-ED-25). */
export type ElementActions = {
  /** Whether an element of `componentType` has text or an image to edit. */
  readonly canEdit: (componentType: string) => boolean;
  /** Starts editing element `id`'s text, or picking its image. */
  readonly edit: (id: string, componentType: string) => void;
  /**
   * Whether element `id` can be hidden: one of the page's own (a layer), not one of the shared
   * Header or Footer, nor one inside a linked copy.
   */
  readonly canHide: (id: string) => boolean;
  /** Hides element `id`, or shows it again. */
  readonly toggleHidden: (id: string) => void;
  /** Whether an element of `componentType` has Appearance fields to style (3.13a). */
  readonly canStyle: (componentType: string) => boolean;
  /** Opens *Style this ‹kind›…* for element `id`. */
  readonly style: (id: string) => void;
};

/** Props of {@link QuickActionBar}. */
type QuickActionBarProps = ActionBarProps & {
  /** *Edit* and *Hide* (F-ED-25); none when left out. */
  readonly elementActions?: ElementActions;
  /**
   * Whether the element with this id is locked, like the shared Header or Footer itself (F-ED-7):
   * it can't be moved, duplicated or deleted from the canvas, so its bar shows only its name.
   */
  readonly isLocked?: (id: string) => boolean;
};

/**
 * The id of the element whose bar holds `marker`, from the outline beside it. Read as an attribute:
 * the outline is the canvas iframe's, whose `HTMLElement` isn't this window's.
 */
function barElementId(marker: Element | null): string | null {
  const outline = marker?.closest(OVERLAY)?.querySelector(".wf-outline");
  return outline?.getAttribute("data-wf-id") ?? null;
}

/**
 * Moves the selected element one place up or down in its list, as one undo step ("Moved …").
 * Shown only in the selected element's bar and only where elements may be moved (not in Content
 * mode).
 */
function MoveActions() {
  const getPuck = useGetPuck();
  const canMoveUp = usePuck((state) => canPerform(state, "moveUp"));
  const canMoveDown = usePuck((state) => canPerform(state, "moveDown"));
  if (!(canMoveUp || canMoveDown)) {
    return null;
  }
  return (
    <>
      <ActionBar.Action
        label={t("canvas.moveUp")}
        disabled={!canMoveUp}
        onClick={() => performOnSelected(getPuck(), "moveUp")}
      >
        <ArrowUpIcon size={16} />
      </ActionBar.Action>
      <ActionBar.Action
        label={t("canvas.moveDown")}
        disabled={!canMoveDown}
        onClick={() => performOnSelected(getPuck(), "moveDown")}
      >
        <ArrowDownIcon size={16} />
      </ActionBar.Action>
    </>
  );
}

/**
 * *Edit* (text editing, or the image picker), *Style* and *Hide* or *Show* for the selected element
 * (F-ED-25, UX-1, 3.13a). Edit is content, so Content mode keeps it; Style and Hide change the
 * design, so only where elements may be added (not in Content mode). Each is one undo step, or none
 * until something changes.
 */
function ElementActionButtons({
  id,
  actions,
}: {
  readonly id: string;
  readonly actions: ElementActions;
}) {
  const type = usePuck((state) => state.getItemById(id)?.type);
  const hidden = usePuck((state) => state.getItemById(id)?.props.hidden === true);
  // Not in Content mode, which locks the layout (M3).
  const layoutOpen = usePuck((state) => state.getPermissions().insert === true);
  if (type === undefined) {
    return null;
  }
  return (
    <>
      {actions.canEdit(type) ? (
        <ActionBar.Action label={t("canvas.edit")} onClick={() => actions.edit(id, type)}>
          <PencilIcon size={16} />
        </ActionBar.Action>
      ) : null}
      {layoutOpen && actions.canStyle(type) ? (
        <ActionBar.Action label={t("canvas.style")} onClick={() => actions.style(id)}>
          <PaletteIcon size={16} />
        </ActionBar.Action>
      ) : null}
      {layoutOpen && actions.canHide(id) ? (
        <ActionBar.Action
          label={t(hidden ? "canvas.show" : "canvas.hide")}
          onClick={() => actions.toggleHidden(id)}
        >
          {hidden ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
        </ActionBar.Action>
      ) : null}
    </>
  );
}

/**
 * Element `id`'s size on the page ("256 × 256"), for its name chip while *Show spacing on hover* is
 * on (SP-2); nothing while it's off. The element's own, not Puck's wrapper around it, which can be
 * wider (a Small Image in a wide column).
 */
export function hoveredSize(document: Document, id: string): string | undefined {
  if (!document.documentElement.hasAttribute(OPTION_ATTRIBUTES.spacingOnHover)) return undefined;
  const element = elementOf(document, id);
  if (element === null || element === undefined) return undefined;
  const { width, height } = element.getBoundingClientRect();
  return `${Math.round(width)} × ${Math.round(height)}`;
}

/**
 * The selected element's bar (UI1 §3, F-ED-25): its label chip, select-parent, move up and down,
 * *Edit* and *Hide*, and Puck's own duplicate and delete (and the rich-text format menu while text
 * is edited). Every action is one step, reaching the history through the usual edit path.
 */
export function QuickActionBar({
  label,
  children,
  parentAction,
  isLocked,
  elementActions,
}: QuickActionBarProps) {
  const kept = useRef<HTMLDivElement | null>(null);
  // The element the bar belongs to, read from the outline beside it once the bar is in the page.
  // Puck gives every element a bar of its own, so it stays the same while the bar is shown.
  const [id, setId] = useState<string | null>(null);
  const attach = (bar: HTMLDivElement | null) => {
    kept.current = bar;
    if (bar !== null) setId(barElementId(bar));
  };
  // Puck also draws a hovered element's bar: only its name chip shows there (SP-1).
  const selected = usePuck((state) => id !== null && state.selectedItem?.props.id === id);
  const [size, setSize] = useState<string | undefined>(undefined);
  // Pressing one of the bar's buttons leaves the focus where it is, as toolbars do: in text being
  // edited, whose format menu (in this bar) would otherwise close on the press, the bar shrinking so
  // the button under the pointer moved away before the click landed (LF-3's bar starts at the left).
  useLayoutEffect(() => {
    const bar = kept.current;
    if (bar === null) return undefined;
    // The canvas iframe's elements aren't this window's: `closest` rather than `instanceof`.
    const keepFocus = (event: Event) => {
      const target = event.target as { closest?: (selector: string) => unknown } | null;
      const button = target?.closest?.("button");
      if (button !== null && button !== undefined) event.preventDefault();
    };
    bar.addEventListener("mousedown", keepFocus);
    return () => bar.removeEventListener("mousedown", keepFocus);
  });
  // After every draw, with no dependencies on purpose (R2): the hovered element's size is read from
  // the canvas's layout, which changes without any of this component's values changing. It sets
  // the size only when it differs, so it settles after one more draw.
  useLayoutEffect(() => {
    const bar = kept.current;
    // With *Show spacing on hover* on, a hovered element's chip says its size (SP-2).
    const next =
      bar === null || selected || id === null ? undefined : hoveredSize(bar.ownerDocument, id);
    if (next !== size) setSize(next);
  });
  // The selected element's bar keeps off its text (#1177), following the canvas's layout itself, so
  // only a new selection starts it again. A hovered element's chip stays where Puck puts it.
  useLayoutEffect(() => {
    const bar = kept.current;
    const overlay = bar?.closest(OVERLAY);
    if (
      !selected ||
      id === null ||
      bar === null ||
      bar === undefined ||
      overlay === null ||
      overlay === undefined
    ) {
      return undefined;
    }
    return followPlacement(bar, overlay, bar.ownerDocument.querySelector(componentSelector(id)));
  }, [selected, id]);
  const locked = id !== null && isLocked?.(id) === true;
  if (!selected) {
    return (
      <div ref={attach}>
        <ActionBar>
          <ActionBar.Group>
            {label === undefined ? null : (
              <ActionBar.Label
                label={size === undefined ? label : t("canvas.chipSize", { name: label, size })}
              />
            )}
          </ActionBar.Group>
        </ActionBar>
      </div>
    );
  }
  return (
    <div ref={attach}>
      <ActionBar>
        <ActionBar.Group>
          {parentAction}
          {label === undefined ? null : <ActionBar.Label label={label} />}
        </ActionBar.Group>
        {locked ? null : (
          <ActionBar.Group>
            {selected ? <MoveActions /> : null}
            {selected && id !== null && elementActions !== undefined ? (
              <ElementActionButtons id={id} actions={elementActions} />
            ) : null}
            {children}
          </ActionBar.Group>
        )}
      </ActionBar>
    </div>
  );
}

/**
 * Outlines the element `nodeId` in `doc`, the canvas document, as on hover: from outside the
 * canvas (a breadcrumb under the pointer). `null` takes the outline away.
 */
export function outlineElement(doc: Document | undefined, nodeId: string | null): void {
  for (const element of doc?.querySelectorAll(`[${OUTLINED_ATTRIBUTE}]`) ?? []) {
    element.removeAttribute(OUTLINED_ATTRIBUTE);
  }
  if (nodeId === null) return;
  doc?.querySelector(componentSelector(nodeId))?.setAttribute(OUTLINED_ATTRIBUTE, "");
}
