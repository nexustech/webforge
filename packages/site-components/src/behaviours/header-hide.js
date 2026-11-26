// A Header that hides on the way down (HH-7): a sticky Header in the "Hide when scrolling down"
// style (data-wf-sticky="hide") gets data-hidden once the page scrolls down past 80 px, which slides
// it up out of view, and loses it on the way up. It stays in view at the top, while a menu in it is
// open (the phone menu), and while the keyboard's focus is in it, so it's never hidden from someone
// using it; tabbing into it brings it back. Without the script it's simply sticky ("sticky" gives it
// its scroll padding, so anchor targets aren't hidden under it either way).
(() => {
  const THRESHOLD = 80;
  // A smaller scroll either way changes nothing, so a trackpad's jitter doesn't flick it.
  const TOLERANCE = 4;
  const root = document.documentElement;
  for (const header of document.querySelectorAll('[data-wf-sticky="hide"]')) {
    if (!(header instanceof HTMLElement)) {
      continue;
    }
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
    const scrolled = () => {
      const y = window.scrollY;
      // Past the bottom, as a phone's scroll bounces back from it: not a scroll up.
      if (y > root.scrollHeight - window.innerHeight) {
        return;
      }
      const kept = y <= THRESHOLD || keyboardIn() || header.querySelector("details[open]") !== null;
      if (kept || y < last - TOLERANCE) {
        header.removeAttribute("data-hidden");
        last = y;
      } else if (y > last + TOLERANCE) {
        header.setAttribute("data-hidden", "");
        last = y;
      }
    };
    window.addEventListener("scroll", scrolled, { passive: true });
    header.addEventListener("focusin", () => {
      header.removeAttribute("data-hidden");
    });
    scrolled();
  }
})();
