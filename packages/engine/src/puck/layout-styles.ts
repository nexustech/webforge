import { CANVAS, LAYOUT } from "./puck-dom.js";
import { ensureStyle } from "./styles.js";

/** Marks the element the canvas is mounted in, which {@link PUCK_LAYOUT_CSS} is scoped to. */
export const CANVAS_HOST_ATTRIBUTE = "data-webforge-canvas";

/** Marks the one copy of {@link PUCK_LAYOUT_CSS} in a document. */
const STYLE_ATTRIBUTE = "data-webforge-puck-layout";

/**
 * Hides Puck's own rail and sidebars (#274): Puck 0.23 always draws its plugin rail (Add, Layers,
 * Fields), whose buttons open its sidebars again whatever `ui.leftSideBarVisible` says. The editor
 * has its own Add panel (1.13), Layers (1.24) and Edit panel (1.14), so only Puck's canvas shows.
 * Hidden rather than left out: rendering `<Puck>` with only its preview would also drop Puck's
 * canvas, whose zoom and frame the engine uses. The rail's width goes to zero, so the canvas fills
 * the editor's.
 */
const PUCK_LAYOUT_CSS = `
[${CANVAS_HOST_ATTRIBUTE}] ${LAYOUT.nav},
[${CANVAS_HOST_ATTRIBUTE}] ${LAYOUT.leftSidebar},
[${CANVAS_HOST_ATTRIBUTE}] ${LAYOUT.rightSidebar} {
  display: none !important;
}
[${CANVAS_HOST_ATTRIBUTE}] ${LAYOUT.inner} {
  --puck-pluginbar-width: 0px !important;
  --puck-sidebar-left-width: 0px !important;
  --puck-sidebar-right-width: 0px !important;
}
/* LF-2: the page flush at the top of a flat backdrop (the editor's), with its own scrollbar. */
[${CANVAS_HOST_ATTRIBUTE}] ${CANVAS} {
  --puck-canvas-color-bg: transparent;
  background: transparent;
  padding-top: 0 !important;
}
`;

/** Marks `host` as the canvas's and adds {@link PUCK_LAYOUT_CSS} to its document once. */
export function hidePuckLayout(host: HTMLElement): void {
  host.setAttribute(CANVAS_HOST_ATTRIBUTE, "");
  ensureStyle(host.ownerDocument, STYLE_ATTRIBUTE, PUCK_LAYOUT_CSS);
}
