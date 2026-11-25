// Sticky header (F-DS-6): once the page has scrolled 80 px, the header gets data-scrolled, which
// its scroll style shows (shrink, a solid background, a shadow). Anchor targets aren't hidden under
// it: the page's scroll padding follows the header's height as it changes. Without the script the
// header is simply sticky, and its own class gives the page a fixed scroll padding.
//
// A header that hides on the way down (HH-7, data-wf-sticky="hide") also gets data-hidden once the
// page scrolls down past the 80 px, and loses it on the way up. It stays in view at the top, while
// its phone menu is open, and while the keyboard's focus is in it, so it's never hidden from someone
// using it.
(() => {
  const THRESHOLD = 80;
  // A smaller scroll either way changes nothing, so a trackpad's jitter doesn't flick it.
  const TOLERANCE = 4;
  for (const header of document.querySelectorAll("[data-wf-sticky]")) {
    if (!(header instanceof HTMLElement)) {
      continue;
    }
    const root = document.documentElement;
    const hides = header.getAttribute("data-wf-sticky") === "hide";
    let last = window.scrollY;
    /** Whether the keyboard's focus is in the header: a click's focus on a menu link isn't. */
    const keyboardIn = () => {
      const focused = document.activeElement;
      if (!(focused instanceof HTMLElement) || !header.contains(focused)) {
        return false;
      }
      try {
        return focused.matches(":focus-visible");
      } catch {
        return true;
      }
    };
    /** Hides it on the way down past the threshold, and shows it again on the way up. */
    const hide = (/** @type {number} */ y) => {
      const kept = y <= THRESHOLD || keyboardIn() || header.querySelector("details[open]") !== null;
      if (kept || y < last - TOLERANCE) {
        header.removeAttribute("data-hidden");
        last = y;
      } else if (y > last + TOLERANCE) {
        header.setAttribute("data-hidden", "");
        last = y;
      }
    };
    const scrolled = () => {
      const y = window.scrollY;
      header.toggleAttribute("data-scrolled", y > THRESHOLD);
      if (hides) {
        hide(y);
      }
    };
    const pad = () => {
      root.style.scrollPaddingTop = `${header.offsetHeight}px`;
    };
    window.addEventListener("scroll", scrolled, { passive: true });
    if (hides) {
      // Tabbing into it brings it back.
      header.addEventListener("focusin", () => {
        header.removeAttribute("data-hidden");
      });
    }
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(pad).observe(header);
    }
    scrolled();
    pad();
  }
})();
