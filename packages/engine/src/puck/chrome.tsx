import { ActionBar, createUsePuck, useGetPuck } from "@puckeditor/core";
import { t } from "@webforge/i18n";
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, PencilIcon } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { FieldDrag, InsertPoint } from "../canvas-engine.js";
import { HIDDEN_ATTRIBUTE } from "./config.js";

/** Marks the element outlined from outside the canvas (`CanvasEngine.outline`). */
export const OUTLINED_ATTRIBUTE = "data-wf-outlined";

import { OVERLAY } from "./puck-dom.js";
import { canPerform, performOnSelected } from "./selected-actions.js";
import { type BoxHandleField, SPACING_HANDLES_CSS, SpacingHandles } from "./spacing-handles.js";
import { ensureStyle } from "./styles.js";
import { ROOT_ZONE } from "./tree.js";

const usePuck = createUsePuck();

/** Marks the `<style>` with the canvas chrome's own rules in the canvas document. */
const CHROME_STYLE_ATTRIBUTE = "data-webforge-chrome";

/**
 * The canvas chrome's styles (UI1 §3): magenta outlines, 1 px on hover and 2 px on the selected
 * element. They live in the canvas document, which has none of the editor's own styles, so they
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
/* A hidden element (Layers' Hide): dimmed, still there to select and show again. */
[${HIDDEN_ATTRIBUTE}] {
  opacity: 0.35;
}
.wf-add:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
${SPACING_HANDLES_CSS}`;

/** The editor's colours the chrome is drawn in (UI1), from its theme's tokens. */
export type ChromeTokens = {
  /** `--selection-outline`: outlines, the other selected elements, the spacing grips. */
  readonly outline: string;
  /** `--primary` and `--primary-foreground`: the floating +. */
  readonly primary: string;
  readonly primaryForeground: string;
};

/** The light theme's colours, where the editor document has no tokens (a test without its CSS). */
const DEFAULT_TOKENS: ChromeTokens = {
  outline: "#f028f3",
  primary: "#0a6fb7",
  primaryForeground: "#ffffff",
};

/** The chrome's colours in `editor`, the editor window's document, as its theme sets them now. */
export function chromeTokens(editor: Document): ChromeTokens {
  const style = editor.defaultView?.getComputedStyle(editor.documentElement);
  const read = (name: string, fallback: string) => style?.getPropertyValue(name).trim() || fallback;
  return {
    outline: read("--selection-outline", DEFAULT_TOKENS.outline),
    primary: read("--primary", DEFAULT_TOKENS.primary),
    primaryForeground: read("--primary-foreground", DEFAULT_TOKENS.primaryForeground),
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
      `:root {\n  --wf-outline-color: ${tokens.outline};\n  --wf-primary: ${tokens.primary};\n` +
        `  --wf-primary-foreground: ${tokens.primaryForeground};\n}`,
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

/** What the selected element's spacing handles need (1.32). */
export type SpacingHandleOptions = {
  /** The `box` fields of a component type. */
  readonly fieldsOf: (componentType: string) => readonly BoxHandleField[];
  readonly onFieldDrag: (drag: FieldDrag) => void;
};

/**
 * The outline over an element on the canvas: 1 px magenta on hover, 2 px when selected. A hovered
 * or selected top-level section also gets the floating + on its bottom edge, which asks `onAdd` to
 * add a section after it (UI1: "opens the Add panel at the insertion point"); not where adding is
 * locked (Content mode). The selected element also gets its spacing handles (1.32), except in
 * Content mode.
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
        element.style.setProperty("--wf-zoom", String(canvasZoom(element)));
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
    return (
      <div ref={ref} className="wf-outline" data-state={state} data-wf-id={componentId}>
        {showAdd ? (
          <button
            type="button"
            className="wf-add"
            title={t("canvas.addSection")}
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
 * *Edit* (text editing, or the image picker) and *Hide* or *Show* for the selected element (F-ED-25,
 * UX-1). Edit is content, so Content mode keeps it; Hide changes the layout, so only where elements
 * may be added (not in Content mode). Each is one undo step, or none until the text changes.
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

/** Space between the element and its bar when the bar goes below it, in screen pixels. */
const BELOW_GAP = 4;

/**
 * Keeps the selected element's bar inside the canvas: Puck draws it above its element at a fixed
 * size on screen, so on a zoomed-out canvas the bar of an element near the top of the page would
 * sit above the frame, where it can't be clicked. It then goes just below the element instead, so
 * it covers neither the element nor the frame's edge. A hovered element's bar stays put. Returns
 * a function that stops following the frame's size.
 */
function keepInFrame(bar: HTMLElement, selected: boolean): (() => void) | undefined {
  const frame = bar.ownerDocument.defaultView;
  if (!frame) {
    return undefined;
  }
  const place = () => {
    bar.style.transform = "";
    const element = bar.closest(OVERLAY);
    if (element === null || !selected) {
      return;
    }
    const { top, height } = bar.getBoundingClientRect();
    if (top >= 0 || height === 0) {
      return;
    }
    // The bar is scaled to stay the same size on screen: `scale` turns screen into frame pixels.
    const scale = height / bar.offsetHeight;
    const below = element.getBoundingClientRect().bottom + BELOW_GAP * scale;
    const target = Math.max(0, Math.min(below, frame.innerHeight - height));
    bar.style.transform = `translateY(${(target - top) / scale}px)`;
  };
  place();
  frame.addEventListener("resize", place);
  return () => frame.removeEventListener("resize", place);
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
  // Puck also shows a hovered element's bar; the move, Edit and Hide actions are the selected one's.
  const selected = usePuck((state) => id !== null && state.selectedItem?.props.id === id);
  useLayoutEffect(() => {
    const bar = kept.current;
    return bar === null ? undefined : keepInFrame(bar, selected);
  });
  const locked = id !== null && isLocked?.(id) === true;
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
