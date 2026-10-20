import { ActionBar, createUsePuck, useGetPuck } from "@puckeditor/core";
import { t } from "@webforge/i18n";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
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
  /* The editor's --selection-outline token; the canvas document doesn't have the editor's tokens. */
  --wf-outline-color: #f028f3;
}
.wf-outline[data-state="hover"] {
  outline: calc(1px / var(--wf-zoom, 1)) solid var(--wf-outline-color);
}
.wf-outline[data-state="selected"] {
  outline: calc(2px / var(--wf-zoom, 1)) solid var(--wf-outline-color);
}
`;

/** Adds the chrome's styles to the canvas document once. */
export function applyChromeStyles(document: Document): void {
  if (document.head.querySelector(`style[${CHROME_STYLE_ATTRIBUTE}]`) === null) {
    const element = document.createElement("style");
    element.setAttribute(CHROME_STYLE_ATTRIBUTE, "");
    element.textContent = CHROME_CSS;
    document.head.append(element);
  }
}

/** How much smaller than its real size Puck shows the canvas iframe (1 when not zoomed). */
function canvasZoom(element: HTMLElement): number {
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

/** The outline over an element on the canvas: 1 px magenta on hover, 2 px when selected. */
export function SelectionOutline({ hover, isSelected }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element !== null) {
      element.style.setProperty("--wf-zoom", String(canvasZoom(element)));
    }
  });
  const state = isSelected ? "selected" : hover ? "hover" : "none";
  return <div ref={ref} className="wf-outline" data-state={state} />;
}

/** Props Puck passes to the `actionBar` override. */
type ActionBarProps = {
  readonly label?: string;
  readonly children: ReactNode;
  readonly parentAction: ReactNode;
};

/**
 * Whether the action bar holding `marker` is the selected element's. Puck also shows the bar of a
 * hovered element, and its props don't say which element it belongs to; the outline beside it
 * does (see {@link SelectionOutline}).
 */
function inSelectedBar(marker: Element | null): boolean {
  return (
    marker?.closest("[data-puck-overlay]")?.querySelector('.wf-outline[data-state="selected"]') !=
    null
  );
}

/**
 * Moves the selected element one place up or down in its list, as one undo step ("Moved …").
 * Shown only in the selected element's bar and only where elements may be moved (not in Content
 * mode).
 */
function MoveActions() {
  const getPuck = useGetPuck();
  const marker = useRef<HTMLSpanElement>(null);
  const [selectedBar, setSelectedBar] = useState(false);
  useLayoutEffect(() => {
    setSelectedBar(inSelectedBar(marker.current));
  });
  const selector = usePuck((state) => state.appState.ui.itemSelector);
  const canDrag = usePuck((state) =>
    state.selectedItem === null ? false : state.getPermissions({ item: state.selectedItem }).drag,
  );
  const hasNext = usePuck((state) => {
    const selected = state.appState.ui.itemSelector;
    return selected === null
      ? false
      : state.getItemBySelector({ zone: selected.zone ?? ROOT_ZONE, index: selected.index + 1 }) !==
          undefined;
  });
  const marked = <span ref={marker} hidden />;
  if (selector === null || canDrag !== true || !selectedBar) {
    return marked;
  }
  const { index } = selector;
  const zone = selector.zone ?? ROOT_ZONE;
  const move = (to: number) => {
    const { dispatch } = getPuck();
    dispatch({
      type: "move",
      sourceZone: zone,
      sourceIndex: index,
      destinationZone: zone,
      destinationIndex: to,
    });
    // Puck selects by position: keep the moved element selected.
    dispatch({ type: "setUi", ui: { itemSelector: { zone, index: to } } });
  };
  return (
    <>
      {marked}
      <ActionBar.Action
        label={t("canvas.moveUp")}
        disabled={index === 0}
        onClick={() => move(index - 1)}
      >
        <ArrowUpIcon size={16} />
      </ActionBar.Action>
      <ActionBar.Action
        label={t("canvas.moveDown")}
        disabled={!hasNext}
        onClick={() => move(index + 1)}
      >
        <ArrowDownIcon size={16} />
      </ActionBar.Action>
    </>
  );
}

/**
 * The selected element's bar (UI1 §3): its label chip, select-parent, move up and down, and Puck's
 * own duplicate and delete (and the rich-text format menu while text is edited). Every action is
 * one Puck action, so it reaches the history as one labelled step through the usual edit path.
 */
export function QuickActionBar({ label, children, parentAction }: ActionBarProps) {
  return (
    <ActionBar>
      <ActionBar.Group>
        {parentAction}
        {label === undefined ? null : <ActionBar.Label label={label} />}
      </ActionBar.Group>
      <ActionBar.Group>
        <MoveActions />
        {children}
      </ActionBar.Group>
    </ActionBar>
  );
}
