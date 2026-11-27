// E2E tests run with motion off (#1493): a test reading the screen while something on it still
// moves was most of 26 Nov's flaky failures (#1474, #1478, #1488). Each test's pages ask for
// reduced motion, and this sheet makes every transition and animation end at once, whether or
// not its CSS honours that. Test-only: the app and exported sites don't change. A test about
// motion itself opts out: `launchDesktopApp({ motion: true })` (or the `@motion` tag), or
// `test.use({ motion: true, reducedMotion: "no-preference" })` in the exported site's specs
// (e2e/README.md).

/**
 * No transitions, and every animation over at once, as the editor's own reduced-motion rule
 * (`packages/editor-ui/src/theme.css`). Transitions at 0 s: a short duration on every element would
 * give each a transition of every property, as `transition-property` starts as `all`, and the
 * renderer would draw old values for a frame (#1497). Nothing in the editor waits for
 * `transitionend`. Animations at 0.01 ms, not 0: Radix's Presence waits for `animationend` to
 * unmount what's closing. An endless one runs once, so a spinner stands still.
 */
const NO_MOTION_CSS = `*, *::before, *::after {
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  animation-duration: 0.01ms !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  scroll-behavior: auto !important;
}`;

/** The id of the sheet's `<style>`, so a test can check it's there (no-motion.spec.ts). */
export const NO_MOTION_ID = "e2e-no-motion";

/**
 * Adds the sheet to the document it runs in, as soon as it can and again whenever its `<head>`
 * loses it (a frame whose head is rewritten): run in each frame as it navigates by the app's
 * launcher, and as an init script by the exported site's fixture. It runs in the page, so it takes
 * everything it needs as its argument.
 */
export function addNoMotionSheet({ css, id }: { readonly css: string; readonly id: string }): void {
  const add = () => {
    if (document.getElementById(id) !== null) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    (document.head ?? document.documentElement)?.append(style);
  };
  add();
  document.addEventListener("DOMContentLoaded", add);
  // The document's own children and its head's: not the whole tree, which changes all the time. A
  // new head is watched in its turn.
  const observer = new MutationObserver(() => {
    add();
    watch();
  });
  const watch = () => {
    observer.disconnect();
    if (document.documentElement !== null) {
      observer.observe(document.documentElement, { childList: true });
    }
    if (document.head !== null) observer.observe(document.head, { childList: true });
  };
  watch();
  document.addEventListener("DOMContentLoaded", watch);
}

/** {@link addNoMotionSheet}'s argument, for the app's windows. */
export const NO_MOTION_SHEET = { css: NO_MOTION_CSS, id: NO_MOTION_ID } as const;

/**
 * The exported site's: no transition or animation at all. Its only script waiting for one's end
 * (animate.js's entrance) does nothing with reduced motion, which its pages ask for. WebKit didn't
 * always finish a 0.01 ms transition before a test read its style, leaving a colour as it started
 * (#1499).
 */
export const NO_MOTION_SITE_SHEET = {
  css: `*, *::before, *::after {
  transition: none !important;
  animation: none !important;
  scroll-behavior: auto !important;
}`,
  id: NO_MOTION_ID,
} as const;
