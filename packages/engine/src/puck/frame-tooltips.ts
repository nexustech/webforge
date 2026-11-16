import { ACTIONS, RICH_TEXT_MENU } from "./puck-dom.js";

/**
 * A canvas control's tooltip text (#1011): the chrome's own controls set it in place of the
 * browser's `title`, which is slow, unstyled and never shown on focus.
 */
export const TIP_ATTRIBUTE = "data-wf-tip";

/** Puck's controls that carry a `title` of their own: the element's bar and the text toolbar. */
const PUCK_TITLED = `${ACTIONS} [title], ${RICH_TEXT_MENU} [title]`;

/** How long the pointer rests on a control before its tooltip shows, as the editor's (400 ms). */
const DELAY = 400;

/** Within this long of one tooltip hiding, the next shows at once, as along the editor's toolbars. */
const SKIP_DELAY = 300;

/** The gap between a control and its tooltip. */
const GAP = 4;

/** The tooltip's own rules, in the chrome's stylesheet: the editor's tooltip, 12 px on screen. */
export const FRAME_TOOLTIP_CSS = `
.wf-tip {
  position: fixed;
  z-index: 2147483647;
  max-width: calc(320px / var(--wf-zoom, 1));
  padding: calc(4px / var(--wf-zoom, 1)) calc(8px / var(--wf-zoom, 1));
  border: calc(1px / var(--wf-zoom, 1)) solid var(--wf-tip-border);
  border-radius: calc(4px / var(--wf-zoom, 1));
  background: var(--wf-tip-bg);
  color: var(--wf-tip-fg);
  box-shadow: 0 calc(4px / var(--wf-zoom, 1)) calc(8px / var(--wf-zoom, 1)) rgb(0 0 0 / 0.15);
  font: 400 calc(12px / var(--wf-zoom, 1)) / 1.4 system-ui, sans-serif;
  white-space: normal;
  pointer-events: none;
}
`;

/**
 * Puck's `title` on `element`, if it's one of Puck's controls, as a tooltip: moved to
 * {@link TIP_ATTRIBUTE} before the browser shows its own, and kept as the control's name.
 */
function adoptTitle(element: Element): void {
  const title = element.getAttribute("title");
  if (title === null || title === "" || !element.matches(PUCK_TITLED)) return;
  element.removeAttribute("title");
  element.setAttribute(TIP_ATTRIBUTE, title);
  // The title named it (Puck's buttons have no other name): the label does now.
  if (!element.hasAttribute("aria-labelledby")) element.setAttribute("aria-label", title);
}

/** The control under `target` with a tooltip, taking Puck's `title` on the way. */
function tipped(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const titled = target.closest("[title]");
  if (titled !== null) adoptTitle(titled);
  return target.closest<HTMLElement>(`[${TIP_ATTRIBUTE}]`);
}

/** Whether `element` has the keyboard's focus (`:focus-visible`), not a click's. */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * Shows the canvas chrome's tooltips in `document`, the canvas's (#1011): on pointing at a control
 * (after a short rest, then at once along a toolbar) and on the keyboard's focus. They take the
 * place of the browser's `title` on the chrome's own controls ({@link TIP_ATTRIBUTE}) and on
 * Puck's element bar and text toolbar. The editor's tooltip can't be used here: it lives in the
 * editor's document, outside the frame. Returns what stops them.
 */
export function showFrameTooltips(document: Document): () => void {
  const view = document.defaultView;
  if (view === null) return () => undefined;
  let current: HTMLElement | null = null;
  let tip: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hiddenAt = Number.NEGATIVE_INFINITY;
  /** Pressed: no tooltip over a control being used, until the pointer leaves it. */
  let pressed: HTMLElement | null = null;

  const place = (target: HTMLElement, element: HTMLElement) => {
    const box = target.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const below = box.bottom + GAP;
    const top = below + height > view.innerHeight ? box.top - GAP - height : below;
    const centred = box.left + box.width / 2 - width / 2;
    const left = Math.max(GAP, Math.min(centred, view.innerWidth - width - GAP));
    element.style.top = `${Math.max(GAP, top)}px`;
    element.style.left = `${left}px`;
  };

  const show = (target: HTMLElement) => {
    const text = target.getAttribute(TIP_ATTRIBUTE);
    if (text === null || text === "" || !target.isConnected) return;
    tip ??= Object.assign(document.createElement("div"), { className: "wf-tip" });
    // The control's own name says the same: not read twice.
    tip.setAttribute("aria-hidden", "true");
    tip.textContent = text;
    document.body.append(tip);
    place(target, tip);
  };

  const hide = () => {
    clearTimeout(timer);
    timer = undefined;
    if (tip?.isConnected === true) {
      tip.remove();
      hiddenAt = Date.now();
    }
    current = null;
  };

  const open = (target: HTMLElement, at: "once" | "after") => {
    if (current === target) return;
    hide();
    current = target;
    if (at === "once" || Date.now() - hiddenAt < SKIP_DELAY) show(target);
    else timer = setTimeout(() => show(target), DELAY);
  };

  const onPointerOver = (event: PointerEvent) => {
    const target = tipped(event.target);
    if (target === null || target === pressed) return;
    open(target, "after");
  };
  const onPointerOut = (event: PointerEvent) => {
    const to = event.relatedTarget;
    if (current !== null && to instanceof Node && current.contains(to)) return;
    if (pressed !== null && !(to instanceof Node && pressed.contains(to))) pressed = null;
    if (current !== null && document.activeElement !== current) hide();
  };
  const onFocusIn = (event: FocusEvent) => {
    const target = tipped(event.target);
    if (target !== null && event.target instanceof Element && focusVisible(event.target)) {
      open(target, "once");
    }
  };
  const onFocusOut = () => hide();
  const onPointerDown = (event: PointerEvent) => {
    pressed = tipped(event.target);
    hide();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && tip?.isConnected === true) hide();
  };
  const onScroll = () => hide();

  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  view.addEventListener("scroll", onScroll, true);
  return () => {
    hide();
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    view.removeEventListener("scroll", onScroll, true);
  };
}
