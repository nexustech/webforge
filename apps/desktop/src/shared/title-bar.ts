/**
 * Height of the custom title bar in CSS pixels (UI1), shared by the main process, which gives it
 * to the native window controls (`titleBarOverlay`), and the renderer, which draws the bar. In
 * pixels, not rem: the editor's 14 px rem would make a `h-10` bar 35 px under 40 px
 * controls (#484).
 */
export const TITLE_BAR_HEIGHT = 40;
