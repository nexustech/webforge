import { ActionBar, createUsePuck, useGetPuck } from "@puckeditor/core";
import { t } from "@webforge/i18n";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { toPageDoc } from "./edit-from-action.js";
import { zoneContent } from "./tree.js";

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

/** Moves the selected element one place up or down in its list, as one undo step ("Moved …"). */
function MoveActions() {
  const getPuck = useGetPuck();
  const selector = usePuck((state) => state.appState.ui.itemSelector);
  const canDrag = usePuck((state) =>
    state.selectedItem === null ? false : state.getPermissions({ item: state.selectedItem }).drag,
  );
  const count = usePuck(
    (state) =>
      zoneContent(toPageDoc(state.appState.data), state.appState.ui.itemSelector?.zone).length,
  );
  if (selector === null || canDrag !== true) {
    return null;
  }
  const { index } = selector;
  const zone = selector.zone ?? "root:default-zone";
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
      <ActionBar.Action
        label={t("canvas.moveUp")}
        disabled={index === 0}
        onClick={() => move(index - 1)}
      >
        <ArrowUpIcon size={16} />
      </ActionBar.Action>
      <ActionBar.Action
        label={t("canvas.moveDown")}
        disabled={index >= count - 1}
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
